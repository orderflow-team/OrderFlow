import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceScan } from '../../database/entities/invoice-scan.entity';
import { InvoiceScanItem } from '../../database/entities/invoice-scan-item.entity';
import { InvoiceScanFile } from '../../database/entities/invoice-scan-file.entity';
import { Product } from '../../database/entities/product.entity';
import { InvoiceVisionParserService, ParsedInvoiceLine } from './services/invoice-vision-parser.service';
import { InventoryService } from '../inventory/inventory.service';
import { ConfirmInvoiceScanDto } from './dto/confirm-invoice-scan.dto';

export interface ScanPageInput {
  fileUrl: string;
  fileBuffer: Buffer;
  fileType: string;
  mimeType: string;
}

@Injectable()
export class InvoiceScanService {
  constructor(
    @InjectRepository(InvoiceScan) private scansRepository: Repository<InvoiceScan>,
    @InjectRepository(InvoiceScanItem) private itemsRepository: Repository<InvoiceScanItem>,
    @InjectRepository(InvoiceScanFile) private filesRepository: Repository<InvoiceScanFile>,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    private visionParser: InvoiceVisionParserService,
    private inventoryService: InventoryService,
  ) {}

  /**
   * Runs synchronously within the upload request — Gemini's vision call takes
   * a few seconds, which is exactly the "Wait / scanning" beat of the
   * Upload -> Wait -> Verify -> Success flow, so there's no need for a
   * separate polling/job-queue mechanism.
   *
   * `pages` supports multi-page invoices (several photos of one distributor
   * bill). Each page is parsed with its own Gemini call rather than batched
   * into one request — a bad/blurry page 2 then only loses that page's lines,
   * not the whole scan. Parsed lines are concatenated in page order and
   * `sort_order` continues across the full concatenated list.
   */
  async uploadAndParse(businessId: string, supplierId: string | undefined, pages: ScanPageInput[]) {
    const scan = await this.scansRepository.save(
      this.scansRepository.create({
        business_id: businessId,
        supplier_id: supplierId,
        // Kept for backward-compat single-file consumers — first page only.
        file_url: pages[0].fileUrl,
        file_type: pages[0].fileType,
        status: 'processing',
      }),
    );

    const fileRows = pages.map((page, index) =>
      this.filesRepository.create({
        scan_id: scan.id,
        file_url: page.fileUrl,
        file_type: page.fileType,
        page_order: index,
      }),
    );
    await this.filesRepository.save(fileRows);

    try {
      const lines: ParsedInvoiceLine[] = [];
      for (const page of pages) {
        const pageLines = await this.visionParser.parseInvoiceFile(page.fileBuffer, page.mimeType);
        lines.push(...pageLines);
      }
      if (lines.length === 0) {
        throw new BadRequestException('No product line items were found on this invoice.');
      }

      const existingProducts = await this.productsRepository.find({ where: { business_id: businessId } });

      const items = lines.map((line, index) => {
        const matched = this.findExistingProduct(existingProducts, line.productName);
        const isOutOfStock = matched ? (matched.stock_quantity <= 0) : true;
        return this.itemsRepository.create({
          scan_id: scan.id,
          raw_product_name: line.productName,
          matched_product_id: matched?.id,
          is_duplicate: !!matched,
          // Duplicates default excluded so the business doesn't double-enter a
          // product already in inventory; the user can still opt back in.
          // BUT if the matched product is out of stock, we default to including it so they can restock.
          included: !matched || isOutOfStock,
          quantity: line.quantity,
          scheme_quantity: line.schemeQuantity ?? undefined,
          unit_price: line.unitPrice ?? undefined,
          mrp: line.mrp ?? undefined,
          batch_number: line.batchNumber ?? undefined,
          expiry_month_year: line.expiryMonthYear ?? undefined,
          sort_order: index,
        });
      });
      await this.itemsRepository.save(items);

      scan.status = 'ready';
      await this.scansRepository.save(scan);
    } catch (error) {
      scan.status = 'failed';
      scan.error_message = error.message;
      await this.scansRepository.save(scan);
      throw error;
    }

    return this.findOne(scan.id, businessId);
  }

