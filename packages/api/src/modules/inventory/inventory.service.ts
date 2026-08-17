import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { PurchaseItem } from '../../database/entities/purchase-item.entity';
import { Stock } from '../../database/entities/stock.entity';
import { Product } from '../../database/entities/product.entity';
import { ProductBatch } from '../../database/entities/product-batch.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Business } from '../../database/entities/business.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { SupplierReturn } from '../../database/entities/supplier-return.entity';
import { Notification } from '../../database/entities/notification.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateSupplierReturnDto } from './dto/create-supplier-return.dto';
import { findOrCreateProductByName } from '../../common/utils/find-or-create-product.util';

// A PO can never be (re-)received once it's already received, paid, or cancelled.
const NOT_RECEIVABLE_STATUSES = ['received', 'paid', 'cancelled'];
// Editing is blocked only once the order is cancelled — a dead end with no
// stock ever credited against it. 'received' and 'paid' are both still
// editable; either one triggers stock reconciliation since stock was already
// credited at the 'received' step regardless of payment status.
const NOT_EDITABLE_STATUSES = ['cancelled'];
// Statuses at which stock has already been credited — editing at either one
// needs to reconcile the quantity delta rather than skip it.
const STOCK_CREDITED_STATUSES = ['received', 'paid'];

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(PurchaseOrder) private purchaseOrdersRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseItem) private purchaseItemsRepository: Repository<PurchaseItem>,
    @InjectRepository(Stock) private stocksRepository: Repository<Stock>,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    @InjectRepository(ProductBatch) private productBatchesRepository: Repository<ProductBatch>,
    @InjectRepository(SupplierReturn) private supplierReturnsRepository: Repository<SupplierReturn>,
    private dataSource: DataSource,
  ) {}

  /**
   * Re-derives Product.batch_number/expiry_date from the batch (among this
   * product's ProductBatch rows that still have stock) with the soonest
   * expiry — called after any batch is created, topped up, or drawn down, so
   * the flat summary fields (and everything that reads them: pharmacy-grid,
   * dashboard cards) always reflect the most urgent batch rather than
   * whichever was most recently received.
   */
  private async syncProductBatchSummary(manager: EntityManager, productId: string) {
    const soonest = await manager
      .createQueryBuilder(ProductBatch, 'batch')
      .where('batch.product_id = :productId', { productId })
      .andWhere('batch.quantity > 0')
      .orderBy('batch.expiry_date', 'ASC', 'NULLS LAST')
      .limit(1)
      .getOne();

    await manager.update(Product, { id: productId }, {
      batch_number: soonest?.batch_number ?? null,
      expiry_date: soonest?.expiry_date ?? null,
    });
  }

  /**
   * Find-or-create the ProductBatch a PO line's receipt belongs to (matched
   * on product_id + batch_number + expiry_date — the same physical batch
   * arriving twice tops up rather than duplicating), crediting `quantity`
   * units into it. No-ops when the line carries neither a batch number nor
   * an expiry date (non-pharmacy businesses, or a pharmacy line entered
   * without either) — those products simply aren't batch-tracked.
   */
  private async creditReceivedBatch(
    manager: EntityManager,
    params: {
      businessId: string;
      productId: string;
      batchNumber: string | null | undefined;
      expiryDate: Date | null | undefined;
      quantity: number;
      purchasePrice: number | null | undefined;
      supplierId: string | null | undefined;
      purchaseOrderId: string;
    },
  ) {
    const { businessId, productId, batchNumber, expiryDate, quantity, purchasePrice, supplierId, purchaseOrderId } = params;
    if (!batchNumber && !expiryDate) return;

    const existing = await manager.findOne(ProductBatch, {
      where: {
        product_id: productId,
        batch_number: batchNumber ?? null,
        expiry_date: expiryDate ?? null,
      },
    });

    if (existing) {
      await manager.update(ProductBatch, { id: existing.id }, {
        quantity: () => `quantity + ${quantity}`,
        initial_quantity: () => `initial_quantity + ${quantity}`,
        ...(purchasePrice != null ? { purchase_price: purchasePrice } : {}),
      });
    } else {
      const batch = manager.create(ProductBatch, {
        business_id: businessId,
        product_id: productId,
        batch_number: batchNumber ?? null,
        expiry_date: expiryDate ?? null,
        quantity,
        initial_quantity: quantity,
        purchase_price: purchasePrice ?? null,
        supplier_id: supplierId ?? null,
        purchase_order_id: purchaseOrderId,
      });
      await manager.save(batch);
    }

    await this.syncProductBatchSummary(manager, productId);
  }

  /**
   * Applies a quantity delta (positive or negative) to the ProductBatch
   * matching product_id + batch_number + expiry_date, used when an
   * already-received PO's line items are edited. Creates the batch if a
   * positive delta doesn't match an existing one (e.g. batch details were
   * added on edit); clamps at 0 rather than going negative (extra units
   * beyond what a since-modified/depleted batch has are simply not
   * batch-tracked, matching how un-batched stock already behaves).
   */
  private async applyBatchDelta(
    manager: EntityManager,
    params: {
      businessId: string;
      productId: string;
      batchNumber: string | null | undefined;
      expiryDate: Date | null | undefined;
      delta: number;
      purchaseOrderId: string;
    },
  ) {
    const { businessId, productId, batchNumber, expiryDate, delta, purchaseOrderId } = params;
    if (!batchNumber && !expiryDate) return;

    const existing = await manager.findOne(ProductBatch, {
      where: { product_id: productId, batch_number: batchNumber ?? null, expiry_date: expiryDate ?? null },
    });

    if (existing) {
      const newQty = Math.max(0, Number(existing.quantity) + delta);
      await manager.update(ProductBatch, { id: existing.id }, { quantity: newQty });
    } else if (delta > 0) {
      const batch = manager.create(ProductBatch, {
        business_id: businessId,
        product_id: productId,
        batch_number: batchNumber ?? null,
        expiry_date: expiryDate ?? null,
        quantity: delta,
        initial_quantity: delta,
        purchase_order_id: purchaseOrderId,
      });
      await manager.save(batch);
    }

    await this.syncProductBatchSummary(manager, productId);
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const pricedItems = dto.items.map((item) => {
        const subtotal = item.quantity * item.unitPrice;
        const taxAmount = subtotal * ((item.taxPercentage ?? 0) / 100);
        return { item, subtotal, taxAmount };
      });
      const totalAmount = pricedItems.reduce((sum, p) => sum + p.subtotal + p.taxAmount, 0);
      const totalTax = pricedItems.reduce((sum, p) => sum + p.taxAmount, 0);

      const purchaseOrder = manager.create(PurchaseOrder, {
        business_id: dto.businessId,
        supplier_id: dto.supplierId,
        order_number: dto.orderNumber ?? `PO-${Date.now()}`,
        status: 'draft',
        total_amount: totalAmount,
        tax_amount: totalTax,
      });
      const saved = await manager.save(purchaseOrder);

      const items = pricedItems.map(({ item, subtotal, taxAmount }) =>
        manager.create(PurchaseItem, {
          purchase_order_id: saved.id,
          product_id: item.productId,
          supplier_id: item.supplierId ?? dto.supplierId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal,
          batch_number: item.batchNumber,
          expiry_date: item.expiryDate ? new Date(item.expiryDate) : undefined,
          hsn_code: item.hsnCode,
          scheme_quantity: item.schemeQuantity,
          tax_percentage: item.taxPercentage ?? 0,
          tax_amount: taxAmount,
        }),
      );
      await manager.save(PurchaseItem, items);

      if (dto.supplierId) {
        const supplier = await manager.findOne(Supplier, { where: { id: dto.supplierId, business_id: dto.businessId } });
        if (supplier?.linked_business_id) {
          await this.mirrorOrderToWholesaler(manager, saved, items, supplier);
        }
      }

      return { ...saved, items };
    });
  }

  /**
   * When a PurchaseOrder is raised against a Supplier linked to a real OBIX
   * business (business-connections module), auto-creates the mirrored Order
   * on that wholesaler's account so they see it in their order list with the
   * retailer's shop details, without either side re-entering the same order
   * twice. No-ops silently if the reciprocal Customer link is missing (e.g.
   * the connection was unlinked after this supplier was set up).
   */
  private async mirrorOrderToWholesaler(
    manager: EntityManager,
    purchaseOrder: PurchaseOrder,
    items: PurchaseItem[],
    supplier: Supplier,
  ) {
    const customer = await manager.findOne(Customer, {
      where: { business_id: supplier.linked_business_id, linked_business_id: purchaseOrder.business_id },
    });
    if (!customer) return;

    const retailerBusiness = await manager.findOne(Business, { where: { id: purchaseOrder.business_id } });

    let totalAmount = 0;
    let totalTax = 0;
    const orderItems: OrderItem[] = [];

    for (const item of items) {
      const sourceProduct = item.product_id ? await manager.findOne(Product, { where: { id: item.product_id } }) : null;
      const product = await findOrCreateProductByName(
        manager,
        supplier.linked_business_id,
        sourceProduct?.name ?? 'Item',
        sourceProduct?.unit,
        Number(item.unit_price),
        Number(item.tax_percentage),
      );

      const quantity = Number(item.quantity);
      const subtotal = quantity * Number(item.unit_price);
      const taxAmount = subtotal * (Number(item.tax_percentage) / 100);
      totalAmount += subtotal + taxAmount;
      totalTax += taxAmount;

      orderItems.push(
        manager.create(OrderItem, {
          product_id: product.id,
          quantity,
          unit: product.unit,
          unit_price: item.unit_price,
          subtotal,
          tax_percentage: item.tax_percentage,
          tax_amount: taxAmount,
        }),
      );

      // Same floor-at-0 behavior as OrdersService.decrementStock — the full
      // synced quantity still ships, but stock_quantity never goes negative.
      const remaining = Math.max(0, Number(product.stock_quantity) - quantity);
      await manager.update(Product, { id: product.id }, { stock_quantity: remaining, is_available: remaining > 0 });
    }

    const order = manager.create(Order, {
      business_id: supplier.linked_business_id,
      customer_id: customer.id,
      customer_name: retailerBusiness?.name ?? customer.name,
      order_number: `ORD-${Date.now()}`,
      order_type: 'regular',
      status: 'confirmed',
      origin: 'synced',
      mirrored_purchase_order_id: purchaseOrder.id,
      total_amount: totalAmount,
      tax_amount: totalTax,
      notes: `Synced from purchase order ${purchaseOrder.order_number} placed by ${retailerBusiness?.name ?? 'a linked retailer'} via OBIX.`,
    });
    const savedOrder = await manager.save(order);
    orderItems.forEach((orderItem) => (orderItem.order_id = savedOrder.id));
    await manager.save(OrderItem, orderItems);

    await manager.save(
      Notification,
      manager.create(Notification, {
        business_id: supplier.linked_business_id,
        type: 'order_synced',
        message: `${retailerBusiness?.name ?? 'A linked retailer'} placed a new order (${savedOrder.order_number}) via OBIX.`,
      }),
    );
  }

  /**
   * Backfills the mirror for a PurchaseOrder that was raised against this
   * Supplier *before* the business-connections link existed — called from
   * BusinessConnectionsService.accept() once the Supplier is linked, since
   * mirrorOrderToWholesaler only ever runs at PO-creation time and had
   * nothing to attach to back then. No-ops if a mirror already exists.
   */
  async mirrorExistingPurchaseOrderToWholesaler(manager: EntityManager, purchaseOrder: PurchaseOrder, supplier: Supplier) {
    const alreadyMirrored = await manager.findOne(Order, { where: { mirrored_purchase_order_id: purchaseOrder.id } });
    if (alreadyMirrored) return;

    const items = await manager.find(PurchaseItem, { where: { purchase_order_id: purchaseOrder.id } });
    await this.mirrorOrderToWholesaler(manager, purchaseOrder, items, supplier);
  }

  findAllPurchaseOrders(businessId: string, status?: string) {
    const where: Record<string, any> = { business_id: businessId };
    if (status) {
      where.status = status;
    }
    return this.purchaseOrdersRepository.find({ 
      where, 
      order: { created_at: 'DESC' },
      relations: { items: { product: true } }
    });
  }

  async findOnePurchaseOrder(id: string, businessId: string) {
    const order = await this.purchaseOrdersRepository.findOne({ where: { id, business_id: businessId } });
    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }
    const items = await this.purchaseItemsRepository.find({ where: { purchase_order_id: id } });
    return { ...order, items };
  }

  /**
   * Receiving a purchase order stocks-in each item and bumps product
   * stock_quantity. The status flip to 'received' is done as a single
   * conditional UPDATE (not read-then-write) so two concurrent requests
   * can't both pass the "not yet received" check and double-credit stock.
   * The guard also blocks re-receiving an order that's already paid or
   * cancelled, not just already-received.
   */
  async receivePurchaseOrder(id: string, businessId: string) {
    return this.dataSource.transaction(async (manager) => {
      const updateResult = await manager
        .createQueryBuilder()
        .update(PurchaseOrder)
        .set({ status: 'received' })
        .where('id = :id AND business_id = :businessId AND status NOT IN (:...locked)', {
          id,
          businessId,
          locked: NOT_RECEIVABLE_STATUSES,
        })
        .execute();

      if (updateResult.affected === 0) {
        const exists = await manager.findOne(PurchaseOrder, { where: { id, business_id: businessId } });
        if (!exists) {
          throw new NotFoundException('Purchase order not found');
        }
        throw new BadRequestException(`Purchase order is already ${exists.status} and cannot be received`);
      }

      const order = await manager.findOne(PurchaseOrder, { where: { id, business_id: businessId } });
      if (!order) {
        throw new NotFoundException('Purchase order not found');
      }

      const items = await manager.find(PurchaseItem, { where: { purchase_order_id: id } });

      for (const item of items) {
        if (item.product_id) {
          await manager.increment(Product, { id: item.product_id }, 'stock_quantity', Number(item.quantity));
          // Set is_available to true since stock was added, and update last-supplier if present.
          // batch_number/expiry_date are no longer set directly here — creditReceivedBatch
          // below credits a ProductBatch row and re-derives them from the soonest-expiry batch.
          await manager.update(
            Product,
            { id: item.product_id },
            {
              is_available: true,
              ...(item.supplier_id ? { last_supplier_id: item.supplier_id } : {}),
            },
          );
          await this.creditReceivedBatch(manager, {
            businessId,
            productId: item.product_id,
            batchNumber: item.batch_number,
            expiryDate: item.expiry_date,
            quantity: Number(item.quantity),
            purchasePrice: item.unit_price != null ? Number(item.unit_price) : null,
            supplierId: item.supplier_id ?? order.supplier_id,
            purchaseOrderId: order.id,
          });
        }
        const stock = manager.create(Stock, {
          business_id: businessId,
          product_id: item.product_id,
          type: 'IN',
          quantity: Number(item.quantity),
          reference: order.order_number,
          notes: 'Purchase order received',
        });
        await manager.save(stock);
      }

      return order;
    });
  }

  /** draft -> confirmed. No stock impact — same as draft, just a lightweight "sent to supplier" marker. */
  async confirmPurchaseOrder(id: string, businessId: string) {
    return this.transitionStatus(id, businessId, ['draft'], 'confirmed');
  }

  /** received -> paid. Terminal bookkeeping state, no further stock impact. */
  async markPurchaseOrderPaid(id: string, businessId: string) {
    return this.transitionStatus(id, businessId, ['received'], 'paid');
  }

  /** draft/confirmed -> cancelled. Never reachable from received/paid — there's no un-receive logic. */
  async cancelPurchaseOrder(id: string, businessId: string) {
    return this.transitionStatus(id, businessId, ['draft', 'confirmed'], 'cancelled');
  }

  /** Shared conditional-UPDATE transition, same race-safe pattern as receivePurchaseOrder. */
  private async transitionStatus(id: string, businessId: string, from: string[], to: string) {
    const updateResult = await this.dataSource
      .createQueryBuilder()
      .update(PurchaseOrder)
      .set({ status: to })
      .where('id = :id AND business_id = :businessId AND status IN (:...from)', { id, businessId, from })
      .execute();

    if (updateResult.affected === 0) {
      const exists = await this.purchaseOrdersRepository.findOne({ where: { id, business_id: businessId } });
      if (!exists) {
        throw new NotFoundException('Purchase order not found');
      }
      throw new BadRequestException(`Cannot mark ${exists.status} purchase order as ${to}`);
    }

    return this.purchaseOrdersRepository.findOne({ where: { id, business_id: businessId } });
  }

  /**
   * Edits a purchase order's supplier/order-number/line-items. Blocked only
   * once the order is cancelled. If the order is still draft/confirmed,
   * editing has no stock impact (same as create — nothing's been credited
   * yet). If the order is already received OR paid, each line's quantity
   * delta is applied to the product's stock_quantity (increment supports
   * negative deltas), batch/expiry/last-supplier are re-applied if changed,
   * and a compensating Stock ledger row is written — mirroring
   * receivePurchaseOrder's own stock-in logic but for a delta instead of the
   * full quantity. 'paid' still reconciles stock because the actual stock
   * credit happened back at the 'received' step — payment status doesn't
   * change that.
   *
   * Uses a pessimistic write lock (rather than receive's blind conditional
   * UPDATE) because this needs to read the existing items to diff against,
   * not just flip one status column.
   */
  async updatePurchaseOrder(id: string, businessId: string, dto: UpdatePurchaseOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(PurchaseOrder, {
        where: { id, business_id: businessId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new NotFoundException('Purchase order not found');
      }
      if (NOT_EDITABLE_STATUSES.includes(order.status)) {
        throw new BadRequestException(`Cannot edit a purchase order that is ${order.status}`);
      }

      const existingItems = await manager.find(PurchaseItem, { where: { purchase_order_id: id } });
      const existingById = new Map(existingItems.map((i) => [i.id, i]));
      const incomingIds = new Set(dto.items.filter((i) => i.id).map((i) => i.id));

      const stockAlreadyCredited = STOCK_CREDITED_STATUSES.includes(order.status);
      const priced = dto.items.map((item) => {
        const subtotal = item.quantity * item.unitPrice;
        const taxAmount = subtotal * ((item.taxPercentage ?? 0) / 100);
        const existing = item.id ? existingById.get(item.id) : undefined;
        const qtyDelta = existing ? item.quantity - Number(existing.quantity) : item.quantity;
        return { item, subtotal, taxAmount, existing, qtyDelta };
      });

      // Removed lines (existing but absent from the incoming array) count as a
      // full-negative delta against whatever stock they'd contributed.
      const removed = existingItems.filter((e) => !incomingIds.has(e.id));

      if (stockAlreadyCredited) {
        for (const r of removed) {
          if (!r.product_id) continue;
          const delta = -Number(r.quantity);
          await this.applyStockDelta(manager, businessId, order.order_number, r.product_id, delta);
          await this.applyBatchDelta(manager, {
            businessId,
            productId: r.product_id,
            batchNumber: r.batch_number,
            expiryDate: r.expiry_date,
            delta,
            purchaseOrderId: order.id,
          });
        }
        for (const { item, existing, qtyDelta } of priced) {
          if (!item.productId || qtyDelta === 0) continue;
          await this.applyStockDelta(manager, businessId, order.order_number, item.productId, qtyDelta);
          await this.applyBatchDelta(manager, {
            businessId,
            productId: item.productId,
            batchNumber: item.batchNumber ?? existing?.batch_number,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : existing?.expiry_date,
            delta: qtyDelta,
            purchaseOrderId: order.id,
          });
          const supplierId = item.supplierId ?? existing?.supplier_id;
          await manager.update(
            Product,
            { id: item.productId },
            {
              ...(supplierId ? { last_supplier_id: supplierId } : {}),
            },
          );
        }
      }

      await manager.remove(PurchaseItem, removed);

      const savedItems: PurchaseItem[] = [];
      for (const { item, subtotal, taxAmount, existing } of priced) {
        const values = {
          purchase_order_id: id,
          product_id: item.productId,
          supplier_id: item.supplierId ?? dto.supplierId ?? existing?.supplier_id,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal,
          batch_number: item.batchNumber,
          expiry_date: item.expiryDate ? new Date(item.expiryDate) : undefined,
          hsn_code: item.hsnCode,
          scheme_quantity: item.schemeQuantity,
          tax_percentage: item.taxPercentage ?? 0,
          tax_amount: taxAmount,
        };
        const saved = existing
          ? await manager.save(PurchaseItem, { ...existing, ...values })
          : await manager.save(manager.create(PurchaseItem, values));
        savedItems.push(saved);
      }

      const totalAmount = priced.reduce((sum, p) => sum + p.subtotal + p.taxAmount, 0);
      const totalTax = priced.reduce((sum, p) => sum + p.taxAmount, 0);
      await manager.update(PurchaseOrder, { id }, {
        supplier_id: dto.supplierId ?? order.supplier_id,
        order_number: dto.orderNumber ?? order.order_number,
        total_amount: totalAmount,
        tax_amount: totalTax,
      });

      const updatedOrder = await manager.findOne(PurchaseOrder, { where: { id, business_id: businessId } });
      return { ...updatedOrder, items: savedItems };
    });
  }

  /**
   * Shared delta application for updatePurchaseOrder — same shape as
   * adjustStock: an atomic increment for the actual stock change, a
   * separately-computed is_available sync, guarding against negative stock,
   * and a Stock ledger row.
   */
  private async applyStockDelta(manager: EntityManager, businessId: string, orderNumber: string, productId: string, delta: number) {
    const product = await manager.findOne(Product, { where: { id: productId } });
    if (!product) return;
    const newStock = Number(product.stock_quantity) + delta;
    if (newStock < 0) {
      throw new BadRequestException(`Editing this purchase order would reduce "${product.name}" stock below zero`);
    }
    await manager.increment(Product, { id: productId }, 'stock_quantity', delta);
    await manager.update(Product, { id: productId }, { is_available: newStock > 0 });
    const stock = manager.create(Stock, {
      business_id: businessId,
      product_id: productId,
      type: delta >= 0 ? 'IN' : 'OUT',
      quantity: Math.abs(delta),
      reference: orderNumber,
      notes: 'Purchase order edited after receipt',
    });
    await manager.save(stock);
  }

  async adjustStock(dto: AdjustStockDto) {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id: dto.productId, business_id: dto.businessId },
      });
      if (!product) {
        throw new NotFoundException('Product not found');
      }

      const delta = dto.type === 'IN' ? dto.quantity : -dto.quantity;
      if (dto.type === 'OUT' && Number(product.stock_quantity) < dto.quantity) {
        throw new BadRequestException('Insufficient stock for this adjustment');
      }

      await manager.increment(Product, { id: product.id }, 'stock_quantity', delta);

      // Set is_available dynamically based on the updated stock quantity
      const newStock = Number(product.stock_quantity) + delta;
      await manager.update(
        Product,
        { id: product.id },
        { is_available: newStock > 0 },
      );

      if (dto.batchId) {
        const batch = await manager.findOne(ProductBatch, {
          where: { id: dto.batchId, business_id: dto.businessId, product_id: dto.productId },
        });
        if (!batch) {
          throw new NotFoundException('Batch not found');
        }
        if (dto.type === 'OUT' && Number(batch.quantity) < dto.quantity) {
          throw new BadRequestException('Insufficient quantity remaining in this batch');
        }
        const newBatchQty = Number(batch.quantity) + delta;
        await manager.update(ProductBatch, { id: batch.id }, { quantity: newBatchQty });
        await this.syncProductBatchSummary(manager, dto.productId);
      }

      const stock = manager.create(Stock, {
        business_id: dto.businessId,
        product_id: dto.productId,
        type: dto.type,
        quantity: dto.quantity,
        reference: dto.reference,
        notes: dto.reason ? `${dto.notes ?? ''} (${dto.reason})`.trim() : dto.notes,
      });
      return manager.save(stock);
    });
  }

  /**
   * Sends expired/damaged/wrong-item stock back to the supplier it came
   * from: decrements Product/ProductBatch stock the same way a plain
   * write-off does (reuses adjustStock's OUT path), but also records a
   * SupplierReturn row — the register a distributor reconciliation or an
   * inspection actually needs, which adjustStock's generic Stock ledger row
   * has no supplier/amount/reason fields for.
   */
  async returnToSupplier(dto: CreateSupplierReturnDto) {
    return this.dataSource.transaction(async (manager) => {
      const supplier = await manager.findOne(Supplier, { where: { id: dto.supplierId, business_id: dto.businessId } });
      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
      const product = await manager.findOne(Product, { where: { id: dto.productId, business_id: dto.businessId } });
      if (!product) {
        throw new NotFoundException('Product not found');
      }
      if (Number(product.stock_quantity) < dto.quantity) {
        throw new BadRequestException('Insufficient stock for this return');
      }

      await manager.increment(Product, { id: product.id }, 'stock_quantity', -dto.quantity);
      const newStock = Number(product.stock_quantity) - dto.quantity;
      await manager.update(Product, { id: product.id }, { is_available: newStock > 0 });

      let batchNumber = dto.batchNumber ?? null;
      if (dto.batchId) {
        const batch = await manager.findOne(ProductBatch, {
          where: { id: dto.batchId, business_id: dto.businessId, product_id: dto.productId },
        });
        if (!batch) {
          throw new NotFoundException('Batch not found');
        }
        if (Number(batch.quantity) < dto.quantity) {
          throw new BadRequestException('Insufficient quantity remaining in this batch');
        }
        await manager.update(ProductBatch, { id: batch.id }, { quantity: Number(batch.quantity) - dto.quantity });
        await this.syncProductBatchSummary(manager, dto.productId);
        batchNumber = batch.batch_number;
      }

      await manager.save(
        manager.create(Stock, {
          business_id: dto.businessId,
          product_id: dto.productId,
          type: 'OUT',
          quantity: dto.quantity,
          reference: dto.purchaseOrderId,
          notes: `Returned to supplier: ${supplier.name} (${dto.reason})${dto.notes ? ` — ${dto.notes}` : ''}`,
        }),
      );

      const supplierReturn = manager.create(SupplierReturn, {
        business_id: dto.businessId,
        supplier_id: dto.supplierId,
        product_id: dto.productId,
        purchase_order_id: dto.purchaseOrderId ?? null,
        batch_number: batchNumber,
        quantity: dto.quantity,
        unit_price: dto.unitPrice,
        amount: dto.quantity * dto.unitPrice,
        reason: dto.reason,
        status: 'pending',
        notes: dto.notes ?? null,
      });
      return manager.save(supplierReturn);
    });
  }

  listSupplierReturns(businessId: string, supplierId?: string, from?: string, to?: string) {
    const query = this.supplierReturnsRepository
      .createQueryBuilder('sr')
      .leftJoinAndSelect('sr.supplier', 'supplier')
      .leftJoinAndSelect('sr.product', 'product')
      .where('sr.business_id = :businessId', { businessId });
    if (supplierId) query.andWhere('sr.supplier_id = :supplierId', { supplierId });
    if (from) query.andWhere('sr.created_at >= :from', { from });
    if (to) query.andWhere('sr.created_at <= :to', { to });
    return query.orderBy('sr.created_at', 'DESC').getMany();
  }

  async updateSupplierReturnStatus(id: string, businessId: string, status: 'pending' | 'credited') {
    const supplierReturn = await this.supplierReturnsRepository.findOne({ where: { id, business_id: businessId } });
    if (!supplierReturn) {
      throw new NotFoundException('Supplier return not found');
    }
    supplierReturn.status = status;
    return this.supplierReturnsRepository.save(supplierReturn);
  }

  findProductBatches(productId: string, businessId: string) {
    return this.productBatchesRepository
      .createQueryBuilder('batch')
      .where('batch.product_id = :productId', { productId })
      .andWhere('batch.business_id = :businessId', { businessId })
      .orderBy('batch.expiry_date', 'ASC', 'NULLS LAST')
      .getMany();
  }

  findStockHistory(businessId: string, productId?: string) {
    const where: Record<string, any> = { business_id: businessId };
    if (productId) {
      where.product_id = productId;
    }
    return this.stocksRepository.find({ where, order: { created_at: 'DESC' } });
  }

  // threshold is the fallback for products with no manually-set reorder_point
  // (COALESCE) — a product's own reorder_point always wins when set.
  lowStock(businessId: string, threshold = 10) {
    return this.productsRepository
      .createQueryBuilder('product')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.stock_quantity <= COALESCE(product.reorder_point, :threshold)', { threshold })
      .orderBy('product.stock_quantity', 'ASC')
      .getMany();
  }
}
