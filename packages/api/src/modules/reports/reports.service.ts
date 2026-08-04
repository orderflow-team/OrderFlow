import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Product } from '../../database/entities/product.entity';
import { Business } from '../../database/entities/business.entity';
import { Customer } from '../../database/entities/customer.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { PurchaseItem } from '../../database/entities/purchase-item.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Expense } from '../../database/entities/expense.entity';
import { Salesman } from '../../database/entities/salesman.entity';

const ACTIVE_ORDER_STATUSES = ['draft', 'confirmed', 'packed', 'dispatched'];

/**
 * Revenue/tax/profit figures should only reflect orders that have actually
 * been billed — a 'draft' order is still an open cart (a dine-in table still
 * being ordered for, a not-yet-confirmed regular order) with no invoice or
 * payment behind it yet, so counting it here would overstate GST collected
 * and sales for anything still in progress.
 */
const UNBILLED_ORDER_STATUSES = ['draft', 'cancelled', 'returned'];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order) private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    @InjectRepository(Customer) private customersRepository: Repository<Customer>,
    @InjectRepository(PurchaseOrder) private purchaseOrdersRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseItem) private purchaseItemsRepository: Repository<PurchaseItem>,
    @InjectRepository(Payment) private paymentsRepository: Repository<Payment>,
    @InjectRepository(Expense) private expensesRepository: Repository<Expense>,
    @InjectRepository(Salesman) private salesmenRepository: Repository<Salesman>,
    @InjectRepository(Business) private businessesRepository: Repository<Business>,
  ) {}

  /** Expiry only makes sense where stock/batches are actually tracked, and never applies to restaurants (no shelf-life concept for a cooked dish). Other inventory KPIs (stock levels, valuation) key off inventory_enabled alone. */
  private async reportGatesFor(businessId: string) {
    const business = await this.businessesRepository.findOne({ where: { id: businessId } });
    const inventoryEnabled = business?.inventory_enabled !== false;
    const showExpiry = inventoryEnabled && business?.category !== 'restaurant';
    return { category: business?.category ?? null, inventoryEnabled, showExpiry };
  }

  async dashboard(businessId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const { category, inventoryEnabled, showExpiry } = await this.reportGatesFor(businessId);

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
      inventoryEnabled
        ? this.productsRepository
            .createQueryBuilder('product')
            .where('product.business_id = :businessId', { businessId })
            .andWhere('product.stock_quantity <= :threshold', { threshold: 10 })
            .andWhere('product.name != :placeholder', { placeholder: 'Table Session Started' })
            .orderBy('product.stock_quantity', 'ASC')
            .limit(10)
            .getMany()
        : Promise.resolve([]),
      showExpiry
        ? this.productsRepository
            .createQueryBuilder('product')
            .where('product.business_id = :businessId', { businessId })
            .andWhere('product.expiry_date IS NOT NULL')
            .andWhere('product.expiry_date >= :today', { today: new Date() })
            .andWhere(`product.expiry_date <= :soon`, { soon: this.daysFromNow(30) })
            .orderBy('product.expiry_date', 'ASC')
            .limit(10)
            .getMany()
        : Promise.resolve([]),
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
      meta: { category, inventoryEnabled },
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
   * Sales vs Purchase command-center payload, now covering every angle: sales
   * vs purchases, customers, products/inventory, suppliers, finance
   * (payments/expenses/profit), and operations. Single endpoint / single
   * Promise.all, same style as the original dashboard() — the frontend fetches
   * this once and tabs just render different slices of the same payload.
   *
   * Margin/cost figures use each product's *current* purchase_price and
   * batch/expiry fields — the schema only tracks one current batch per
   * product (no per-batch cost history), so these are approximations, not
   * batch-accurate figures. Draft products (is_draft = true, e.g. one-off
   * Quick Parchi entries with no real cost basis) are excluded from margin,
   * fast-moving, category, and slow-moving so synthetic zero-cost rows don't
   * skew any of them.
   *
   * Customer "new vs returning" and "inactive" are derived from order
   * history (MIN/MAX created_at per customer) — there's no invoice-level due
   * date anywhere, so true AR aging isn't possible; "days since last order"
   * is the honest substitute.
   */
  async analyticsDashboard(businessId: string, days = 30) {
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const { category, inventoryEnabled, showExpiry } = await this.reportGatesFor(businessId);
    // Snapped to midnight (like startOfToday above) so "last N days" covers the
    // *full* calendar day N days ago — daysFromNow() otherwise keeps the current
    // time-of-day, which silently drops everything before that time on the
    // boundary day from the chart's leftmost bar and every period total below.
    const chartSince = this.daysFromNow(-days);
    chartSince.setHours(0, 0, 0, 0);
    // The window immediately preceding the selected one, same length, so
    // "vs previous period" is a fair comparison at any granularity the user
    // picks (day/week/month/year) rather than always meaning calendar month.
    const previousPeriodSince = this.daysFromNow(-2 * days);
    previousPeriodSince.setHours(0, 0, 0, 0);

    const [
      todaysSalesRevenue,
      todaysPurchaseExpenses,
      periodSales,
      periodPurchases,
      previousPeriodSales,
      previousPeriodPurchases,
      periodRevenueCost,
      previousPeriodRevenueCost,
      periodOutputTax,
      periodInputTax,
      todaysOutputTax,
      todaysInputTax,
      periodExpensesForComparison,
      previousPeriodExpenses,
      periodCustomerCount,
      previousPeriodCustomerCount,
      salesSeries,
      purchaseSeries,
      purchaseHistory,
      salesHistory,
      fastMoving,
      lowStockProducts,
      expiringSoon,
      topCustomers,
      newVsReturning,
      periodOrderCount,
      inactiveCustomers,
      categoryBreakdown,
      slowMoving,
      inventoryValuation,
      topMarginProducts,
      topSuppliers,
      paymentMethodBreakdown,
      expenseSummary,
      recentExpenses,
      orderStatusBreakdown,
      salesByDayOfWeek,
      salesmanPerformance,
      rxOtcSplit,
      allTimeTopCustomers,
      creditExposure,
      expenseTrend,
      supplierLeadTime,
      salesByHourOfDay,
      brandBreakdown,
      valueSegments,
    ] = await Promise.all([
      this.sumOrders(businessId, startOfToday),
      this.sumReceivedPurchases(businessId, startOfToday),
      this.sumOrdersBetween(businessId, chartSince, now),
      this.sumReceivedPurchasesBetween(businessId, chartSince, now),
      this.sumOrdersBetween(businessId, previousPeriodSince, chartSince),
      this.sumReceivedPurchasesBetween(businessId, previousPeriodSince, chartSince),
      this.revenueCostBetween(businessId, chartSince, now),
      this.revenueCostBetween(businessId, previousPeriodSince, chartSince),
      this.sumOrderTax(businessId, chartSince),
      this.sumPurchaseTax(businessId, chartSince),
      this.sumOrderTax(businessId, startOfToday),
      this.sumPurchaseTax(businessId, startOfToday),
      this.expenseSumBetween(businessId, chartSince, now),
      this.expenseSumBetween(businessId, previousPeriodSince, chartSince),
      this.distinctCustomerCountBetween(businessId, chartSince, now),
      this.distinctCustomerCountBetween(businessId, previousPeriodSince, chartSince),
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
      inventoryEnabled
        ? this.productsRepository
            .createQueryBuilder('product')
            .where('product.business_id = :businessId', { businessId })
            .andWhere('product.stock_quantity <= :threshold', { threshold: 10 })
            .andWhere('product.name != :placeholder', { placeholder: 'Table Session Started' })
            .orderBy('product.stock_quantity', 'ASC')
            .limit(10)
            .getMany()
        : Promise.resolve([]),
      showExpiry
        ? this.productsRepository
            .createQueryBuilder('product')
            .where('product.business_id = :businessId', { businessId })
            .andWhere('product.expiry_date IS NOT NULL')
            .andWhere('product.expiry_date >= :minDate', { minDate: this.daysFromNow(90) })
            .andWhere('product.expiry_date <= :maxDate', { maxDate: this.daysFromNow(180) })
            .orderBy('product.expiry_date', 'ASC')
            .limit(10)
            .getMany()
        : Promise.resolve([]),
      this.topCustomersSince(businessId, chartSince),
      this.newVsReturningSince(businessId, chartSince),
      this.orderCountSince(businessId, chartSince),
      this.inactiveCustomers(businessId),
      this.categoryBreakdownSince(businessId, chartSince),
      inventoryEnabled ? this.slowMovingStock(businessId, chartSince) : Promise.resolve([]),
      inventoryEnabled
        ? this.inventoryValuation(businessId)
        : Promise.resolve({ totalValue: 0, skuCount: 0, totalUnits: 0 }),
      this.topMarginProductsSince(businessId, chartSince),
      this.topSuppliersSince(businessId, chartSince),
      this.paymentMethodBreakdownSince(businessId, chartSince),
      this.expenseSummarySince(businessId, chartSince),
      this.recentExpenses(businessId),
      this.orderStatusBreakdownSince(businessId, chartSince),
      this.salesByDayOfWeekSince(businessId, chartSince),
      this.salesmanPerformanceSince(businessId, chartSince),
      this.rxOtcSplitSince(businessId, chartSince),
      this.topCustomersSince(businessId, new Date(0)),
      this.creditExposure(businessId),
      this.expenseTrendSince(businessId, chartSince),
      this.supplierLeadTimeSince(businessId, chartSince),
      this.salesByHourOfDaySince(businessId, chartSince),
      this.brandBreakdownSince(businessId, chartSince),
      this.valueSegmentsSince(businessId, chartSince),
    ]);

    const { chart, chartGranularity } = this.buildChartSeries(salesSeries, purchaseSeries, chartSince, now, days);

    const periodSalesTotal = chart.reduce((sum, row) => sum + row.sales, 0);
    const periodMargin = periodRevenueCost.revenue > 0
      ? ((periodRevenueCost.revenue - periodRevenueCost.cost) / periodRevenueCost.revenue) * 100
      : 0;
    const previousPeriodMargin = previousPeriodRevenueCost.revenue > 0
      ? ((previousPeriodRevenueCost.revenue - previousPeriodRevenueCost.cost) / previousPeriodRevenueCost.revenue) * 100
      : 0;
    const netProfit = periodRevenueCost.revenue - periodRevenueCost.cost - expenseSummary.total;
    const previousPeriodNetProfit = previousPeriodRevenueCost.revenue - previousPeriodRevenueCost.cost - previousPeriodExpenses;
    // Percent change vs the immediately preceding period of equal length;
    // when the previous period was zero, a positive current value reads as
    // "+100%" (went from nothing to something) rather than a divide-by-zero.
    const growthPercent = (current: number, previous: number) =>
      previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : (current > 0 ? 100 : 0);
    const cancellationCount = orderStatusBreakdown
      .filter((s) => s.status === 'cancelled' || s.status === 'returned')
      .reduce((sum, s) => sum + s.orderCount, 0);
    const totalOrderCount = orderStatusBreakdown.reduce((sum, s) => sum + s.orderCount, 0);
    const expiryValueAtRisk = expiringSoon.reduce(
      (sum, p) => sum + Number(p.stock_quantity) * Number(p.purchase_price ?? 0),
      0,
    );
    const netGstPayable = periodOutputTax - periodInputTax;
    const reorderSuggestions = await this.reorderSuggestions(businessId, chartSince, lowStockProducts, days);
    const actionItems = this.buildActionItems(reorderSuggestions, expiringSoon, slowMoving, creditExposure);

    return {
      meta: { category, inventoryEnabled },
      kpis: {
        todaysSalesRevenue,
        todaysPurchaseExpenses,
        grossProfitMargin: periodMargin,
        netCashFlow: periodSales - periodPurchases,
        taxSummary: {
          today: { outputGst: todaysOutputTax, inputGst: todaysInputTax },
          period: { outputGst: periodOutputTax, inputGst: periodInputTax },
        },
      },
      comparison: {
        salesGrowthPercent: growthPercent(periodSales, previousPeriodSales),
        purchasesGrowthPercent: growthPercent(periodPurchases, previousPeriodPurchases),
        marginChangePercent: periodMargin - previousPeriodMargin,
        netProfitGrowthPercent: growthPercent(netProfit, previousPeriodNetProfit),
        expensesGrowthPercent: growthPercent(periodExpensesForComparison, previousPeriodExpenses),
        customerCountGrowthPercent: growthPercent(periodCustomerCount, previousPeriodCustomerCount),
      },
      chart,
      chartGranularity,
      actionItems,
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
      customers: {
        topCustomers,
        newVsReturning,
        averageOrderValue: periodOrderCount > 0 ? periodSalesTotal / periodOrderCount : 0,
        inactiveCustomers,
        allTimeTopCustomers,
        creditExposure,
        valueSegments,
      },
      products: {
        categoryBreakdown,
        slowMoving,
        inventoryValuation,
        topMarginProducts,
        rxOtcSplit,
        expiryValueAtRisk,
        reorderSuggestions,
        brandBreakdown,
      },
      suppliers: {
        topSuppliers,
        leadTime: supplierLeadTime,
      },
      finance: {
        paymentMethodBreakdown,
        expenses: { total: expenseSummary.total, byCategory: expenseSummary.byCategory, recent: recentExpenses, trend: expenseTrend },
        netProfit,
        netGstPayable,
      },
      operations: {
        orderStatusBreakdown,
        cancellationRatePercent: totalOrderCount > 0 ? (cancellationCount / totalOrderCount) * 100 : 0,
        salesByDayOfWeek,
        salesByHourOfDay,
        salesmanPerformance,
      },
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

  private async sumOrdersBetween(businessId: string, from: Date, to: Date) {
    const result = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :from', { from })
      .andWhere('order.created_at < :to', { to })
      .select('COALESCE(SUM(order.total_amount), 0)', 'total')
      .getRawOne();
    return Number(result.total);
  }

  private async orderCountSince(businessId: string, since: Date) {
    return this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .getCount();
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

  private async sumReceivedPurchasesBetween(businessId: string, from: Date, to: Date) {
    const result = await this.purchaseOrdersRepository
      .createQueryBuilder('po')
      .where('po.business_id = :businessId', { businessId })
      .andWhere("po.status = 'received'")
      .andWhere('po.created_at >= :from AND po.created_at < :to', { from, to })
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

  /** Revenue and cost-of-goods for orders in [from, to), excluding draft/synthetic products — feeds both margin % and net profit, for both the current and previous comparison period. */
  private async revenueCostBetween(businessId: string, from: Date, to: Date) {
    const result = await this.orderItemsRepository
      .createQueryBuilder('item')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .leftJoin('products', 'product', 'product.id = item.product_id')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :from AND order.created_at < :to', { from, to })
      .andWhere('(product.is_draft IS NULL OR product.is_draft = false)')
      .select('COALESCE(SUM(item.subtotal), 0)', 'revenue')
      .addSelect('COALESCE(SUM(item.quantity * COALESCE(product.purchase_price, 0)), 0)', 'cost')
      .getRawOne();
    return { revenue: Number(result.revenue), cost: Number(result.cost) };
  }

  private async expenseSumBetween(businessId: string, from: Date, to: Date) {
    const result = await this.expensesRepository
      .createQueryBuilder('expense')
      .where('expense.business_id = :businessId', { businessId })
      .andWhere('expense.expense_date >= :from AND expense.expense_date < :to', { from, to })
      .select('COALESCE(SUM(expense.amount), 0)', 'total')
      .getRawOne();
    return Number(result.total);
  }

  private async distinctCustomerCountBetween(businessId: string, from: Date, to: Date) {
    const result = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.customer_id IS NOT NULL')
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :from AND order.created_at < :to', { from, to })
      .select('COUNT(DISTINCT order.customer_id)', 'count')
      .getRawOne();
    return Number(result.count);
  }

  private async topCustomersSince(businessId: string, since: Date, limit = 10) {
    const rows = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.customer_id IS NOT NULL')
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .select('order.customer_id', 'customerId')
      .addSelect('order.customer_name', 'customerName')
      .addSelect('COUNT(order.id)', 'orderCount')
      .addSelect('SUM(order.total_amount)', 'totalSpent')
      .groupBy('order.customer_id')
      .addGroupBy('order.customer_name')
      .orderBy('"totalSpent"', 'DESC')
      .limit(limit)
      .getRawMany();
    return rows.map((r) => ({
      customerId: r.customerId,
      customerName: r.customerName,
      orderCount: Number(r.orderCount),
      totalSpent: Number(r.totalSpent),
    }));
  }

  /**
   * A customer is "new" if their all-time first order falls inside this
   * period, "returning" otherwise. Two queries merged in app code (period
   * totals, then all-time first-order date for just those customers) rather
   * than one window-function query, since the "all-time" half must ignore
   * the period filter entirely.
   */
  private async newVsReturningSince(businessId: string, since: Date) {
    const periodRows = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.customer_id IS NOT NULL')
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .select('order.customer_id', 'customerId')
      .addSelect('SUM(order.total_amount)', 'periodTotal')
      .groupBy('order.customer_id')
      .getRawMany();

    if (periodRows.length === 0) {
      return { newCustomers: 0, newRevenue: 0, returningCustomers: 0, returningRevenue: 0 };
    }

    const customerIds = periodRows.map((r) => r.customerId);
    const firstOrderRows = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.customer_id IN (:...customerIds)', { customerIds })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .select('order.customer_id', 'customerId')
      .addSelect('MIN(order.created_at)', 'firstOrderAt')
      .groupBy('order.customer_id')
      .getRawMany();
    const firstOrderMap = new Map(firstOrderRows.map((r) => [r.customerId, new Date(r.firstOrderAt)]));

    let newCustomers = 0, newRevenue = 0, returningCustomers = 0, returningRevenue = 0;
    for (const row of periodRows) {
      const firstOrderAt = firstOrderMap.get(row.customerId);
      if (firstOrderAt && firstOrderAt >= since) {
        newCustomers += 1;
        newRevenue += Number(row.periodTotal);
      } else {
        returningCustomers += 1;
        returningRevenue += Number(row.periodTotal);
      }
    }
    return { newCustomers, newRevenue, returningCustomers, returningRevenue };
  }

  /** Customers with real order history but no order in the last 30 days — the "days since last order" proxy for AR risk described above. */
  private async inactiveCustomers(businessId: string, inactiveDays = 30, limit = 10) {
    const cutoff = this.daysFromNow(-inactiveDays);
    const rows = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.customer_id IS NOT NULL')
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .select('order.customer_id', 'customerId')
      .addSelect('order.customer_name', 'customerName')
      .addSelect('MAX(order.created_at)', 'lastOrderAt')
      .addSelect('SUM(order.total_amount)', 'lifetimeSpent')
      .groupBy('order.customer_id')
      .addGroupBy('order.customer_name')
      .having('MAX(order.created_at) < :cutoff', { cutoff })
      .orderBy('"lastOrderAt"', 'ASC')
      .limit(limit)
      .getRawMany();
    return rows.map((r) => ({
      customerId: r.customerId,
      customerName: r.customerName,
      lastOrderAt: r.lastOrderAt,
      lifetimeSpent: Number(r.lifetimeSpent),
    }));
  }

  /** Every customer with a period order, ranked by spend and split into equal-count High/Medium/Low thirds — a coarser, whole-base view than the top-10 list. */
  private async valueSegmentsSince(businessId: string, since: Date) {
    const rows = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.customer_id IS NOT NULL')
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .select('order.customer_id', 'customerId')
      .addSelect('SUM(order.total_amount)', 'totalSpent')
      .groupBy('order.customer_id')
      .orderBy('"totalSpent"', 'DESC')
      .getRawMany();

    if (rows.length === 0) {
      return [];
    }

    const third = Math.ceil(rows.length / 3);
    const tiers: { tier: 'High' | 'Medium' | 'Low'; rows: typeof rows }[] = [
      { tier: 'High', rows: rows.slice(0, third) },
      { tier: 'Medium', rows: rows.slice(third, third * 2) },
      { tier: 'Low', rows: rows.slice(third * 2) },
    ];
    return tiers
      .filter((t) => t.rows.length > 0)
      .map((t) => ({
        tier: t.tier,
        customerCount: t.rows.length,
        totalRevenue: t.rows.reduce((sum, r) => sum + Number(r.totalSpent), 0),
      }));
  }

  /** product.category is a denormalized string copy of Category.name (see categories.service.ts), not an FK — grouped directly, not joined. */
  private async categoryBreakdownSince(businessId: string, since: Date) {
    const rows = await this.orderItemsRepository
      .createQueryBuilder('item')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .leftJoin('products', 'product', 'product.id = item.product_id')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .select("COALESCE(product.category, 'Uncategorized')", 'category')
      .addSelect('SUM(item.subtotal)', 'totalRevenue')
      .addSelect('SUM(item.quantity)', 'totalQuantity')
      .groupBy("COALESCE(product.category, 'Uncategorized')")
      .orderBy('"totalRevenue"', 'DESC')
      .getRawMany();
    return rows.map((r) => ({
      category: r.category,
      totalRevenue: Number(r.totalRevenue),
      totalQuantity: Number(r.totalQuantity),
    }));
  }

  /** Same shape as categoryBreakdownSince but grouped by product.brand — a plain varchar column, same denormalization caveat applies. */
  private async brandBreakdownSince(businessId: string, since: Date) {
    const rows = await this.orderItemsRepository
      .createQueryBuilder('item')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .leftJoin('products', 'product', 'product.id = item.product_id')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .select("COALESCE(product.brand, 'Unbranded')", 'brand')
      .addSelect('SUM(item.subtotal)', 'totalRevenue')
      .addSelect('SUM(item.quantity)', 'totalQuantity')
      .groupBy("COALESCE(product.brand, 'Unbranded')")
      .orderBy('"totalRevenue"', 'DESC')
      .getRawMany();
    return rows.map((r) => ({
      brand: r.brand,
      totalRevenue: Number(r.totalRevenue),
      totalQuantity: Number(r.totalQuantity),
    }));
  }

  /** In-stock products with zero units sold in the period, ranked by ₹ tied up (stock × cost) — the biggest dead-stock risk first. */
  private async slowMovingStock(businessId: string, since: Date, limit = 10) {
    const candidates = await this.productsRepository
      .createQueryBuilder('product')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.is_draft = false')
      .andWhere('product.is_archived = false')
      .andWhere('product.stock_quantity > 0')
      .select('product.id', 'id')
      .addSelect('product.name', 'name')
      .addSelect('product.stock_quantity', 'stockQuantity')
      .addSelect('product.purchase_price', 'purchasePrice')
      .getRawMany();

    if (candidates.length === 0) {
      return [];
    }

    const soldRows = await this.orderItemsRepository
      .createQueryBuilder('item')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .andWhere('item.product_id IS NOT NULL')
      .select('item.product_id', 'productId')
      .addSelect('SUM(item.quantity)', 'soldQty')
      .groupBy('item.product_id')
      .getRawMany();
    const soldMap = new Map(soldRows.map((r) => [r.productId, Number(r.soldQty)]));

    return candidates
      .filter((c) => (soldMap.get(c.id) ?? 0) === 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        stockQuantity: Number(c.stockQuantity),
        tiedUpValue: Number(c.stockQuantity) * Number(c.purchasePrice ?? 0),
      }))
      .sort((a, b) => b.tiedUpValue - a.tiedUpValue)
      .slice(0, limit);
  }

  private async inventoryValuation(businessId: string) {
    const result = await this.productsRepository
      .createQueryBuilder('product')
      .where('product.business_id = :businessId', { businessId })
      .andWhere('product.is_draft = false')
      .andWhere('product.is_archived = false')
      .select('COALESCE(SUM(product.stock_quantity * COALESCE(product.purchase_price, 0)), 0)', 'totalValue')
      .addSelect('COUNT(*)', 'skuCount')
      .addSelect('COALESCE(SUM(product.stock_quantity), 0)', 'totalUnits')
      .getRawOne();
    return {
      totalValue: Number(result.totalValue),
      skuCount: Number(result.skuCount),
      totalUnits: Number(result.totalUnits),
    };
  }

  /** Same shape as fastMoving but ranked by ₹ margin instead of quantity — top-revenue and top-margin items often differ. */
  private async topMarginProductsSince(businessId: string, since: Date, limit = 5) {
    const rows = await this.orderItemsRepository
      .createQueryBuilder('item')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .innerJoin('products', 'product', 'product.id = item.product_id')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .andWhere('product.is_draft = false')
      .select('item.product_id', 'productId')
      .addSelect('product.name', 'productName')
      .addSelect('SUM(item.subtotal - item.quantity * COALESCE(product.purchase_price, 0))', 'totalMargin')
      .addSelect('SUM(item.quantity)', 'totalQuantity')
      .groupBy('item.product_id')
      .addGroupBy('product.name')
      .orderBy('"totalMargin"', 'DESC')
      .limit(limit)
      .getRawMany();
    return rows.map((r) => ({
      productId: r.productId,
      productName: r.productName ?? 'Unknown product',
      totalMargin: Number(r.totalMargin),
      totalQuantity: Number(r.totalQuantity),
    }));
  }

  private async topSuppliersSince(businessId: string, since: Date, limit = 10) {
    const rows = await this.purchaseOrdersRepository
      .createQueryBuilder('po')
      .innerJoin('suppliers', 'supplier', 'supplier.id = po.supplier_id')
      .where('po.business_id = :businessId', { businessId })
      .andWhere("po.status = 'received'")
      .andWhere('po.created_at >= :since', { since })
      .select('po.supplier_id', 'supplierId')
      .addSelect('supplier.name', 'supplierName')
      .addSelect('COUNT(po.id)', 'orderCount')
      .addSelect('SUM(po.total_amount)', 'totalSpent')
      .groupBy('po.supplier_id')
      .addGroupBy('supplier.name')
      .orderBy('"totalSpent"', 'DESC')
      .limit(limit)
      .getRawMany();
    return rows.map((r) => ({
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      orderCount: Number(r.orderCount),
      totalSpent: Number(r.totalSpent),
    }));
  }

  /** payment_method is a free varchar (see PAYMENT_METHODS in billing/dto/create-payment.dto.ts for the canonical set) — bucket anything unexpected as "Other" rather than erroring. Refunds are already negative amounts, so a plain SUM nets them correctly. */
  private async paymentMethodBreakdownSince(businessId: string, since: Date) {
    const rows = await this.paymentsRepository
      .createQueryBuilder('payment')
      .where('payment.business_id = :businessId', { businessId })
      .andWhere('payment.created_at >= :since', { since })
      .select("COALESCE(payment.payment_method, 'Other')", 'method')
      .addSelect('SUM(payment.amount)', 'total')
      .groupBy("COALESCE(payment.payment_method, 'Other')")
      .orderBy('"total"', 'DESC')
      .getRawMany();
    return rows.map((r) => ({ method: r.method, total: Number(r.total) }));
  }

  private async expenseSummarySince(businessId: string, since: Date) {
    const rows = await this.expensesRepository
      .createQueryBuilder('expense')
      .where('expense.business_id = :businessId', { businessId })
      .andWhere('expense.expense_date >= :since', { since })
      .select("COALESCE(expense.category, 'Uncategorized')", 'category')
      .addSelect('SUM(expense.amount)', 'total')
      .groupBy("COALESCE(expense.category, 'Uncategorized')")
      .orderBy('"total"', 'DESC')
      .getRawMany();
    const byCategory = rows.map((r) => ({ category: r.category, total: Number(r.total) }));
    return { total: byCategory.reduce((sum, r) => sum + r.total, 0), byCategory };
  }

  private async recentExpenses(businessId: string, limit = 10) {
    return this.expensesRepository.find({
      where: { business_id: businessId },
      order: { expense_date: 'DESC', created_at: 'DESC' },
      take: limit,
    });
  }

  private async orderStatusBreakdownSince(businessId: string, since: Date) {
    const rows = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.created_at >= :since', { since })
      .select('order.status', 'status')
      .addSelect('COUNT(order.id)', 'orderCount')
      .addSelect('COALESCE(SUM(order.total_amount), 0)', 'totalAmount')
      .groupBy('order.status')
      .getRawMany();
    return rows.map((r) => ({
      status: r.status,
      orderCount: Number(r.orderCount),
      totalAmount: Number(r.totalAmount),
    }));
  }

  private async salesByDayOfWeekSince(businessId: string, since: Date) {
    const rows = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .select('EXTRACT(DOW FROM order.created_at)', 'dayOfWeek')
      .addSelect('COALESCE(SUM(order.total_amount), 0)', 'total')
      .groupBy('EXTRACT(DOW FROM order.created_at)')
      .getRawMany();
    const byDay = DAY_LABELS.map((day) => ({ day, total: 0 }));
    for (const r of rows) {
      const idx = Number(r.dayOfWeek);
      if (byDay[idx]) {
        byDay[idx].total = Number(r.total);
      }
    }
    return byDay;
  }

  /**
   * Only computed if the business has any Salesman rows — Order links to a
   * salesman indirectly (order.created_by_user_id -> users.id ->
   * salesmen.user_id), which is legitimately null/sparse for shops that
   * don't use the field-sales module, so an empty array here means "not
   * used", not "no sales".
   */
  private async salesmanPerformanceSince(businessId: string, since: Date, limit = 10) {
    const salesmanCount = await this.salesmenRepository.count({ where: { business_id: businessId } });
    if (salesmanCount === 0) {
      return [];
    }

    const rows = await this.ordersRepository
      .createQueryBuilder('order')
      .innerJoin('users', 'u', 'u.id = order.created_by_user_id')
      .innerJoin('salesmen', 'sm', 'sm.user_id = u.id')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .select('sm.id', 'salesmanId')
      .addSelect('sm.name', 'salesmanName')
      .addSelect('COUNT(order.id)', 'orderCount')
      .addSelect('SUM(order.total_amount)', 'totalSales')
      .groupBy('sm.id')
      .addGroupBy('sm.name')
      .orderBy('"totalSales"', 'DESC')
      .limit(limit)
      .getRawMany();
    return rows.map((r) => ({
      salesmanId: r.salesmanId,
      salesmanName: r.salesmanName,
      orderCount: Number(r.orderCount),
      totalSales: Number(r.totalSales),
    }));
  }

  /** Prescription vs OTC revenue split, since product.prescription_required only matters for pharmacy businesses (frontend renders it conditionally). */
  private async rxOtcSplitSince(businessId: string, since: Date) {
    const rows = await this.orderItemsRepository
      .createQueryBuilder('item')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .leftJoin('products', 'product', 'product.id = item.product_id')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .select('COALESCE(product.prescription_required, false)', 'prescriptionRequired')
      .addSelect('SUM(item.subtotal)', 'totalRevenue')
      .addSelect('SUM(item.quantity)', 'totalQuantity')
      .groupBy('COALESCE(product.prescription_required, false)')
      .getRawMany();
    const rx = rows.find((r) => r.prescriptionRequired === true);
    const otc = rows.find((r) => r.prescriptionRequired !== true);
    return {
      rx: { totalRevenue: Number(rx?.totalRevenue || 0), totalQuantity: Number(rx?.totalQuantity || 0) },
      otc: { totalRevenue: Number(otc?.totalRevenue || 0), totalQuantity: Number(otc?.totalQuantity || 0) },
    };
  }

  /** Customers who've used 80%+ of their credit_limit — only meaningful for customers with a limit actually set. */
  private async creditExposure(businessId: string, limit = 10) {
    const rows = await this.customersRepository
      .createQueryBuilder('customer')
      .where('customer.business_id = :businessId', { businessId })
      .andWhere('customer.credit_limit > 0')
      .andWhere('customer.outstanding_amount >= customer.credit_limit * 0.8')
      .select('customer.id', 'id')
      .addSelect('customer.name', 'name')
      .addSelect('customer.outstanding_amount', 'outstandingAmount')
      .addSelect('customer.credit_limit', 'creditLimit')
      .orderBy('(customer.outstanding_amount / customer.credit_limit)', 'DESC')
      .limit(limit)
      .getRawMany();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      outstandingAmount: Number(r.outstandingAmount),
      creditLimit: Number(r.creditLimit),
      utilizationPercent: Number(r.creditLimit) > 0 ? (Number(r.outstandingAmount) / Number(r.creditLimit)) * 100 : 0,
    }));
  }

  private async expenseTrendSince(businessId: string, since: Date) {
    const rows = await this.expensesRepository
      .createQueryBuilder('expense')
      .where('expense.business_id = :businessId', { businessId })
      .andWhere('expense.expense_date >= :since', { since })
      .select('expense.expense_date', 'date')
      .addSelect('SUM(expense.amount)', 'total')
      .groupBy('expense.expense_date')
      .orderBy('expense.expense_date', 'ASC')
      .getRawMany();
    return rows.map((r) => ({ date: r.date, total: Number(r.total) }));
  }

  /** Average days from PO creation to being marked received — there's no dedicated received_at column, so updated_at is the proxy (set exactly when receivePurchaseOrder() flips status). */
  private async supplierLeadTimeSince(businessId: string, since: Date) {
    const rows = await this.purchaseOrdersRepository
      .createQueryBuilder('po')
      .innerJoin('suppliers', 'supplier', 'supplier.id = po.supplier_id')
      .where('po.business_id = :businessId', { businessId })
      .andWhere("po.status = 'received'")
      .andWhere('po.created_at >= :since', { since })
      .select('po.supplier_id', 'supplierId')
      .addSelect('supplier.name', 'supplierName')
      .addSelect('AVG(EXTRACT(EPOCH FROM (po.updated_at - po.created_at)) / 86400)', 'avgDays')
      .addSelect('COUNT(po.id)', 'orderCount')
      .groupBy('po.supplier_id')
      .addGroupBy('supplier.name')
      .orderBy('"avgDays"', 'ASC')
      .getRawMany();
    return rows.map((r) => ({
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      avgLeadTimeDays: Number(r.avgDays),
      orderCount: Number(r.orderCount),
    }));
  }

  private async salesByHourOfDaySince(businessId: string, since: Date) {
    const rows = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .select('EXTRACT(HOUR FROM order.created_at)', 'hour')
      .addSelect('COALESCE(SUM(order.total_amount), 0)', 'total')
      .groupBy('EXTRACT(HOUR FROM order.created_at)')
      .getRawMany();
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0 }));
    for (const r of rows) {
      const idx = Number(r.hour);
      if (byHour[idx]) {
        byHour[idx].total = Number(r.total);
      }
    }
    return byHour;
  }

  /** Low-stock items with measurable 30-day sales velocity, ranked by estimated days until stockout — the reorder shortlist. */
  private async reorderSuggestions(businessId: string, since: Date, lowStockProducts: Product[], periodDays: number) {
    if (lowStockProducts.length === 0) {
      return [];
    }
    const ids = lowStockProducts.map((p) => p.id);
    const soldRows = await this.orderItemsRepository
      .createQueryBuilder('item')
      .innerJoin('orders', 'order', 'order.id = item.order_id')
      .where('order.business_id = :businessId', { businessId })
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: UNBILLED_ORDER_STATUSES })
      .andWhere('order.created_at >= :since', { since })
      .andWhere('item.product_id IN (:...ids)', { ids })
      .select('item.product_id', 'productId')
      .addSelect('SUM(item.quantity)', 'soldQty')
      .groupBy('item.product_id')
      .getRawMany();
    const soldMap = new Map(soldRows.map((r) => [r.productId, Number(r.soldQty)]));

    return lowStockProducts
      .map((p) => {
        const sold = soldMap.get(p.id) ?? 0;
        const velocityPerDay = sold / periodDays;
        const daysLeft = velocityPerDay > 0 ? Number(p.stock_quantity) / velocityPerDay : null;
        return { id: p.id, name: p.name, stockQuantity: Number(p.stock_quantity), velocityPerDay, daysLeft };
      })
      .filter((r) => r.daysLeft !== null)
      .sort((a, b) => (a.daysLeft as number) - (b.daysLeft as number));
  }

  /**
   * Merges reorder/expiry/dead-stock/credit signals into one ranked "what needs
   * attention today" list, instead of making the owner check four separate tabs.
   * Severity is ranked (high > medium > low) and ties broken by ₹ value where
   * one exists, so the biggest, most urgent problems surface first.
   */
  private buildActionItems(
    reorderSuggestions: { id: string; name: string; stockQuantity: number; velocityPerDay: number; daysLeft: number | null }[],
    expiringSoon: Product[],
    slowMoving: { id: string; name: string; stockQuantity: number; tiedUpValue: number }[],
    creditExposure: { id: string; name: string; outstandingAmount: number; creditLimit: number; utilizationPercent: number }[],
  ) {
    type ActionItem = {
      id: string;
      type: 'reorder' | 'expiry' | 'slow-moving' | 'credit';
      severity: 'high' | 'medium' | 'low';
      title: string;
      subtitle: string;
      value: number | null;
    };
    const items: ActionItem[] = [];

    for (const p of reorderSuggestions) {
      if (p.daysLeft === null || p.daysLeft > 14) continue;
      items.push({
        id: `reorder-${p.id}`,
        type: 'reorder',
        severity: p.daysLeft <= 3 ? 'high' : 'medium',
        title: p.name,
        subtitle: p.daysLeft <= 0
          ? `Out of stock · was selling ${p.velocityPerDay.toFixed(2)}/day`
          : `${p.stockQuantity} left · ~${Math.round(p.daysLeft)} days of stock at current pace`,
        value: null,
      });
    }

    const now = Date.now();
    for (const p of expiringSoon.slice(0, 5)) {
      if (!p.expiry_date) continue;
      const daysUntilExpiry = (new Date(p.expiry_date).getTime() - now) / 86400000;
      items.push({
        id: `expiry-${p.id}`,
        type: 'expiry',
        severity: daysUntilExpiry <= 120 ? 'high' : daysUntilExpiry <= 150 ? 'medium' : 'low',
        title: p.name,
        subtitle: `Batch ${p.batch_number ?? '—'} · expires ${new Date(p.expiry_date).toISOString().slice(0, 10)}`,
        value: Number(p.stock_quantity) * Number(p.purchase_price ?? 0),
      });
    }

    slowMoving.slice(0, 3).forEach((p, idx) => {
      items.push({
        id: `slow-moving-${p.id}`,
        type: 'slow-moving',
        severity: idx === 0 ? 'high' : 'medium',
        title: p.name,
        subtitle: `${p.stockQuantity} units in stock, zero sold this period`,
        value: p.tiedUpValue,
      });
    });

    for (const c of creditExposure.slice(0, 5)) {
      items.push({
        id: `credit-${c.id}`,
        type: 'credit',
        severity: c.utilizationPercent >= 100 ? 'high' : c.utilizationPercent >= 90 ? 'medium' : 'low',
        title: c.name,
        subtitle: `${c.utilizationPercent.toFixed(0)}% of credit limit used`,
        value: c.outstandingAmount,
      });
    }

    const severityRank = { high: 3, medium: 2, low: 1 };
    return items
      .sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || (b.value ?? 0) - (a.value ?? 0))
      .slice(0, 12);
  }

  /**
   * Zero-fills every calendar day in [chartSince, now] before bucketing, so a day
   * with no sales/purchases shows as a flat bar instead of vanishing from the
   * x-axis entirely — the raw GROUP BY query only returns days that had activity,
   * which otherwise makes the timeline look denser/shorter than it really is.
   * Long ranges are then bucketed to week/month so the chart stays readable
   * instead of rendering hundreds of daily bars.
   *
   * Date keys are built from local y/m/d components throughout (never
   * `Date#toISOString`, which normalizes to UTC) so they line up with the plain
   * "YYYY-MM-DD" strings Postgres returns for `DATE(order.created_at)`.
   */
  private buildChartSeries(
    salesSeries: { date: string; total: string | number }[],
    purchaseSeries: { date: string; total: string | number }[],
    chartSince: Date,
    now: Date,
    days: number,
  ) {
    const dailyMap = new Map<string, { sales: number; purchases: number }>();
    const cursor = new Date(chartSince.getFullYear(), chartSince.getMonth(), chartSince.getDate());
    const endKey = this.toDateKey(now);
    while (this.toDateKey(cursor) <= endKey) {
      dailyMap.set(this.toDateKey(cursor), { sales: 0, purchases: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const row of salesSeries) {
      const entry = dailyMap.get(row.date) ?? { sales: 0, purchases: 0 };
      entry.sales = Number(row.total);
      dailyMap.set(row.date, entry);
    }
    for (const row of purchaseSeries) {
      const entry = dailyMap.get(row.date) ?? { sales: 0, purchases: 0 };
      entry.purchases = Number(row.total);
      dailyMap.set(row.date, entry);
    }

    const dailyRows = Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, sales: v.sales, purchases: v.purchases }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const chartGranularity: 'day' | 'week' | 'month' = days <= 60 ? 'day' : days <= 180 ? 'week' : 'month';
    if (chartGranularity === 'day') {
      return { chart: dailyRows, chartGranularity };
    }

    const bucketMap = new Map<string, { sales: number; purchases: number }>();
    for (const row of dailyRows) {
      const bucketKey = chartGranularity === 'week' ? this.weekStartKey(row.date) : `${row.date.slice(0, 7)}-01`;
      const entry = bucketMap.get(bucketKey) ?? { sales: 0, purchases: 0 };
      entry.sales += row.sales;
      entry.purchases += row.purchases;
      bucketMap.set(bucketKey, entry);
    }
    const chart = Array.from(bucketMap.entries())
      .map(([date, v]) => ({ date, sales: v.sales, purchases: v.purchases }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    return { chart, chartGranularity };
  }

  private toDateKey(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private weekStartKey(dateKey: string) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - date.getDay());
    return this.toDateKey(date);
  }

  private daysFromNow(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }
}
