import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Product } from '../../database/entities/product.entity';
import { Customer } from '../../database/entities/customer.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { PurchaseItem } from '../../database/entities/purchase-item.entity';

const ACTIVE_ORDER_STATUSES = ['draft', 'confirmed', 'packed', 'dispatched'];

/**
 * Revenue/tax/profit figures should only reflect orders that have actually
 * been billed — a 'draft' order is still an open cart (a dine-in table still
 * being ordered for, a not-yet-confirmed regular order) with no invoice or
 * payment behind it yet, so counting it here would overstate GST collected
 * and sales for anything still in progress.
 */
const UNBILLED_ORDER_STATUSES = ['draft', 'cancelled', 'returned'];

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order) private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    @InjectRepository(Customer) private customersRepository: Repository<Customer>,
    @InjectRepository(PurchaseOrder) private purchaseOrdersRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseItem) private purchaseItemsRepository: Repository<PurchaseItem>,
  ) {}

  async dashboard(businessId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      todaysOrders,
      todaysSales,
      pendingOrders,
      deliveredOrders,
      pendingPayments,
      lowStockProducts,
      expiringProducts,
      topProducts,
      topCustomers,
    ] = await Promise.all([
      this.ordersRepository
        .createQueryBuilder('order')
        .where('order.business_id = :businessId', { businessId })
        .andWhere('order.created_at >= :startOfToday', { startOfToday })
        .getCount(),
      this.ordersRepository
        .createQueryBuilder('order')
        .where('order.business_id = :businessId', { businessId })
        .andWhere('order.created_at >= :startOfToday', { startOfToday })
        .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
        .select('COALESCE(SUM(order.total_amount), 0)', 'total')
        .getRawOne(),
      this.ordersRepository
        .createQueryBuilder('order')
        .where('order.business_id = :businessId', { businessId })
        .andWhere('order.status IN (:...statuses)', { statuses: ACTIVE_ORDER_STATUSES })
        .getCount(),
      this.ordersRepository
        .createQueryBuilder('order')
        .where('order.business_id = :businessId', { businessId })
        .andWhere('order.status IN (:...statuses)', { statuses: ['delivered', 'paid'] })
        .getCount(),
      this.customersRepository
        .createQueryBuilder('customer')
        .where('customer.business_id = :businessId', { businessId })
        .andWhere('customer.outstanding_amount > 0')
        .select('COALESCE(SUM(customer.outstanding_amount), 0)', 'total')
        .getRawOne(),
      this.productsRepository
        .createQueryBuilder('product')
        .where('product.business_id = :businessId', { businessId })
        .andWhere('product.stock_quantity <= :threshold', { threshold: 10 })
        .andWhere('product.name != :placeholder', { placeholder: 'Table Session Started' })
        .orderBy('product.stock_quantity', 'ASC')
        .limit(10)
        .getMany(),
      this.productsRepository
        .createQueryBuilder('product')
        .where('product.business_id = :businessId', { businessId })
        .andWhere('product.expiry_date IS NOT NULL')
        .andWhere('product.expiry_date >= :today', { today: new Date() })
        .andWhere(`product.expiry_date <= :soon`, { soon: this.daysFromNow(30) })
        .orderBy('product.expiry_date', 'ASC')
        .limit(10)
        .getMany(),
      this.orderItemsRepository
        .createQueryBuilder('item')
        .innerJoin('orders', 'order', 'order.id = item.order_id')
        .leftJoin('products', 'product', 'product.id = item.product_id')
        .where('order.business_id = :businessId', { businessId })
        .andWhere('item.product_id IS NOT NULL')
        .select('item.product_id', 'productId')
        .addSelect('product.name', 'productName')
        .addSelect('SUM(item.quantity)', 'totalQuantity')
        .addSelect('SUM(item.subtotal)', 'totalRevenue')
        .groupBy('item.product_id')
        .addGroupBy('product.name')
        .orderBy('"totalQuantity"', 'DESC')
        .limit(5)
        .getRawMany(),
      this.ordersRepository
        .createQueryBuilder('order')
        .where('order.business_id = :businessId', { businessId })
        .andWhere('order.customer_id IS NOT NULL')
        .select('order.customer_id', 'customerId')
        .addSelect('order.customer_name', 'customerName')
        .addSelect('COUNT(order.id)', 'orderCount')
        .addSelect('SUM(order.total_amount)', 'totalSpent')
        .groupBy('order.customer_id')
        .addGroupBy('order.customer_name')
        .orderBy('"totalSpent"', 'DESC')
        .limit(5)
        .getRawMany(),
    ]);

    return {
      todaysOrders,
      todaysSales: Number(todaysSales.total),
      pendingOrders,
      deliveredOrders,
      pendingPaymentsAmount: Number(pendingPayments.total),
      lowStockProducts,
      expiringProducts,
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        productName: p.productName ?? 'Unknown product',
        totalQuantity: Number(p.totalQuantity),
        totalRevenue: Number(p.totalRevenue),
      })),
      topCustomers: topCustomers.map((c) => ({
        customerId: c.customerId,
        customerName: c.customerName,
        orderCount: Number(c.orderCount),
        totalSpent: Number(c.totalSpent),
      })),
    };
  }

  async salesReport(businessId: string, from?: string, to?: string) {
    const query = this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES });

    if (from) {
      query.andWhere('order.created_at >= :from', { from });
    }
    if (to) {
      query.andWhere('order.created_at <= :to', { to });
    }

    const result = await query
      .select('DATE(order.created_at)', 'date')
      .addSelect('COUNT(order.id)', 'orderCount')
      .addSelect('SUM(order.total_amount)', 'totalSales')
      .groupBy('DATE(order.created_at)')
      .orderBy('DATE(order.created_at)', 'DESC')
      .getRawMany();

    return result.map((r) => ({
      date: r.date,
      orderCount: Number(r.orderCount),
      totalSales: Number(r.totalSales),
    }));
  }

  async outstandingReport(businessId: string) {
    return this.customersRepository
      .createQueryBuilder('customer')
      .where('customer.business_id = :businessId', { businessId })
      .andWhere('customer.outstanding_amount > 0')
      .orderBy('customer.outstanding_amount', 'DESC')
      .getMany();
  }

  /**
   * Gross profit per item = (selling price - purchase price) * quantity.
   * Free-text (Quick Parchi) items have no linked product, so no known cost
   * basis — they're counted as revenue with zero cost rather than excluded.
   */
  async profitReport(businessId: string, from?: string, to?: string) {
    const query = this.orderItemsRepository
      .createQueryBuilder('item')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .leftJoin('products', 'product', 'product.id = item.product_id')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES });

    if (from) {
      query.andWhere('order.created_at >= :from', { from });
    }
    if (to) {
      query.andWhere('order.created_at <= :to', { to });
    }

    const result = await query
      .select('COALESCE(SUM(item.subtotal), 0)', 'revenue')
      .addSelect('COALESCE(SUM(item.quantity * COALESCE(product.purchase_price, 0)), 0)', 'cost')
      .getRawOne();

    const revenue = Number(result.revenue);
    const cost = Number(result.cost);

    return {
      revenue,
      cost,
      grossProfit: revenue - cost,
      marginPercent: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
    };
  }

  /** GST/tax collected, grouped by day, based on tax actually posted on confirmed orders. */
  async taxReport(businessId: string, from?: string, to?: string) {
    const query = this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES });

    if (from) {
      query.andWhere('order.created_at >= :from', { from });
    }
    if (to) {
      query.andWhere('order.created_at <= :to', { to });
    }

    const result = await query
      .select('DATE(order.created_at)', 'date')
      .addSelect('COUNT(order.id)', 'orderCount')
      .addSelect('COALESCE(SUM(order.total_amount), 0)', 'totalSales')
      .addSelect('COALESCE(SUM(order.tax_amount), 0)', 'totalTax')
      .groupBy('DATE(order.created_at)')
      .orderBy('DATE(order.created_at)', 'DESC')
      .getRawMany();

    return result.map((r) => ({
      date: r.date,
      orderCount: Number(r.orderCount),
      totalSales: Number(r.totalSales),
      totalTax: Number(r.totalTax),
    }));
  }

  /**
   * Sales vs Purchase command-center payload. Gross margin/cash-flow are
   * scoped to "this month" (matches taxSummary.month below) so the top-row
   * KPIs read as one coherent snapshot; today's sales/purchases are separate,
   * narrower figures for the same-day pulse-check.
   *
   * Margin/cost figures use each product's *current* purchase_price and
   * batch/expiry fields — the schema only tracks one current batch per
   * product (no per-batch cost history), so these are approximations, not
   * batch-accurate figures. Draft products (is_draft = true, e.g. one-off
   * Quick Parchi entries with no real cost basis) are excluded from margin
   * and fast-moving so synthetic zero-cost rows don't skew either.
   */
  async analyticsDashboard(businessId: string, days = 30) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const chartSince = this.daysFromNow(-days);

    const [
      todaysSalesRevenue,
      todaysPurchaseExpenses,
      monthSales,
      monthPurchases,
      monthMargin,
      monthOutputTax,
      monthInputTax,
      todaysOutputTax,
      todaysInputTax,
      salesSeries,
      purchaseSeries,
      purchaseHistory,
      salesHistory,
      fastMoving,
      lowStockProducts,
      expiringSoon,
    ] = await Promise.all([
      this.sumOrders(businessId, startOfToday),
      this.sumReceivedPurchases(businessId, startOfToday),
      this.sumOrders(businessId, startOfMonth),
      this.sumReceivedPurchases(businessId, startOfMonth),
      this.marginSince(businessId, startOfMonth),
      this.sumOrderTax(businessId, startOfMonth),
      this.sumPurchaseTax(businessId, startOfMonth),
      this.sumOrderTax(businessId, startOfToday),
      this.sumPurchaseTax(businessId, startOfToday),
      this.ordersRepository
        .createQueryBuilder('order')
        .where('order.business_id = :businessId', { businessId })
        .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
        .andWhere('order.created_at >= :since', { since: chartSince })
        .select('DATE(order.created_at)', 'date')
        .addSelect('COALESCE(SUM(order.total_amount), 0)', 'total')
        .groupBy('DATE(order.created_at)')
        .getRawMany(),
      this.purchaseOrdersRepository
        .createQueryBuilder('po')
        .where('po.business_id = :businessId', { businessId })
        .andWhere("po.status = 'received'")
        .andWhere('po.created_at >= :since', { since: chartSince })
        .select('DATE(po.created_at)', 'date')
        .addSelect('COALESCE(SUM(po.total_amount), 0)', 'total')
        .groupBy('DATE(po.created_at)')
        .getRawMany(),
      this.purchaseOrdersRepository
        .createQueryBuilder('po')
        .leftJoin('suppliers', 'supplier', 'supplier.id = po.supplier_id')
        .where('po.business_id = :businessId', { businessId })
        .select('po.id', 'id')
        .addSelect('supplier.name', 'supplierName')
        .addSelect('po.order_number', 'orderNumber')
        .addSelect('po.status', 'status')
        .addSelect('po.total_amount', 'totalAmount')
        .addSelect('po.created_at', 'createdAt')
        .orderBy('po.created_at', 'DESC')
        .limit(10)
        .getRawMany(),
      this.ordersRepository
        .createQueryBuilder('order')
        .where('order.business_id = :businessId', { businessId })
        .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
        .select('order.id', 'id')
        .addSelect('order.customer_name', 'customerName')
        .addSelect('order.order_number', 'orderNumber')
        .addSelect('order.status', 'status')
        .addSelect('order.total_amount', 'totalAmount')
        .addSelect('order.created_at', 'createdAt')
        .orderBy('order.created_at', 'DESC')
        .limit(10)
        .getRawMany(),
      this.orderItemsRepository
        .createQueryBuilder('item')
        .innerJoin('orders', 'order', 'order.id = item.order_id')
        .innerJoin('products', 'product', 'product.id = item.product_id')
        .where('order.business_id = :businessId', { businessId })
        .andWhere('order.created_at >= :since', { since: chartSince })
        .andWhere('product.is_draft = false')
        .select('item.product_id', 'productId')
        .addSelect('product.name', 'productName')
        .addSelect('SUM(item.quantity)', 'totalQuantity')
        .addSelect('SUM(item.subtotal)', 'totalRevenue')
        .groupBy('item.product_id')
        .addGroupBy('product.name')
        .orderBy('"totalQuantity"', 'DESC')
        .limit(5)
        .getRawMany(),
      this.productsRepository
        .createQueryBuilder('product')
        .where('product.business_id = :businessId', { businessId })
        .andWhere('product.stock_quantity <= :threshold', { threshold: 10 })
        .andWhere('product.name != :placeholder', { placeholder: 'Table Session Started' })
        .orderBy('product.stock_quantity', 'ASC')
        .limit(10)
        .getMany(),
      this.productsRepository
        .createQueryBuilder('product')
        .where('product.business_id = :businessId', { businessId })
        .andWhere('product.expiry_date IS NOT NULL')
        .andWhere('product.expiry_date >= :minDate', { minDate: this.daysFromNow(90) })
        .andWhere('product.expiry_date <= :maxDate', { maxDate: this.daysFromNow(180) })
        .orderBy('product.expiry_date', 'ASC')
        .limit(10)
        .getMany(),
    ]);

    const dateIndex = new Map<string, { sales: number; purchases: number }>();
    for (const row of salesSeries) {
      dateIndex.set(row.date, { sales: Number(row.total), purchases: 0 });
    }
    for (const row of purchaseSeries) {
      const existing = dateIndex.get(row.date);
      if (existing) {
        existing.purchases = Number(row.total);
      } else {
        dateIndex.set(row.date, { sales: 0, purchases: Number(row.total) });
      }
    }
    const chart = Array.from(dateIndex.entries())
      .map(([date, v]) => ({ date, sales: v.sales, purchases: v.purchases }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    return {
      kpis: {
        todaysSalesRevenue,
        todaysPurchaseExpenses,
        grossProfitMargin: monthMargin,
        netCashFlow: monthSales - monthPurchases,
        taxSummary: {
          today: { outputGst: todaysOutputTax, inputGst: todaysInputTax },
          month: { outputGst: monthOutputTax, inputGst: monthInputTax },
        },
      },
      chart,
      purchaseHistory: purchaseHistory.map((p) => ({
        id: p.id,
        supplierName: p.supplierName ?? 'Unknown supplier',
        orderNumber: p.orderNumber,
        status: p.status,
        totalAmount: Number(p.totalAmount),
        createdAt: p.createdAt,
      })),
      salesHistory: salesHistory.map((s) => ({
        id: s.id,
        customerName: s.customerName,
        orderNumber: s.orderNumber,
        status: s.status,
        totalAmount: Number(s.totalAmount),
        createdAt: s.createdAt,
      })),
      fastMoving: fastMoving.map((p) => ({
        productId: p.productId,
        productName: p.productName ?? 'Unknown product',
        totalQuantity: Number(p.totalQuantity),
        totalRevenue: Number(p.totalRevenue),
      })),
      lowStockProducts,
      expiringSoon,
    };
  }

  private async sumOrders(businessId: string, since: Date) {
    const result = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .select('COALESCE(SUM(order.total_amount), 0)', 'total')
      .getRawOne();
    return Number(result.total);
  }

  private async sumReceivedPurchases(businessId: string, since: Date) {
    const result = await this.purchaseOrdersRepository
      .createQueryBuilder('po')
      .where('po.business_id = :businessId', { businessId })
      .andWhere("po.status = 'received'")
      .andWhere('po.created_at >= :since', { since })
      .select('COALESCE(SUM(po.total_amount), 0)', 'total')
      .getRawOne();
    return Number(result.total);
  }

  private async sumOrderTax(businessId: string, since: Date) {
    const result = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .select('COALESCE(SUM(order.tax_amount), 0)', 'total')
      .getRawOne();
    return Number(result.total);
  }

  private async sumPurchaseTax(businessId: string, since: Date) {
    const result = await this.purchaseItemsRepository
      .createQueryBuilder('item')
      .innerJoin('purchase_orders', 'po', 'po.id = item.purchase_order_id')
      .where('po.business_id = :businessId', { businessId })
      .andWhere("po.status = 'received'")
      .andWhere('po.created_at >= :since', { since })
      .select('COALESCE(SUM(item.tax_amount), 0)', 'total')
      .getRawOne();
    return Number(result.total);
  }

  /** Gross profit margin % for orders since the given date, mirroring profitReport() but excluding draft/synthetic products. */
  private async marginSince(businessId: string, since: Date) {
    const result = await this.orderItemsRepository
      .createQueryBuilder('item')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .leftJoin('products', 'product', 'product.id = item.product_id')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .andWhere('(product.is_draft IS NULL OR product.is_draft = false)')
      .select('COALESCE(SUM(item.subtotal), 0)', 'revenue')
      .addSelect('COALESCE(SUM(item.quantity * COALESCE(product.purchase_price, 0)), 0)', 'cost')
      .getRawOne();

    const revenue = Number(result.revenue);
    const cost = Number(result.cost);
    return revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
  }

  private daysFromNow(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }
}
