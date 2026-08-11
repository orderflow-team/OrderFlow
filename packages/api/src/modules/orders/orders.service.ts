import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In, Like } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Product } from '../../database/entities/product.entity';
import { PriceHistory } from '../../database/entities/price-history.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Ledger } from '../../database/entities/ledger.entity';
import { Table } from '../../database/entities/table.entity';
import { KOT } from '../../database/entities/kot.entity';
import { Stock } from '../../database/entities/stock.entity';
import { ProductBatch } from '../../database/entities/product-batch.entity';
import { Business } from '../../database/entities/business.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { InvoiceItem } from '../../database/entities/invoice-item.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Notification } from '../../database/entities/notification.entity';
import { CreateOrderDto, CreateOrderItemDto, AddOrderItemsDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { InvoicesService } from '../billing/invoices.service';

/** Internal marker item used to open a table session before real items are added — never a real product. */
const TABLE_SESSION_PLACEHOLDER_ITEM = 'table session started';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    @InjectRepository(PriceHistory) private priceHistoryRepository: Repository<PriceHistory>,
    @InjectRepository(Customer) private customersRepository: Repository<Customer>,
    @InjectRepository(Ledger) private ledgerRepository: Repository<Ledger>,
    private dataSource: DataSource,
    private invoicesService: InvoicesService,
  ) {}

  /**
   * Draws down a customer's advance credit (see PaymentsService.recordAdvance)
   * against a just-billed order, up to whatever's still unpaid on it. Called
   * right after a debit is posted so credit from a prior overpayment is spent
   * automatically instead of sitting idle while new debt piles up alongside it.
   * Returns true if the order is now fully covered (caller may want to flip
   * its status to 'paid').
   */
  private async applyAdvanceCredit(
    manager: EntityManager,
    businessId: string,
    customerId: string,
    order: Order,
  ): Promise<boolean> {
    const customer = await manager.findOne(Customer, { where: { id: customerId, business_id: businessId } });
    const advanceBalance = Number(customer?.advance_balance || 0);
    if (advanceBalance <= 0) return false;

    const paidAgg = await manager
      .createQueryBuilder(Payment, 'payment')
      .where('payment.order_id = :orderId', { orderId: order.id })
      .select('SUM(payment.amount)', 'total')
      .getRawOne();
    const orderRemaining = Math.max(0, Number(order.total_amount) - Number(paidAgg.total || 0));
    if (orderRemaining <= 0.01) return true;

    const chunk = Math.min(advanceBalance, orderRemaining);
    if (chunk <= 0.01) return false;

    await manager.increment(Customer, { id: customerId }, 'advance_balance', -chunk);
    await manager.increment(Customer, { id: customerId }, 'outstanding_amount', -chunk);
    await manager.save(
      Ledger,
      manager.create(Ledger, {
        business_id: businessId,
        customer_id: customerId,
        type: 'CREDIT',
        amount: chunk,
        description: `Advance credit applied to order ${order.order_number}`,
      }),
    );
    await manager.save(
      Payment,
      manager.create(Payment, {
        business_id: businessId,
        order_id: order.id,
        amount: chunk,
        payment_method: 'Advance Credit',
        status: 'completed',
      }),
    );

    return chunk >= orderRemaining - 0.01;
  }

  /**
   * Customer-wise "Smart Pricing": last price this customer paid for this
   * product (or free-text item), so order entry can auto-suggest it.
   */
  async suggestPrice(businessId: string, customerId: string | undefined, item: CreateOrderItemDto) {
    if (!customerId) {
      return null;
    }

    const where: Record<string, any> = { business_id: businessId, customer_id: customerId };
    if (item.productId) {
      where.product_id = item.productId;
    } else if (item.customProductName) {
      where.custom_product_name = item.customProductName;
    } else {
      return null;
    }

    const last = await this.priceHistoryRepository.findOne({
      where,
      order: { created_at: 'DESC' },
    });

    return last ? Number(last.price) : null;
  }

  /** Resolves price and, if linked to a real product, its GST tax_percentage. */
  private async resolveItemPricing(businessId: string, customerId: string | undefined, item: CreateOrderItemDto) {
    let product: Product | null = null;
    if (item.productId) {
      product = await this.productsRepository.findOne({
        where: { id: item.productId, business_id: businessId },
      });
    }

    if (item.unitPrice !== undefined) {
      return { unitPrice: item.unitPrice, taxPercentage: Number(product?.tax_percentage ?? 0) };
    }

    const suggested = await this.suggestPrice(businessId, customerId, item);
    if (suggested !== null) {
      return { unitPrice: suggested, taxPercentage: Number(product?.tax_percentage ?? 0) };
    }

    if (product) {
      let unitPrice = Number(product.selling_price);
      if (Array.isArray(product.volume_tiers) && product.volume_tiers.length > 0) {
        const sortedTiers = [...product.volume_tiers].sort((a, b) => Number(b.minQty) - Number(a.minQty));
        const matchedTier = sortedTiers.find((t) => Number(item.quantity) >= Number(t.minQty));
        if (matchedTier && matchedTier.price !== undefined) {
          unitPrice = Number(matchedTier.price);
        }
      }
      return { unitPrice, taxPercentage: Number(product.tax_percentage) };
    }

    throw new BadRequestException(
      `No price found for item "${item.customProductName || item.productId}". Provide unitPrice explicitly.`,
    );
  }

  /**
   * Quick Parchi Mode: items may reference an existing product (productId)
   * or be pure free text (customProductName) — product master is optional.
   * Tax is computed on top of each item's price using the linked product's
   * GST tax_percentage (free-text items have no tax, since there's no rate to apply).
   */
  async create(dto: CreateOrderDto, createdByUserId?: string) {
    // Idempotency: a queued offline sale can be retried (e.g. the sync request
    // succeeded server-side but the client never saw the response before
    // going offline again) — recognize the same clientRequestId instead of
    // creating a second order.
    if (dto.clientRequestId) {
      const existing = await this.ordersRepository.findOne({
        where: { business_id: dto.businessId, client_request_id: dto.clientRequestId },
      });
      if (existing) {
        return { ...existing, items: await this.orderItemsRepository.find({ where: { order_id: existing.id }, relations: { product: true } }) };
      }
    }
    return this.dataSource.transaction(async (manager) => {
      const orderNumber = `ORD-${Date.now()}`;
      const business = await manager.findOne(Business, { where: { id: dto.businessId } });
      const inventoryEnabled = business?.inventory_enabled !== false;
      const allowOrdersBeyondStock = business?.allow_orders_beyond_stock !== false;

      let resolvedCustomerId = dto.customerId;
      // If phone provided, look up customer by phone first (phone is unique identifier)
      if (dto.phone && !resolvedCustomerId) {
        const byPhone = await manager.findOne(Customer, {
          where: { business_id: dto.businessId, phone: dto.phone }
        });
        if (byPhone) resolvedCustomerId = byPhone.id;
      }
      if (!resolvedCustomerId && dto.customerName && dto.customerName.toLowerCase() !== 'guest' && dto.customerName.toLowerCase() !== 'take away guest' && !dto.customerName.toLowerCase().startsWith('table')) {
        let customer = await manager.findOne(Customer, {
          where: { business_id: dto.businessId, name: dto.customerName }
        });
        if (!customer) {
          customer = manager.create(Customer, {
            business_id: dto.businessId,
            name: dto.customerName,
            phone: dto.phone,
          });
          customer = await manager.save(Customer, customer);
        } else if (dto.phone && !customer.phone) {
          // Save phone to existing customer if they didn't have one
          customer.phone = dto.phone;
          await manager.save(Customer, customer);
        }
        resolvedCustomerId = customer.id;
      } else if (resolvedCustomerId && dto.phone) {
        // Customer matched by phone or ID — ensure phone is saved on their record
        const existing = await manager.findOne(Customer, { where: { id: resolvedCustomerId } });
        if (existing && !existing.phone) {
          existing.phone = dto.phone;
          await manager.save(Customer, existing);
        }
      }

      let totalAmount = 0;
      let totalTax = 0;
      const resolvedItems: Array<{
        item: CreateOrderItemDto;
        unitPrice: number;
        subtotal: number;
        taxPercentage: number;
        taxAmount: number;
      }> = [];
      // Guards against two items in the same order with the same custom name
      // (e.g. two "Maggi" lines) creating two separate Product rows.
      const newlyCreatedProductIds = new Map<string, string>();
      const shortfalls: { productName: string; requested: number; fulfilled: number }[] = [];

      for (const item of dto.items) {
        if (!item.productId && !item.customProductName) {
          throw new BadRequestException('Each item needs either productId or customProductName');
        }
        const clientProvidedProductId = !!item.productId;

        if (clientProvidedProductId && inventoryEnabled && dto.orderType !== 'dine_in' && dto.orderType !== 'take_away') {
          const requestedQuantity = Number(item.quantity);
          const { fulfilled, productName } = await this.decrementStock(manager, dto.businessId, item.productId!, requestedQuantity, orderNumber, allowOrdersBeyondStock);
          if (fulfilled < requestedQuantity) {
            shortfalls.push({ productName, requested: requestedQuantity, fulfilled });
          }
          if (fulfilled === 0) {
            continue; // nothing in stock — leave this item out of the order entirely
          }
          item.quantity = fulfilled;
        }

        const { unitPrice, taxPercentage } = await this.resolveItemPricing(dto.businessId, dto.customerId, item);
        const subtotal = Number(unitPrice) * Number(item.quantity);
        const taxAmount = subtotal * (taxPercentage / 100);
        totalAmount += subtotal + taxAmount;
        totalTax += taxAmount;

        // Quick Parchi items are free text by default; auto-create a Product
        // master row the first time a name is used so it appears as a normal
        // option in the dropdown on the next order. Skip the table-session
        // placeholder marker — it's not a real sellable item.
        const nameKey = item.customProductName?.trim().toLowerCase();
        if (!item.productId && item.customProductName && nameKey !== TABLE_SESSION_PLACEHOLDER_ITEM) {
          let linkedProductId = newlyCreatedProductIds.get(nameKey);
          if (!linkedProductId) {
            linkedProductId = await this.findOrCreateProductFromCustomName(
              manager,
              dto.businessId,
              item.customProductName,
              item.unit,
              unitPrice,
              taxPercentage,
            );
            newlyCreatedProductIds.set(nameKey, linkedProductId);
          }
          item.productId = linkedProductId;
        }

        resolvedItems.push({ item, unitPrice, subtotal, taxPercentage, taxAmount });
      }

      let tokenNumber: number | null = null;
      let resolvedCustomerName = dto.customerName;
      if (dto.orderType === 'take_away') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { max } = await manager
          .getRepository(Order)
          .createQueryBuilder('order')
          .select('MAX(order.token_number)', 'max')
          .where('order.business_id = :businessId', { businessId: dto.businessId })
          .andWhere("order.order_type = 'take_away'")
          .andWhere('order.created_at >= :startOfDay', { startOfDay })
          .getRawOne();
        tokenNumber = (max ?? 0) + 1;

        const isDefaultName = !dto.customerName || 
          dto.customerName.trim() === '' || 
          dto.customerName.toLowerCase() === 'take away guest' || 
          dto.customerName.toLowerCase() === 'guest';
        if (isDefaultName) {
          resolvedCustomerName = `Takeaway #${tokenNumber}`;
        }
      }

      const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      const createdByUserUuid = createdByUserId && isUuid(createdByUserId) ? createdByUserId : null;

      const order = manager.create(Order, {
        business_id: dto.businessId,
        customer_id: resolvedCustomerId,
        customer_name: resolvedCustomerName,
        table_id: dto.tableId,
        guest_count: dto.guestCount,
        order_number: orderNumber,
        token_number: tokenNumber,
        order_type: dto.orderType ?? 'regular',
        status: 'draft',
        total_amount: totalAmount,
        tax_amount: totalTax,
        notes: dto.notes,
        patient_name: dto.patientName,
        doctor_name: dto.doctorName,
        created_by_user_id: createdByUserUuid,
        client_request_id: dto.clientRequestId,
      });
      const savedOrder = await manager.save(order);

      if (shortfalls.length > 0) {
        await manager.save(
          Notification,
          manager.create(Notification, {
            business_id: dto.businessId,
            type: 'stock_shortfall',
            message: this.buildShortfallMessage(resolvedCustomerName, orderNumber, shortfalls),
          }),
        );
      }

      if (dto.tableId) {
        await manager.update(Table, { id: dto.tableId }, { status: 'occupied' });
      }

      let kotId: string | null = null;
      const hasRealItems = dto.items.some(
        (i) => i.customProductName?.trim().toLowerCase() !== TABLE_SESSION_PLACEHOLDER_ITEM
      );

      if (hasRealItems) {
        const kot = manager.create(KOT, {
          business_id: dto.businessId,
          order_id: savedOrder.id,
          table_id: dto.tableId || null,
          status: 'pending',
        });
        const savedKot = await manager.save(KOT, kot);
        kotId = savedKot.id;
      }

      const orderItems = resolvedItems.map(({ item, unitPrice, subtotal, taxPercentage, taxAmount }) =>
        manager.create(OrderItem, {
          order_id: savedOrder.id,
          product_id: item.productId,
          custom_product_name: item.customProductName,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: unitPrice,
          subtotal,
          tax_percentage: taxPercentage,
          tax_amount: taxAmount,
          kot_id: kotId,
        }),
      );
      await manager.save(OrderItem, orderItems);

      return { ...savedOrder, items: await manager.find(OrderItem, { where: { order_id: savedOrder.id }, relations: { product: true } }) };
    });
  }

  /**
   * Decrements stock for a catalog product the caller explicitly selected
   * (never for a Quick-Parchi free-text item auto-linked to a fresh
   * zero-stock draft product — that would break the "sell without inventory
   * tracking" workflow those exist for). By default (allowBeyondStock=true,
   * matching Business.allow_orders_beyond_stock), clamps to whatever is
   * actually available instead of rejecting the whole order — requesting 5
   * with only 2 in stock sells 2, not zero — and flips the product to "out
   * of stock" (is_available = false) the moment stock hits zero. When a
   * business has turned that off, an order exceeding available stock is
   * rejected outright instead of being silently clamped. Locks the product
   * row for the rest of this transaction (pessimistic write) rather than the
   * old lock-free conditional UPDATE, since the fulfilled quantity now
   * depends on a prior read that must not race with another order against
   * the same row. Returns the quantity actually fulfilled (0 if none
   * available) so the caller can price/persist the order item against what
   * was really sold.
   */
  /**
   * Draws `quantity` units down from a product's ProductBatch rows,
   * soonest-expiry first (FEFO), then re-derives Product.batch_number/
   * expiry_date from whichever batch now has the soonest expiry among those
   * still with stock. A no-op for products with no batch rows (non-pharmacy,
   * or pharmacy stock never received through a batch-tracked PO line) —
   * that stock simply isn't batch-tracked, same as today.
   */
  private async consumeBatchesFefo(manager: EntityManager, productId: string, quantity: number) {
    let remaining = quantity;
    const batches = await manager
      .createQueryBuilder(ProductBatch, 'batch')
      .where('batch.product_id = :productId', { productId })
      .andWhere('batch.quantity > 0')
      .orderBy('batch.expiry_date', 'ASC', 'NULLS LAST')
      .getMany();

    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(Number(batch.quantity), remaining);
      await manager.update(ProductBatch, { id: batch.id }, { quantity: Number(batch.quantity) - take });
      remaining -= take;
    }

    if (batches.length > 0) {
      await this.syncProductBatchSummary(manager, productId);
    }
  }

  /**
   * Credits returned/deleted-order stock back into whichever batch currently
   * has the soonest expiry — an approximation (not necessarily the exact
   * batch it was originally sold from, which would need a sale->batch
   * allocation table), but keeps batch totals from drifting away from
   * Product.stock_quantity on every return.
   */
  private async creditBackToSoonestBatch(manager: EntityManager, productId: string, quantity: number) {
    const target = await manager
      .createQueryBuilder(ProductBatch, 'batch')
      .where('batch.product_id = :productId', { productId })
      .orderBy('batch.expiry_date', 'ASC', 'NULLS LAST')
      .limit(1)
      .getOne();
    if (!target) return;
    await manager.update(ProductBatch, { id: target.id }, { quantity: Number(target.quantity) + quantity });
    await this.syncProductBatchSummary(manager, productId);
  }

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

  private async decrementStock(
    manager: import('typeorm').EntityManager,
    businessId: string,
    productId: string,
    requestedQuantity: number,
    orderNumber: string,
    allowBeyondStock: boolean,
  ): Promise<{ fulfilled: number; productName: string }> {
    const product = await manager
      .createQueryBuilder(Product, 'product')
      .setLock('pessimistic_write')
      .where('product.id = :id AND product.business_id = :businessId', { id: productId, businessId })
      .getOne();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const available = Number(product.stock_quantity);
    const fulfilled = Math.max(0, Math.min(available, requestedQuantity));

    if (!allowBeyondStock && fulfilled < requestedQuantity) {
      throw new BadRequestException(
        fulfilled === 0
          ? `${product.name} is out of stock`
          : `Only ${fulfilled} ${product.name} in stock (requested ${requestedQuantity})`,
      );
    }

    if (fulfilled === 0) {
      if (product.is_available) {
        await manager.update(Product, { id: productId }, { is_available: false });
      }
      return { fulfilled: 0, productName: product.name };
    }

    const remaining = available - fulfilled;
    await manager.update(
      Product,
      { id: productId },
      { stock_quantity: remaining, ...(remaining <= 0 ? { is_available: false } : {}) },
    );

    await manager.save(
      Stock,
      manager.create(Stock, {
        business_id: businessId,
        product_id: productId,
        type: 'OUT',
        quantity: fulfilled,
        reference: orderNumber,
        notes: 'Sold via order',
      }),
    );

    await this.consumeBatchesFefo(manager, productId, fulfilled);

    return { fulfilled, productName: product.name };
  }

  /**
   * decrementStock() clamps a request to whatever's actually on the shelf
   * instead of failing the whole order — correct, but silent: the order just
   * ends up with fewer/no units of that item and nobody's told. Builds the
   * one notification message summarizing everything that came up short, so
   * staff can follow up with the customer instead of it going unnoticed.
   */
  private buildShortfallMessage(
    customerName: string,
    orderNumber: string,
    shortfalls: { productName: string; requested: number; fulfilled: number }[],
  ): string {
    const clauses = shortfalls.map((s) =>
      s.fulfilled === 0
        ? `dropped ${s.productName} entirely (out of stock)`
        : `got only ${s.fulfilled} of ${s.requested} ${s.productName} (not enough in stock)`,
    );
    return `${customerName}'s order ${orderNumber} ${clauses.join('; ')} — follow up with the customer.`;
  }

  /**
   * Looks up a Product by name (case-insensitive) for the business; creates
   * one from the order item's resolved price/unit/tax if none exists yet.
   */
  private async findOrCreateProductFromCustomName(
    manager: import('typeorm').EntityManager,
    businessId: string,
    name: string,
    unit: string | undefined,
    unitPrice: number,
    taxPercentage: number,
  ): Promise<string> {
    const existing = await manager
      .getRepository(Product)
      .createQueryBuilder('product')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('LOWER(product.name) = LOWER(:name)', { name })
      .getOne();

    if (existing) {
      return existing.id;
    }

    const created = manager.create(Product, {
      business_id: businessId,
      name,
      unit: unit ?? 'piece',
      purchase_price: 0,
      selling_price: unitPrice,
      tax_percentage: taxPercentage,
      stock_quantity: 0,
      is_draft: false,
    });
    const saved = await manager.save(Product, created);
    return saved.id;
  }

  /**
   * Undoes the stock deduction from create()/addItems() for every item that
   * referenced a real product, then removes everything that references this
   * order (KOT has a NOT NULL order_id, so those rows must be deleted rather
   * than unlinked — same dependency order as dev-tools' clearModule('orders')).
   */
  async remove(id: string, businessId: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id, business_id: businessId },
        relations: { items: true },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const billedStatuses = ['confirmed', 'packed', 'dispatched', 'delivered', 'paid'];
      if (order.customer_id && billedStatuses.includes(order.status)) {
        const payments = await manager.find(Payment, { where: { order_id: id } });
        const paidSum = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const remaining = Math.max(0, Number(order.total_amount) - paidSum);
        if (remaining > 0.01) {
          await manager.increment(Customer, { id: order.customer_id }, 'outstanding_amount', -remaining);
          await manager.save(
            Ledger,
            manager.create(Ledger, {
              business_id: businessId,
              customer_id: order.customer_id,
              type: 'CREDIT',
              amount: remaining,
              description: `Order ${order.order_number} deleted`,
            }),
          );
        }
      }

      for (const item of order.items) {
        if (item.product_id) {
          await manager.increment(Product, { id: item.product_id }, 'stock_quantity', Number(item.quantity));
          await this.creditBackToSoonestBatch(manager, item.product_id, Number(item.quantity));
        }
      }

      const invoiceIds = (
        await manager.find(Invoice, { where: { order_id: id }, select: { id: true } })
      ).map((i) => i.id);
      if (invoiceIds.length) {
        await manager.delete(InvoiceItem, { invoice_id: In(invoiceIds) });
        await manager.delete(Invoice, { id: In(invoiceIds) });
      }
      await manager.delete(Payment, { order_id: id });

      if (order.items.length > 0) {
        await manager.remove(OrderItem, order.items);
      }
      await manager.delete(KOT, { order_id: id });

      await manager.remove(Order, order);
      return { deleted: true };
    });
  }

  // created_by is a full User relation — never leak the password hash to the client.
  private sanitizeCreatedBy<T extends { created_by?: any }>(order: T): T {
    if (order.created_by) {
      const { password_hash, ...safe } = order.created_by;
      order.created_by = safe;
    }
    return order;
  }

  async findAll(businessId: string, status?: string, customerId?: string) {
    const where: Record<string, any> = { business_id: businessId };
    if (status) {
      where.status = status;
    }
    if (customerId) {
      where.customer_id = customerId;
    }
    const orders = await this.ordersRepository.find({
      where,
      relations: { table: true, items: { product: true }, created_by: true },
      order: { created_at: 'DESC' }
    });
    return orders.map((o) => this.sanitizeCreatedBy(o));
  }

  async findOne(id: string, businessId: string) {
    const order = await this.ordersRepository.findOne({
      where: { id, business_id: businessId },
      relations: { created_by: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    this.sanitizeCreatedBy(order);
    const items = await this.orderItemsRepository.find({
      where: { order_id: id },
      relations: { product: true }
    });
    return { ...order, items };
  }

  async findActiveOrderByTable(tableId: string, businessId: string) {
    const order = await this.ordersRepository.findOne({
      where: {
        business_id: businessId,
        table_id: tableId,
        status: In(['draft', 'confirmed', 'packed', 'dispatched', 'delivered']),
      },
      relations: { created_by: true },
      order: { created_at: 'DESC' },
    });
    if (!order) return null;
    this.sanitizeCreatedBy(order);
    const items = await this.orderItemsRepository.find({
      where: { order_id: order.id },
      relations: { product: true }
    });
    return { ...order, items };
  }

  async findActiveOrderByToken(tokenNumber: number, businessId: string) {
    const order = await this.ordersRepository.findOne({
      where: {
        business_id: businessId,
        token_number: tokenNumber,
        status: In(['draft', 'confirmed', 'packed', 'dispatched', 'delivered']),
      },
      relations: { created_by: true },
      order: { created_at: 'DESC' },
    });
    if (!order) return null;
    this.sanitizeCreatedBy(order);
    const items = await this.orderItemsRepository.find({
      where: { order_id: order.id },
      relations: { product: true }
    });
    return { ...order, items };
  }

  private async isOrderBilled(manager: import('typeorm').EntityManager, order: Order): Promise<boolean> {
    const billedStatuses = ['confirmed', 'packed', 'dispatched', 'delivered', 'paid'];
    if (billedStatuses.includes(order.status)) {
      return true;
    }
    if (!order.customer_id) {
      return false;
    }
    const billedCount = await manager.count(Ledger, {
      where: {
        business_id: order.business_id,
        customer_id: order.customer_id,
        description: Like(`%Order ${order.order_number}%`),
      },
    });
    return billedCount > 0;
  }

  /**
   * Confirming an order records each item's price into price_history so the
   * next order for this customer can auto-suggest it again, and posts the
   * order total as a debit against the customer so outstanding_amount
   * reflects what they owe before any payment is collected.
   */
  async updateStatus(id: string, businessId: string, dto: UpdateOrderStatusDto) {
    if (dto.status === 'returned') {
      throw new BadRequestException('Use the return endpoint to process returned orders.');
    }
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id, business_id: businessId } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const savePriceHistory = async (items: OrderItem[]) => {
        if (!order.customer_id || !items.length) return;
        const historyRows = items
          .filter(item => item.product_id || item.custom_product_name)
          .map(item =>
            manager.create(PriceHistory, {
              business_id: businessId,
              customer_id: order.customer_id,
              product_id: item.product_id,
              custom_product_name: item.custom_product_name,
              price: item.unit_price,
            }),
          );
        if (historyRows.length) await manager.save(PriceHistory, historyRows);
      };

      const billedStatuses = ['confirmed', 'packed', 'dispatched', 'delivered', 'paid'];
      const wasBilled = await this.isOrderBilled(manager, order);
      const isBilled = billedStatuses.includes(dto.status);

      if (order.customer_id) {
        if (!wasBilled && isBilled) {
          // Billed status entered: increment outstanding
          const items = await manager.find(OrderItem, { where: { order_id: id } });
          await savePriceHistory(items);
          await manager.increment(Customer, { id: order.customer_id }, 'outstanding_amount', Number(order.total_amount));
          await manager.save(
            Ledger,
            manager.create(Ledger, {
              business_id: businessId,
              customer_id: order.customer_id,
              type: 'DEBIT',
              amount: order.total_amount,
              description: `Order ${order.order_number} billed`,
            }),
          );

          // Spend any advance credit against this new debt right away rather
          // than leaving it idle. If it fully covers the order, treat the
          // requested status as 'paid' so the rest of this method (price
          // history, table release) runs the same as an explicit pay-off.
          const fullyCovered = await this.applyAdvanceCredit(manager, businessId, order.customer_id, order);
          if (fullyCovered) {
            dto.status = 'paid';
          }
        } else if (wasBilled && !isBilled) {
          // Billed status exited (e.g. cancelled or reverted to draft): decrement outstanding by remaining unpaid
          const payments = await manager.find(Payment, { where: { order_id: id } });
          const paidSum = payments.reduce((sum, p) => sum + Number(p.amount), 0);
          const remaining = Math.max(0, Number(order.total_amount) - paidSum);
          
          if (remaining > 0.01) {
            await manager.increment(Customer, { id: order.customer_id }, 'outstanding_amount', -remaining);
            await manager.save(
              Ledger,
              manager.create(Ledger, {
                business_id: businessId,
                customer_id: order.customer_id,
                type: 'CREDIT',
                amount: remaining,
                description: `Order ${order.order_number} cancelled`,
              }),
            );
          }
        }
      }

      // Save price history whenever an order is marked paid (from any prior status:
      // draft, pending, confirmed) so the next order shows the prices they paid.
      if (dto.status === 'paid' && order.status !== 'paid') {
        const items = await manager.find(OrderItem, { where: { order_id: id } });
        await savePriceHistory(items);
      }

      if (dto.status === 'paid' && order.table_id) {
        // Automatically release the table when the order is paid
        await manager.update(Table, { id: order.table_id }, { status: 'available' });
      }

      order.status = dto.status;
      return manager.save(order);
    });
  }

  async returnOrder(id: string, businessId: string, items?: { id: string; quantity: number }[]) {
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id, business_id: businessId },
        relations: { items: true },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status === 'returned') {
        throw new BadRequestException('Order is already returned');
      }
      if (order.status === 'cancelled') {
        throw new BadRequestException('Cancelled orders cannot be returned');
      }

      // Units still eligible to be returned per line item (skips units already
      // returned in a prior partial return).
      const remainingByItem = new Map<string, number>();
      for (const item of order.items) {
        const remaining = Number(item.quantity) - Number(item.returned_quantity || 0);
        if (remaining > 0.0001) remainingByItem.set(item.id, remaining);
      }

      // Resolve how many units of each item this call is returning, capped at
      // what's actually left outstanding.
      const targets: { item: OrderItem; qty: number }[] = [];
      if (items && items.length > 0) {
        for (const req of items) {
          const remaining = remainingByItem.get(req.id);
          if (!remaining) continue;
          const item = order.items.find((i) => i.id === req.id)!;
          const qty = Math.min(Number(req.quantity), remaining);
          if (qty > 0.0001) targets.push({ item, qty });
        }
      } else {
        for (const item of order.items) {
          const remaining = remainingByItem.get(item.id);
          if (remaining) targets.push({ item, qty: remaining });
        }
      }

      if (targets.length === 0) {
        throw new BadRequestException('No items selected to return');
      }

      const totalRemaining = Array.from(remainingByItem.values()).reduce((sum, q) => sum + q, 0);
      const totalReturning = targets.reduce((sum, t) => sum + t.qty, 0);
      const isFullReturn = totalReturning >= totalRemaining - 0.0001;

      const business = await manager.findOne(Business, { where: { id: businessId } });
      const inventoryEnabled = business?.inventory_enabled !== false;

      let returnedAmount = 0;
      let returnedTax = 0;

      for (const { item, qty } of targets) {
        const itemQty = Number(item.quantity);
        const taxPerUnit = itemQty > 0 ? Number(item.tax_amount) / itemQty : 0;
        const itemReturnedSubtotal = Number(item.unit_price) * qty;
        const itemReturnedTax = taxPerUnit * qty;
        returnedAmount += itemReturnedSubtotal + itemReturnedTax;
        returnedTax += itemReturnedTax;

        // 1. Restore stock for the returned quantity only
        if (inventoryEnabled && item.product_id) {
          await manager.increment(Product, { id: item.product_id }, 'stock_quantity', qty);
          await manager.save(
            Stock,
            manager.create(Stock, {
              business_id: businessId,
              product_id: item.product_id,
              type: 'IN',
              quantity: qty,
              reference: order.order_number,
              notes: 'Restored via return',
            }),
          );
          await this.creditBackToSoonestBatch(manager, item.product_id, qty);
        }

        // Track how many units of this line item have been returned so far
        await manager.increment(OrderItem, { id: item.id }, 'returned_quantity', qty);
      }

      // 2. Financial Adjustments & Repay Paid Amount — scoped to the returned units' share
      const payments = await manager.find(Payment, { where: { order_id: id } });
      const paidSum = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const refundAmount = Math.min(Math.max(paidSum, 0), returnedAmount);

      if (order.customer_id) {
        const billedStatuses = ['confirmed', 'packed', 'dispatched', 'delivered', 'paid'];
        const wasBilled = billedStatuses.includes(order.status) || (await manager.count(Ledger, {
          where: {
            business_id: businessId,
            customer_id: order.customer_id,
            description: Like(`%Order ${order.order_number}%`),
          },
        })) > 0;

        if (wasBilled) {
          // Credit the customer outstanding for the returned units' amount
          await manager.increment(Customer, { id: order.customer_id }, 'outstanding_amount', -returnedAmount);
          await manager.save(
            Ledger,
            manager.create(Ledger, {
              business_id: businessId,
              customer_id: order.customer_id,
              type: 'CREDIT',
              amount: returnedAmount,
              description: isFullReturn ? `Order ${order.order_number} returned` : `${totalReturning} unit(s) returned from order ${order.order_number}`,
            }),
          );

          // Debit the customer outstanding for the refund cash/UPI paid back to them
          if (refundAmount > 0) {
            await manager.increment(Customer, { id: order.customer_id }, 'outstanding_amount', refundAmount);
            await manager.save(
              Ledger,
              manager.create(Ledger, {
                business_id: businessId,
                customer_id: order.customer_id,
                type: 'DEBIT',
                amount: refundAmount,
                description: `Refund for returned item(s) on order ${order.order_number}`,
              }),
            );

            // Log a negative payment refund
            const lastPayment = payments[0];
            await manager.save(
              Payment,
              manager.create(Payment, {
                business_id: businessId,
                order_id: id,
                amount: -refundAmount,
                payment_method: lastPayment?.payment_method || 'Cash',
                status: 'completed',
                transaction_id: lastPayment?.transaction_id ? `REF-${lastPayment.transaction_id}` : `REF-${Date.now()}`,
              }),
            );
          }
        }
      }

      // 3. Shrink the order total to what's left owing
      order.total_amount = Math.max(0, Number(order.total_amount) - returnedAmount);
      order.tax_amount = Math.max(0, Number(order.tax_amount) - returnedTax);

      // 4. Full return: release the table and close out the order
      if (isFullReturn) {
        if (order.table_id) {
          await manager.update(Table, { id: order.table_id }, { status: 'available' });
        }
        order.status = 'returned';
      }

      await manager.save(order);
    });

    return this.findOne(id, businessId);
  }

  async addItems(id: string, businessId: string, dto: AddOrderItemsDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id, business_id: businessId } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      const business = await manager.findOne(Business, { where: { id: businessId } });
      const inventoryEnabled = business?.inventory_enabled !== false;
      const allowOrdersBeyondStock = business?.allow_orders_beyond_stock !== false;

      let additionalAmount = 0;
      let additionalTax = 0;
      const resolvedItems: Array<{
        item: CreateOrderItemDto;
        unitPrice: number;
        subtotal: number;
        taxPercentage: number;
        taxAmount: number;
      }> = [];

      const newlyCreatedProductIds = new Map<string, string>();
      const shortfalls: { productName: string; requested: number; fulfilled: number }[] = [];

      for (const item of dto.items) {
        if (!item.productId && !item.customProductName) {
          throw new BadRequestException('Each item needs either productId or customProductName');
        }
        const clientProvidedProductId = !!item.productId;

        if (clientProvidedProductId && inventoryEnabled && order.order_type !== 'dine_in' && order.order_type !== 'take_away') {
          const requestedQuantity = Number(item.quantity);
          const { fulfilled, productName } = await this.decrementStock(manager, businessId, item.productId!, requestedQuantity, order.order_number, allowOrdersBeyondStock);
          if (fulfilled < requestedQuantity) {
            shortfalls.push({ productName, requested: requestedQuantity, fulfilled });
          }
          if (fulfilled === 0) {
            continue; // nothing in stock — leave this item out of the order entirely
          }
          item.quantity = fulfilled;
        }

        const { unitPrice, taxPercentage } = await this.resolveItemPricing(businessId, order.customer_id, item);
        const subtotal = Number(unitPrice) * Number(item.quantity);
        const taxAmount = subtotal * (taxPercentage / 100);
        additionalAmount += subtotal + taxAmount;
        additionalTax += taxAmount;

        const nameKey = item.customProductName?.trim().toLowerCase();
        if (!item.productId && item.customProductName && nameKey !== TABLE_SESSION_PLACEHOLDER_ITEM) {
          let linkedProductId = newlyCreatedProductIds.get(nameKey);
          if (!linkedProductId) {
            linkedProductId = await this.findOrCreateProductFromCustomName(
              manager,
              businessId,
              item.customProductName,
              item.unit,
              unitPrice,
              taxPercentage,
            );
            newlyCreatedProductIds.set(nameKey, linkedProductId);
          }
          item.productId = linkedProductId;
        } else if (item.productId && item.unitPrice !== undefined) {
          // If a user explicitly updates the price of a catalog product during order edit,
          // sync that new price back to the product's base price.
          const product = await manager.findOne(Product, { where: { id: item.productId } });
          if (product && Number(product.selling_price) !== Number(unitPrice)) {
            product.selling_price = Number(unitPrice);
            if (item.unit && !product.unit_prices?.[item.unit]) {
              product.unit = item.unit;
            }
            await manager.save(Product, product);
          }
        }

        resolvedItems.push({ item, unitPrice, subtotal, taxPercentage, taxAmount });
      }

      let kotId: string | null = null;
      const hasRealItems = dto.items.some(
        (i) => i.customProductName?.trim().toLowerCase() !== TABLE_SESSION_PLACEHOLDER_ITEM
      );

      if (hasRealItems) {
        const kot = manager.create(KOT, {
          business_id: businessId,
          order_id: order.id,
          table_id: order.table_id || null,
          status: 'pending',
        });
        const savedKot = await manager.save(KOT, kot);
        kotId = savedKot.id;
      }

      const orderItems = resolvedItems.map(({ item, unitPrice, subtotal, taxPercentage, taxAmount }) =>
        manager.create(OrderItem, {
          order_id: order.id,
          product_id: item.productId,
          custom_product_name: item.customProductName,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: unitPrice,
          subtotal,
          tax_percentage: taxPercentage,
          tax_amount: taxAmount,
          kot_id: kotId,
        }),
      );
      await manager.save(OrderItem, orderItems);

      order.total_amount = Number(order.total_amount) + additionalAmount;
      order.tax_amount = Number(order.tax_amount) + additionalTax;

      const savedOrder = await manager.save(order);

      if (shortfalls.length > 0) {
        await manager.save(
          Notification,
          manager.create(Notification, {
            business_id: businessId,
            type: 'stock_shortfall',
            message: this.buildShortfallMessage(order.customer_name, order.order_number, shortfalls),
          }),
        );
      }

      // Keep an already-generated invoice (and its printed/thermal totals) in sync with the order
      await this.invoicesService.syncFromOrder(order.id, manager);

      // Update Customer and Ledger if order is already confirmed
      if (order.status === 'confirmed' || order.status === 'delivered') {
        if (order.customer_id) {
          const historyRows = orderItems.map((item) =>
            manager.create(PriceHistory, {
              business_id: businessId,
              customer_id: order.customer_id,
              product_id: item.product_id,
              custom_product_name: item.custom_product_name,
              price: item.unit_price,
            }),
          );
          if (historyRows.length) {
            await manager.save(PriceHistory, historyRows);
          }

          await manager.increment(Customer, { id: order.customer_id }, 'outstanding_amount', additionalAmount);
          await manager.save(
            Ledger,
            manager.create(Ledger, {
              business_id: businessId,
              customer_id: order.customer_id,
              type: 'DEBIT',
              amount: additionalAmount,
              description: `Additional items added to Order ${order.order_number}`,
            }),
          );
        }
      }

      return { ...savedOrder, items: await manager.find(OrderItem, { where: { order_id: order.id }, relations: { product: true } }) };
    });
  }

  async replaceItems(id: string, businessId: string, dto: AddOrderItemsDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id, business_id: businessId } });
      if (!order) throw new NotFoundException('Order not found');

      // Remove existing items
      await manager.delete(OrderItem, { order_id: order.id });

      let totalAmount = 0;
      let totalTax = 0;
      const resolvedItems: Array<{ item: CreateOrderItemDto; unitPrice: number; subtotal: number; taxPercentage: number; taxAmount: number }> = [];

      const newlyCreatedProductIds = new Map<string, string>();

      for (const item of dto.items) {
        if (!item.productId && !item.customProductName) {
          throw new BadRequestException('Each item needs either productId or customProductName');
        }
        const { unitPrice, taxPercentage } = await this.resolveItemPricing(businessId, order.customer_id, item);
        const subtotal = Number(unitPrice) * Number(item.quantity);
        const taxAmount = subtotal * (taxPercentage / 100);
        totalAmount += subtotal + taxAmount;
        totalTax += taxAmount;

        // Save new free-text items as draft products so they appear in the product master
        const nameKey = item.customProductName?.trim().toLowerCase();
        if (!item.productId && item.customProductName && nameKey !== TABLE_SESSION_PLACEHOLDER_ITEM) {
          let linkedProductId = newlyCreatedProductIds.get(nameKey);
          if (!linkedProductId) {
            linkedProductId = await this.findOrCreateProductFromCustomName(
              manager, businessId, item.customProductName, item.unit, unitPrice, taxPercentage,
            );
            newlyCreatedProductIds.set(nameKey, linkedProductId);
          }
          item.productId = linkedProductId;
        } else if (item.productId && item.unitPrice !== undefined) {
          // If a user explicitly updates the price of a catalog product during order edit,
          // sync that new price back to the product's base price.
          const product = await manager.findOne(Product, { where: { id: item.productId } });
          if (product && Number(product.selling_price) !== Number(unitPrice)) {
            product.selling_price = Number(unitPrice);
            if (item.unit && !product.unit_prices?.[item.unit]) {
              product.unit = item.unit;
            }
            await manager.save(Product, product);
          }
        }

        resolvedItems.push({ item, unitPrice, subtotal, taxPercentage, taxAmount });
      }

      let kotId: string | null = null;
      const existingKot = await manager.findOne(KOT, {
        where: { order_id: order.id },
        order: { created_at: 'DESC' },
      });

      if (existingKot) {
        kotId = existingKot.id;
      } else {
        const hasRealItems = dto.items.some(
          (i) => i.customProductName?.trim().toLowerCase() !== TABLE_SESSION_PLACEHOLDER_ITEM
        );
        if (hasRealItems) {
          const kot = manager.create(KOT, {
            business_id: businessId,
            order_id: order.id,
            table_id: order.table_id || null,
            status: 'pending',
          });
          const savedKot = await manager.save(KOT, kot);
          kotId = savedKot.id;
        }
      }

      const orderItems = resolvedItems.map(({ item, unitPrice, subtotal, taxPercentage, taxAmount }) =>
        manager.create(OrderItem, {
          order_id: order.id,
          product_id: item.productId,
          custom_product_name: item.customProductName,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: unitPrice,
          subtotal,
          tax_percentage: taxPercentage,
          tax_amount: taxAmount,
          kot_id: kotId,
        }),
      );
      await manager.save(OrderItem, orderItems);

      // Record updated prices in price_history so next order reflects edited prices
      if (order.customer_id) {
        const historyRows = orderItems
          .filter(oi => oi.product_id || oi.custom_product_name)
          .map(oi =>
            manager.create(PriceHistory, {
              business_id: businessId,
              customer_id: order.customer_id,
              product_id: oi.product_id,
              custom_product_name: oi.custom_product_name,
              price: oi.unit_price,
            }),
          );
        if (historyRows.length) await manager.save(PriceHistory, historyRows);
      }

      const oldTotal = Number(order.total_amount);
      order.total_amount = totalAmount;
      order.tax_amount = totalTax;
      const savedOrder = await manager.save(order);

      // Keep an already-generated invoice (and its printed/thermal totals) in sync with the order
      await this.invoicesService.syncFromOrder(order.id, manager);

      const billedStatuses = ['confirmed', 'packed', 'dispatched', 'delivered'];
      if (order.customer_id && billedStatuses.includes(order.status)) {
        const diff = totalAmount - oldTotal;
        if (Math.abs(diff) > 0.01) {
          await manager.increment(Customer, { id: order.customer_id }, 'outstanding_amount', diff);
          await manager.save(
            Ledger,
            manager.create(Ledger, {
              business_id: businessId,
              customer_id: order.customer_id,
              type: diff > 0 ? 'DEBIT' : 'CREDIT',
              amount: Math.abs(diff),
              description: `Order ${order.order_number} items edited`,
            }),
          );
          if (diff > 0) {
            const fullyCovered = await this.applyAdvanceCredit(manager, businessId, order.customer_id, savedOrder);
            if (fullyCovered) {
              savedOrder.status = 'paid';
              await manager.save(savedOrder);
            }
          }
        }
      }

      return { ...savedOrder, items: await manager.find(OrderItem, { where: { order_id: order.id }, relations: { product: true } }) };
    });
  }

  /**
   * Returns the most-recent price this customer paid per product, as a map
   * { productId → price }. Queries actual order items (not just price_history)
   * so existing historical orders are included even before price_history was populated.
   */
  async customerPrices(businessId: string, customerId: string): Promise<Record<string, { price: number, unit?: string }>> {
    // Pull all paid/confirmed order items for this customer, newest first
    const items = await this.orderItemsRepository
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .where('o.business_id = :businessId', { businessId })
      .andWhere('o.customer_id = :customerId', { customerId })
      .andWhere('o.status IN (:...statuses)', { statuses: ['paid', 'confirmed', 'delivered'] })
      .andWhere('oi.product_id IS NOT NULL')
      .orderBy('o.created_at', 'DESC')
      .select(['oi.id', 'oi.product_id', 'oi.unit_price', 'oi.unit'])
      .getMany();

    // Keep only the most recent price and unit per product
    const map: Record<string, { price: number, unit?: string }> = {};
    for (const item of items) {
      if (item.product_id && !(item.product_id in map)) {
        map[item.product_id] = { price: Number(item.unit_price), unit: item.unit || undefined };
      }
    }
    return map;
  }

  async getOrderReceiptHtml(id: string, businessId: string): Promise<string> {
    const order = await this.ordersRepository.findOne({
      where: { id, business_id: businessId },
      relations: { table: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const items = await this.orderItemsRepository.find({
      where: { order_id: id },
      relations: { product: true },
    });

    const business = await this.dataSource.getRepository(Business).findOne({ where: { id: businessId } });
    const customer = order.customer_id
      ? await this.customersRepository.findOne({ where: { id: order.customer_id } })
      : null;

    const dummyInvoice = {
      invoice_number: order.order_number.replace('ORD-', 'REC-'),
      created_at: order.created_at,
      tax_amount: order.tax_amount,
      total_amount: order.total_amount,
    } as any;

    const mappedItems = items.map((item) => ({
      id: item.id,
      product: item.product,
      custom_product_name: item.custom_product_name,
      quantity: Number(item.quantity),
      unit: item.unit || item.product?.unit,
      unit_price: Number(item.unit_price),
      subtotal: Number(item.subtotal),
      tax_percentage: Number(item.tax_percentage),
      tax_amount: Number(item.tax_amount),
    })) as any[];

    const { renderA4ReceiptHtml } = require('../billing/templates/invoice.template');
    const { loadImageDataUri } = require('../../common/utils/image-data-uri.util');
    const payments = await this.dataSource.getRepository(Payment).find({ where: { order_id: id } });
    const receivedAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const logoDataUri = loadImageDataUri(business?.logo_url);
    const upiQrDataUri = loadImageDataUri(business?.upi_qr_url);
    return renderA4ReceiptHtml(dummyInvoice, mappedItems, business, customer, order, receivedAmount, logoDataUri, upiQrDataUri);
  }
}