  /**
   * Exact match first, then a loose substring match for wording drift (e.g.
   * "Paracetamol 500" vs "Paracetamol 500mg Tab"), then a tight fuzzy match
   * for pure OCR spelling drift on a rescan of the same invoice (e.g.
   * "COSVATE" misread as "COSVAITE", "GEM" misread as "EM") — otherwise every
   * OCR hiccup on a repeat scan creates a brand-new duplicate product instead
   * of recognizing the one that's already there.
   *
   * The fuzzy step requires the two names to have the exact same digit
   * sequence (in the same order) before distance is even considered — a
   * pharmacy can't afford to treat "Amlong 10" and "Amlong 5", or
   * "Paracetamol 500" and "Paracetamol 650", as "close enough" just because
   * they're a couple of characters apart. It also skips very short names,
   * where a 1-character difference is more likely two genuinely different
   * products than an OCR typo.
   */
  private findExistingProduct(products: Product[], rawName: string): Product | undefined {
    const normalized = rawName.trim().toLowerCase();

    const exact = products.find((p) => p.name.trim().toLowerCase() === normalized);
    if (exact) return exact;

    const substring = products.find((p) => {
      const name = p.name.trim().toLowerCase();
      return normalized.includes(name) || name.includes(normalized);
    });
    if (substring) return substring;

    const rawDigits = this.digitSequence(normalized);
    let best: { product: Product; distance: number } | null = null;
    for (const p of products) {
      const name = p.name.trim().toLowerCase();
      const maxLen = Math.max(normalized.length, name.length);
      if (maxLen < 8 || this.digitSequence(name) !== rawDigits) continue;

      const distance = this.levenshteinDistance(normalized, name);
      // Roughly one typo allowed per 8 characters, at least 1, capped at 3 so
      // long names don't accumulate too much slack.
      const threshold = Math.min(3, Math.max(1, Math.floor(maxLen / 8)));
      if (distance <= threshold && (!best || distance < best.distance)) {
        best = { product: p, distance };
      }
    }
    return best?.product;
  }

  private digitSequence(text: string): string {
    return (text.match(/\d+/g) ?? []).join(',');
  }

