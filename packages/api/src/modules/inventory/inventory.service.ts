import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { PurchaseItem } from '../../database/entities/purchase-item.entity';
import { Stock } from '../../database/entities/stock.entity';
import { Product } from '../../database/entities/product.entity';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

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
    private dataSource: DataSource,
  ) {}

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
          scheme_quantity: item.schemeQuantity,
          tax_percentage: item.taxPercentage ?? 0,
          tax_amount: taxAmount,
        }),
      );
      await manager.save(PurchaseItem, items);

      return { ...saved, items };
    });
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
          // Set is_available to true since stock was added, and update latest batch/expiry/last-supplier if present.
          await manager.update(
            Product,
            { id: item.product_id },
            {
              is_available: true,
              ...(item.batch_number ? { batch_number: item.batch_number } : {}),
              ...(item.expiry_date ? { expiry_date: item.expiry_date } : {}),
              ...(item.supplier_id ? { last_supplier_id: item.supplier_id } : {}),
            },
          );
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
        }
        for (const { item, existing, qtyDelta } of priced) {
          if (!item.productId || qtyDelta === 0) continue;
          await this.applyStockDelta(manager, businessId, order.order_number, item.productId, qtyDelta);
          const supplierId = item.supplierId ?? existing?.supplier_id;
          await manager.update(
            Product,
            { id: item.productId },
            {
              ...(item.batchNumber ? { batch_number: item.batchNumber } : {}),
              ...(item.expiryDate ? { expiry_date: new Date(item.expiryDate) } : {}),
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

      const stock = manager.create(Stock, {
        business_id: dto.businessId,
        product_id: dto.productId,
        type: dto.type,
        quantity: dto.quantity,
        reference: dto.reference,
        notes: dto.notes,
      });
      return manager.save(stock);
    });
  }

  findStockHistory(businessId: string, productId?: string) {
    const where: Record<string, any> = { business_id: businessId };
    if (productId) {
      where.product_id = productId;
    }
    return this.stocksRepository.find({ where, order: { created_at: 'DESC' } });
  }

  lowStock(businessId: string, threshold = 10) {
    return this.productsRepository
      .createQueryBuilder('product')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.stock_quantity <= :threshold', { threshold })
      .orderBy('product.stock_quantity', 'ASC')
      .getMany();
  }
}
