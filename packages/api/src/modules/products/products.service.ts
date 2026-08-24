import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../../database/entities/product.entity';
import { ProductVariant } from '../../database/entities/product-variant.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { PurchaseItem } from '../../database/entities/purchase-item.entity';
import { InvoiceItem } from '../../database/entities/invoice-item.entity';
import { PriceHistory } from '../../database/entities/price-history.entity';
import { InvoiceScanItem } from '../../database/entities/invoice-scan-item.entity';
import { Stock } from '../../database/entities/stock.entity';
import { SharedBarcodeCatalog } from '../../database/entities/shared-barcode-catalog.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductWithVariantsDto } from './dto/create-product-with-variants.dto';
import { enforceMrpCeiling } from './utils/pricing.util';
import { InvoicesService } from '../billing/invoices.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    @InjectRepository(OrderItem) private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(SharedBarcodeCatalog) private sharedBarcodeCatalogRepository: Repository<SharedBarcodeCatalog>,
    private dataSource: DataSource,
    private invoicesService: InvoicesService,
  ) {}

  async create(dto: CreateProductDto) {
    // MRP is optional — most products (and every existing one, since it was
    // never actually captured before this) have no mrp on file, and that's
    // fine: the ceiling only applies once a real MRP is set. See update()
    // for the same guard on edits.
    const sellingPrice = dto.mrp ? enforceMrpCeiling(dto.sellingPrice, dto.mrp) : dto.sellingPrice;
    const product = this.productsRepository.create({
      business_id: dto.businessId,
      name: dto.name,
      brand: dto.brand,
      sku: dto.sku,
      barcode: dto.barcode,
      category: dto.category,
      unit: dto.unit ?? 'piece',
      purchase_price: dto.purchasePrice,
      selling_price: sellingPrice,
      mrp: dto.mrp ?? null,
      tax_percentage: dto.taxPercentage ?? 0,
      hsn_code: dto.hsnCode ?? null,
      stock_quantity: dto.stockQuantity ?? 0,
      reorder_point: dto.reorderPoint ?? null,
      batch_number: dto.batchNumber,
      expiry_date: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      generic_name: dto.genericName,
      prescription_required: dto.prescriptionRequired ?? false,
      is_schedule_h1: dto.isScheduleH1 ?? false,
      description: dto.description,
      image_url: dto.imageUrl,
      is_available: dto.isAvailable ?? true,
      is_draft: dto.isDraft ?? false,
      unit_prices: dto.unitPrices ?? null,
      custom_fields: dto.customFields ?? null,
      moq: dto.moq ?? 1,
      volume_tiers: dto.volumeTiers ?? null,
    });
    const saved = await this.productsRepository.save(product);
    if (saved.barcode) {
      await this.contributeToSharedBarcodeCatalog(saved.barcode, saved.name, saved.selling_price);
    }
    return saved;
  }

  /**
   * Cross-tenant, deliberately: the first business to name a product for a
   * given barcode teaches every other business what to suggest next time
   * they scan it (see quick-add-product-dialog.tsx). First write wins —
   * never overwrites an existing entry — and a failure here must never break
   * product creation itself.
   */
  private async contributeToSharedBarcodeCatalog(barcode: string, name: string, sellingPrice: number) {
    try {
      await this.dataSource.query(
        `INSERT INTO shared_barcode_catalog (barcode, name, suggested_price) VALUES ($1, $2, $3) ON CONFLICT (barcode) DO NOTHING`,
        [barcode, name, sellingPrice],
      );
    } catch (err) {
      console.error('[shared-barcode-catalog] contribution failed', err);
    }
  }

  /** What another business has already named this barcode, if anyone has — powers the quick-add prefill. */
  async getBarcodeSuggestion(barcode: string) {
    const entry = await this.sharedBarcodeCatalogRepository.findOne({ where: { barcode } });
    if (!entry) return null;
    return { name: entry.name, suggestedPrice: entry.suggested_price };
  }

  /**
   * Quick-Add: creates a master product together with its packaging/pricing
   * variants (e.g. 350ml / 1Ltr / 5Ltr of the same oil) in a single
   * transaction. If any variant fails to save, the whole product creation —
   * including the master row — rolls back.
   */
  async createWithVariants(dto: CreateProductWithVariantsDto) {
    return this.dataSource.transaction(async (manager) => {
      // MRP ceiling guardrail applied per-variant before anything is persisted.
      const variantInputs = dto.variants.map((v) => ({
        ...v,
        sellingPrice: enforceMrpCeiling(v.sellingPrice, v.mrp),
      }));

      const product = manager.create(Product, {
        business_id: dto.businessId,
        name: dto.name,
        brand: dto.brand,
        category: dto.category,
        tax_percentage: dto.taxPercentage ?? 0,
        description: dto.description,
        // The master product keeps a representative price (from the first
        // variant) for legacy single-price flows; the real price matrix
        // lives on product_variants.
        purchase_price: variantInputs[0].costPrice,
        selling_price: variantInputs[0].sellingPrice,
        stock_quantity: variantInputs.reduce((sum, v) => sum + (v.stockQuantity ?? 0), 0),
        is_available: true,
      });
      const savedProduct = await manager.save(Product, product);

      const variants = variantInputs.map((v) =>
        manager.create(ProductVariant, {
          business_id: dto.businessId,
          product_id: savedProduct.id,
          name: v.name,
          volume_value: v.volumeValue,
          uom: v.uom,
          sku: v.sku,
          barcode: v.barcode,
          cost_price: v.costPrice,
          mrp: v.mrp,
          selling_price: v.sellingPrice,
          stock_quantity: v.stockQuantity ?? 0,
          is_available: v.isAvailable ?? true,
        }),
      );
      const savedVariants = await manager.save(ProductVariant, variants);

      for (const v of savedVariants) {
        if (v.barcode) {
          await this.contributeToSharedBarcodeCatalog(v.barcode, `${savedProduct.name} (${v.name})`, v.selling_price);
        }
      }

      return { ...savedProduct, variants: savedVariants };
    });
  }

  private buildFindAllQuery(businessId: string, search?: string, isDraft?: string) {
    const query = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.last_supplier', 'last_supplier')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.is_archived = false');

    if (isDraft !== undefined && isDraft !== 'all') {
      query.andWhere('product.is_draft = :isDraft', { isDraft: isDraft === 'true' });
    } else if (isDraft === undefined) {
      query.andWhere('product.is_draft = false'); // default to non-drafts
    }

    if (search) {
      query.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR product.barcode ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    return query.orderBy('product.created_at', 'DESC');
  }

  // Unpaginated — returns every matching row. Kept as-is (same signature,
  // same full-array return) because callers besides the products list page
  // rely on getting the WHOLE catalog back: chat-order's catalog matching
  // (order-parser.service.ts fetches this once per message and matches
  // free-text items against all of it) and the balance/status lookups both
  // need every product, not a page of it. findAllPaginated below is the
  // opt-in alternative for the list page itself.
  findAll(businessId: string, search?: string, isDraft?: string) {
    return this.buildFindAllQuery(businessId, search, isDraft).getMany();
  }

  async findAllPaginated(businessId: string, search?: string, isDraft?: string, limit?: number, offset?: number) {
    const [products, total] = await this.buildFindAllQuery(businessId, search, isDraft)
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { products, total };
  }

  async findOne(id: string, businessId: string) {
    const product = await this.productsRepository.findOne({
      where: { id, business_id: businessId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(id: string, businessId: string, dto: UpdateProductDto) {
    const product = await this.findOne(id, businessId);
    const hadZeroPrice = Number(product.selling_price) === 0;
    // Same MRP-optional guard as create() — clamp against whichever mrp ends
    // up in effect (newly submitted, or the product's existing one if this
    // edit doesn't touch it), and only if one is actually set.
    const resolvedMrp = dto.mrp !== undefined ? dto.mrp : product.mrp;
    const resolvedSellingPrice = dto.sellingPrice ?? product.selling_price;
    const finalSellingPrice = resolvedMrp ? enforceMrpCeiling(resolvedSellingPrice, resolvedMrp) : resolvedSellingPrice;
    Object.assign(product, {
      name: dto.name ?? product.name,
      brand: dto.brand ?? product.brand,
      sku: dto.sku ?? product.sku,
      barcode: dto.barcode ?? product.barcode,
      category: dto.category ?? product.category,
      unit: dto.unit ?? product.unit,
      purchase_price: dto.purchasePrice ?? product.purchase_price,
      selling_price: finalSellingPrice,
      mrp: resolvedMrp,
      tax_percentage: dto.taxPercentage ?? product.tax_percentage,
      hsn_code: dto.hsnCode !== undefined ? dto.hsnCode : product.hsn_code,
      stock_quantity: dto.stockQuantity ?? product.stock_quantity,
      reorder_point: dto.reorderPoint !== undefined ? dto.reorderPoint : product.reorder_point,
      batch_number: dto.batchNumber ?? product.batch_number,
      expiry_date: dto.expiryDate ? new Date(dto.expiryDate) : product.expiry_date,
      generic_name: dto.genericName ?? product.generic_name,
      prescription_required: dto.prescriptionRequired !== undefined ? dto.prescriptionRequired : product.prescription_required,
      is_schedule_h1: dto.isScheduleH1 !== undefined ? dto.isScheduleH1 : product.is_schedule_h1,
      description: dto.description !== undefined ? dto.description : product.description,
      image_url: dto.imageUrl !== undefined ? dto.imageUrl : product.image_url,
      // Selling out flips is_available to false (see orders.service.ts decrementStock).
      // A plain edit that restocks a product (sends stockQuantity but not isAvailable,
      // e.g. the Wholesale Grid's edit form, which always sends *some* stockQuantity —
      // 0 for non-inventory businesses) must self-heal that flag once stock is positive
      // again, mirroring inventory.service.ts's adjustStock/receivePurchaseOrder.
      // Only auto-*enable* here, never auto-disable: a non-inventory business's edit
      // form always submits stockQuantity 0, and zeroing is_available off that would
      // wrongly hide products that were never meant to be stock-tracked. Explicit
      // sell-outs/adjustments already handle the "stock hit 0" case elsewhere.
      is_available:
        dto.isAvailable !== undefined
          ? dto.isAvailable
          : dto.stockQuantity !== undefined && dto.stockQuantity > 0
            ? true
            : product.is_available,
      is_draft: dto.isDraft !== undefined ? dto.isDraft : product.is_draft,
      unit_prices: dto.unitPrices !== undefined ? dto.unitPrices : product.unit_prices,
      custom_fields: dto.customFields !== undefined ? dto.customFields : product.custom_fields,
      moq: dto.moq !== undefined ? dto.moq : product.moq,
      volume_tiers: dto.volumeTiers !== undefined ? dto.volumeTiers : product.volume_tiers,
    });
    const saved = await this.productsRepository.save(product);

    if (hadZeroPrice && Number(saved.selling_price) > 0) {
      await this.syncZeroPricedDraftOrderItems(saved);
    }

    return saved;
  }

  /**
   * Order items snapshot their price at order time so confirmed/paid orders
   * never silently change — but an item added at ₹0 (e.g. a product created
   * without a price yet, or a Quick-Parchi item) never had a real price to
   * snapshot. Once the owner sets a real price, push it into still-draft
   * orders so they aren't stuck showing ₹0; confirmed/paid orders are left
   * alone since those are settled records.
   */
  private async syncZeroPricedDraftOrderItems(product: Product) {
    const taxPercentage = Number(product.tax_percentage);
    const newPrice = Number(product.selling_price);

    await this.dataSource.transaction(async (manager) => {
      const items = await manager
        .createQueryBuilder(OrderItem, 'item')
        .innerJoin(Order, 'order', 'order.id = item.order_id')
        .where('item.product_id = :productId', { productId: product.id })
        .andWhere('item.unit_price = 0')
        .andWhere('order.business_id = :businessId', { businessId: product.business_id })
        .andWhere('order.status = :status', { status: 'draft' })
        .getMany();

      const affectedOrderIds = new Set(items.map((i) => i.order_id));

      for (const item of items) {
        item.unit_price = newPrice;
        item.tax_percentage = taxPercentage;
        item.subtotal = newPrice * Number(item.quantity);
        item.tax_amount = item.subtotal * (taxPercentage / 100);
      }
      if (items.length) {
        await manager.save(OrderItem, items);
      }

      for (const orderId of affectedOrderIds) {
        const orderItems = await manager.find(OrderItem, { where: { order_id: orderId } });
        const totalTax = orderItems.reduce((sum, i) => sum + Number(i.tax_amount), 0);
        const totalAmount = orderItems.reduce((sum, i) => sum + Number(i.subtotal) + Number(i.tax_amount), 0);
        await manager.update(Order, { id: orderId }, { total_amount: totalAmount, tax_amount: totalTax });

        // An invoice generated while the item still had its ₹0 placeholder price
        // (nothing stops invoicing a draft order) would otherwise keep showing
        // the stale ₹0 total/line-items forever.
        await this.invoicesService.syncFromOrder(orderId, manager);
      }
    });
  }

  async remove(id: string, businessId: string) {
    const product = await this.findOne(id, businessId);
    try {
      await this.productsRepository.delete(product.id);
      return { deleted: true };
    } catch (error) {
      // If hard delete fails (e.g. foreign key constraint from order_items), soft delete it
      await this.productsRepository.update(product.id, { is_archived: true });
      return { deleted: true, softDeleted: true };
    }
  }

  /**
   * Merges a duplicate product (e.g. a near-identical spelling from OCR drift
   * on a rescanned invoice) into the surviving one: every order/purchase/price
   * history row and invoice-scan match pointing at `removeId` gets repointed
   * to `keepId`, the removed product's stock is folded into the survivor so
   * no units are silently lost, and the now-unreferenced duplicate is deleted.
   * product_variants intentionally aren't reassigned — they cascade-delete
   * with the removed product instead, since merging variant rows risks a
   * name collision with the survivor's own variants.
   */
  async mergeProducts(businessId: string, keepId: string, removeId: string) {
    if (keepId === removeId) {
      throw new BadRequestException('Cannot merge a product into itself');
    }
    const keep = await this.findOne(keepId, businessId);
    const remove = await this.findOne(removeId, businessId);

    return this.dataSource.transaction(async (manager) => {
      await manager.update(OrderItem, { product_id: remove.id }, { product_id: keep.id });
      await manager.update(PurchaseItem, { product_id: remove.id }, { product_id: keep.id });
      await manager.update(InvoiceItem, { product_id: remove.id }, { product_id: keep.id });
      await manager.update(PriceHistory, { product_id: remove.id }, { product_id: keep.id });
      await manager.update(InvoiceScanItem, { matched_product_id: remove.id }, { matched_product_id: keep.id });
      await manager.update(Stock, { product_id: remove.id }, { product_id: keep.id });

      if (Number(remove.stock_quantity) > 0) {
        await manager.increment(Product, { id: keep.id }, 'stock_quantity', Number(remove.stock_quantity));
      }
      await manager.delete(Product, { id: remove.id });

      return { merged: true, keptProductId: keep.id, removedProductId: remove.id };
    });
  }

  async adjustStock(id: string, businessId: string, delta: number) {
    const product = await this.findOne(id, businessId);
    product.stock_quantity = Number(product.stock_quantity) + delta;
    return this.productsRepository.save(product);
  }
}