  private levenshteinDistance(a: string, b: string): number {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
    for (let i = 0; i < rows; i++) dp[i][0] = i;
    for (let j = 0; j < cols; j++) dp[0][j] = j;
    for (let i = 1; i < rows; i++) {
      for (let j = 1; j < cols; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }

  async findOne(id: string, businessId: string) {
    const scan = await this.scansRepository.findOne({ where: { id, business_id: businessId } });
    if (!scan) {
      throw new NotFoundException('Invoice scan not found');
    }
    const items = await this.itemsRepository.find({
      where: { scan_id: id },
      order: { sort_order: 'ASC' },
      relations: { matched_product: true },
    });
    const files = await this.filesRepository.find({ where: { scan_id: id }, order: { page_order: 'ASC' } });
    return { ...scan, items: items.map((item) => this.withLiveIncluded(item)), files };
  }

  /**
   * `included` is only ever used to seed the verify screen's checkboxes — the
   * confirm step submits the frontend's own (possibly user-edited) state, so
   * this stored value is never written back to. That makes it go stale: a
   * duplicate-matched product that still had stock when the invoice was
   * scanned but has since sold out to zero would stay pre-unchecked ("skip,
   * already in inventory") forever, even though it now genuinely needs
   * restocking. Recompute the "currently out of stock" override against the
   * product's live stock on every read instead of trusting the parse-time
   * snapshot.
   */
  private withLiveIncluded(item: InvoiceScanItem) {
    if (item.is_duplicate && item.matched_product && Number(item.matched_product.stock_quantity) <= 0) {
      return { ...item, included: true };
    }
    return item;
  }

  findAll(businessId: string) {
    return this.scansRepository.find({ where: { business_id: businessId }, order: { created_at: 'DESC' } });
  }

  /**
   * Builds any genuinely-new products, then hands off to InventoryService's
   * existing purchase-order create + receive flow so stock/batch/expiry
   * updates go through the one code path the rest of the app already trusts.
   * Deliberately NOT one wrapping transaction: InventoryService opens its own
   * transactions per call, and nesting a dataSource.transaction() around
   * those would run on a second connection and could deadlock waiting to see
   * the not-yet-committed product rows from this method's own writes.
   */
  async confirm(id: string, dto: ConfirmInvoiceScanDto) {
    const scan = await this.scansRepository.findOne({ where: { id, business_id: dto.businessId } });
    if (!scan) {
      throw new NotFoundException('Invoice scan not found');
    }
    if (scan.status === 'confirmed') {
      throw new BadRequestException('This scan has already been confirmed.');
    }

    const includedItems = dto.items.filter((item) => item.included);
    if (includedItems.length === 0) {
      throw new BadRequestException('Select at least one item to add to inventory.');
    }

    const purchaseItems = [];
    for (const item of includedItems) {
      let productId = item.matchedProductId;
      const { purchasePrice, sellingPrice } = this.resolvePrices(item.unitPrice, item.mrp);
      if (!productId) {
        const product = await this.productsRepository.save(
          this.productsRepository.create({
            business_id: dto.businessId,
            name: item.productName,
            unit: 'piece',
            purchase_price: purchasePrice,
            selling_price: sellingPrice,
            stock_quantity: 0,
            batch_number: item.batchNumber,
            expiry_date: item.expiryMonthYear ? this.monthYearToDate(item.expiryMonthYear) : undefined,
            // Not a draft: the verify screen (edit + confirm) before this point
            // is already the review step, so these shouldn't also land in the
            // dashboard's Quick Parchi draft-review queue.
            is_draft: false,
          }),
        );
        productId = product.id;
      } else {
        // Find existing product and update details if they have changed
        const product = await this.productsRepository.findOne({
          where: { id: productId, business_id: dto.businessId },
        });
        if (product) {
          let hasChanges = false;
          const updates: Partial<Product> = {};

          if (item.productName && product.name !== item.productName) {
            updates.name = item.productName;
            hasChanges = true;
          }

          if (item.unitPrice != null || item.mrp != null) {
            if (Number(product.purchase_price) !== purchasePrice) {
              updates.purchase_price = purchasePrice;
              hasChanges = true;
            }
            if (Number(product.selling_price) !== sellingPrice) {
              updates.selling_price = sellingPrice;
              hasChanges = true;
            }
          }

          if (item.batchNumber !== undefined && product.batch_number !== item.batchNumber) {
            updates.batch_number = item.batchNumber;
            hasChanges = true;
          }

          if (item.expiryMonthYear) {
            const newExpiryDate = this.monthYearToDate(item.expiryMonthYear);
            const newExpiryStr = this.formatDateLocal(newExpiryDate);
            const currentExpiryStr = product.expiry_date ? this.formatDateLocal(new Date(product.expiry_date)) : '';
            if (currentExpiryStr !== newExpiryStr) {
              updates.expiry_date = newExpiryDate;
              hasChanges = true;
            }
          }

          if (hasChanges) {
            await this.productsRepository.update({ id: product.id }, updates);
          }
        }
      }

      purchaseItems.push({
        productId,
        quantity: item.quantity,
        unitPrice: purchasePrice,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryMonthYear ? this.formatDateLocal(this.monthYearToDate(item.expiryMonthYear)) : undefined,
        schemeQuantity: item.schemeQuantity,
      });
    }

    const purchaseOrder = await this.inventoryService.createPurchaseOrder({
      businessId: dto.businessId,
      supplierId: dto.supplierId ?? scan.supplier_id ?? undefined,
      orderNumber: `SCAN-${Date.now()}`,
      items: purchaseItems,
    } as any);

    await this.inventoryService.receivePurchaseOrder(purchaseOrder.id, dto.businessId);

    scan.status = 'confirmed';
    scan.purchase_order_id = purchaseOrder.id;
    await this.scansRepository.save(scan);

    return this.inventoryService.findOnePurchaseOrder(purchaseOrder.id, dto.businessId);
  }

  /**
   * Invoices print two prices per line — the distributor's billed RATE and the
   * printed M.R.P. — and RATE must always be the lower of the two (that's the
   * definition of a maximum retail price). Rather than trust the extraction
   * (vision OCR or a manually-typed correction) to always put the right number
   * in the right field, enforce it here: whichever of the two values is lower
   * becomes the purchase price, the higher becomes the selling price. If only
   * one price is present, both purchase and selling price fall back to it, same
   * as pre-mrp-field behavior.
   */
  private resolvePrices(rate: number | null | undefined, mrp: number | null | undefined) {
    const hasRate = rate != null;
    const hasMrp = mrp != null;
    if (hasRate && hasMrp) {
      return { purchasePrice: Math.min(rate, mrp), sellingPrice: Math.max(rate, mrp) };
    }
    if (hasRate) {
      return { purchasePrice: rate, sellingPrice: rate };
    }
    if (hasMrp) {
      return { purchasePrice: mrp, sellingPrice: mrp };
    }
    return { purchasePrice: 0, sellingPrice: 0 };
  }

  private monthYearToDate(monthYear: string): Date {
    const [mm, yyyy] = monthYear.split('/').map(Number);
    return new Date(yyyy, mm, 0); // day 0 of the following month = last day of `mm`
  }

  /** date.toISOString() converts through UTC, which rolls back a day for any
   * server timezone ahead of UTC (e.g. IST) — format from local getters instead. */
  private formatDateLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
