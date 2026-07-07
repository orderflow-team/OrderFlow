import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Product } from '../../database/entities/product.entity';
import { PriceHistory } from '../../database/entities/price-history.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Ledger } from '../../database/entities/ledger.entity';
import { Table } from '../../database/entities/table.entity';
import { KOT } from '../../database/entities/kot.entity';
import { Stock } from '../../database/entities/stock.entity';
import { CreateOrderDto, CreateOrderItemDto, AddOrderItemsDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

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
  ) {}

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
      return { unitPrice: Number(product.selling_price), taxPercentage: Number(product.tax_percentage) };
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
    return this.dataSource.transaction(async (manager) => {
      const orderNumber = `ORD-${Date.now()}`;

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

      for (const item of dto.items) {
        if (!item.productId && !item.customProductName) {
          throw new BadRequestException('Each item needs either productId or customProductName');
        }
        const clientProvidedProductId = !!item.productId;
        const { unitPrice, taxPercentage } = await this.resolveItemPricing(dto.businessId, dto.customerId, item);
        const subtotal = Number(unitPrice) * Number(item.quantity);
        const taxAmount = subtotal * (taxPercentage / 100);
        totalAmount += subtotal + taxAmount;
        totalTax += taxAmount;

        if (clientProvidedProductId) {
          await this.decrementStock(manager, dto.businessId, item.productId!, Number(item.quantity), orderNumber);
        }

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
      }

      const order = manager.create(Order, {
        business_id: dto.businessId,
        customer_id: resolvedCustomerId,
        customer_name: dto.customerName,
        table_id: dto.tableId,
        guest_count: dto.guestCount,
        order_number: orderNumber,
        token_number: tokenNumber,
        order_type: dto.orderType ?? 'regular',
        status: 'draft',
        total_amount: totalAmount,
        tax_amount: totalTax,
        notes: dto.notes,
        created_by_user_id: createdByUserId,
      });
      const savedOrder = await manager.save(order);

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
   * tracking" workflow those exist for). Uses a single conditional UPDATE
   * rather than read-then-write so concurrent orders can't both pass an
   * insufficient-stock check and oversell the same units.
   */
  private async decrementStock(
    manager: import('typeorm').EntityManager,
    businessId: string,
    productId: string,
    quantity: number,
    orderNumber: string,
  ) {
    const result = await manager
      .createQueryBuilder()
      .update(Product)
      .set({ stock_quantity: () => `stock_quantity - ${Number(quantity)}` })
      .where('id = :id AND business_id = :businessId AND stock_quantity >= :qty', {
        id: productId,
        businessId,
        qty: Number(quantity),
      })
      .execute();

    if (result.affected === 0) {
      throw new BadRequestException('Insufficient stock for one of the items in this order');
    }

    await manager.save(
      Stock,
      manager.create(Stock, {
        business_id: businessId,
        product_id: productId,
        type: 'OUT',
        quantity: Number(quantity),
        reference: orderNumber,
        notes: 'Sold via order',
      }),
    );
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

  async remove(id: string, businessId: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id, business_id: businessId },
        relations: { items: true },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Revert stock if order was completed/dispatched/active (i.e. not draft/cancelled)
      // Actually we decrement stock during create for ALL orders except if they explicitly handled it?
      // Wait, in create: we always decrementStock for clientProvidedProductId
      for (const item of order.items) {
        if (item.product_id) {
          // decrementStock does stock_quantity = Number(stock) - delta
          // So to revert, we do + quantity
          await manager.increment(Product, { id: item.product_id }, 'stock_quantity', Number(item.quantity));
        }
      }

      if (order.items.length > 0) {
        await manager.remove(OrderItem, order.items);
      }

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

  async findAll(businessId: string, status?: string) {
    const where: Record<string, any> = { business_id: businessId };
    if (status) {
      where.status = status;
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

  /**
   * Confirming an order records each item's price into price_history so the
   * next order for this customer can auto-suggest it again, and posts the
   * order total as a debit against the customer so outstanding_amount
   * reflects what they owe before any payment is collected.
   */
  async updateStatus(id: string, businessId: string, dto: UpdateOrderStatusDto) {
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

      const billedStatuses = ['confirmed', 'packed', 'dispatched', 'delivered'];
      if (billedStatuses.includes(dto.status) && order.status === 'draft') {
        const items = await manager.find(OrderItem, { where: { order_id: id } });
        await savePriceHistory(items);

        if (order.customer_id) {
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

  async addItems(id: string, businessId: string, dto: AddOrderItemsDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id, business_id: businessId } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

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

      for (const item of dto.items) {
        if (!item.productId && !item.customProductName) {
          throw new BadRequestException('Each item needs either productId or customProductName');
        }
        const clientProvidedProductId = !!item.productId;
        const { unitPrice, taxPercentage } = await this.resolveItemPricing(businessId, order.customer_id, item);
        const subtotal = Number(unitPrice) * Number(item.quantity);
        const taxAmount = subtotal * (taxPercentage / 100);
        additionalAmount += subtotal + taxAmount;
        additionalTax += taxAmount;

        if (clientProvidedProductId) {
          await this.decrementStock(manager, businessId, item.productId!, Number(item.quantity), order.order_number);
        }

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
        }

        resolvedItems.push({ item, unitPrice, subtotal, taxPercentage, taxAmount });
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
}
