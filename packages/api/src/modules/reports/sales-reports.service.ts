import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Product } from '../../database/entities/product.entity';
import { PurchaseItem } from '../../database/entities/purchase-item.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Expense } from '../../database/entities/expense.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { parseRange } from './ledger-reports.service';

const UNBILLED_ORDER_STATUSES = ['draft', 'cancelled', 'returned'];
const MAX_ROWS = 1000;

const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (profit: number, revenue: number) => (revenue > 0 ? round2((profit / revenue) * 100) : 0);

@Injectable()
export class SalesReportsService {
  constructor(
    @InjectRepository(Order) private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    @InjectRepository(PurchaseItem) private purchaseItemsRepository: Repository<PurchaseItem>,
    @InjectRepository(Payment) private paymentsRepository: Repository<Payment>,
    @InjectRepository(Expense) private expensesRepository: Repository<Expense>,
    @InjectRepository(PurchaseOrder) private purchaseOrdersRepository: Repository<PurchaseOrder>,
  ) {}

  /**
   * Money in vs money out for the period, split by how it was paid. In = payments actually received
   * (the label-only 'Credit' method never moves money). Out = expenses plus purchases received from
   * suppliers — purchases count on the day they were received, not when the supplier was paid, because
   * supplier payments are tracked only as a running balance. Days are IST calendar days.
   */
  async moneyFlow(businessId: string, from?: string, to?: string) {
    const { start, end } = parseRange(from, to);
    const day = (col: string) => `to_char(${col} AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')`;

    const received = () =>
      this.paymentsRepository
        .createQueryBuilder('p')
        .where('p.business_id = :businessId', { businessId })
        .andWhere("p.status = 'completed'")
        .andWhere('p.payment_method IS DISTINCT FROM :credit', { credit: 'Credit' })
        .andWhere('p.created_at BETWEEN :start AND :end', { start, end });
    const expenses = () =>
      this.expensesRepository
        .createQueryBuilder('e')
        .where('e.business_id = :businessId', { businessId })
        .andWhere('e.created_at BETWEEN :start AND :end', { start, end });
    const purchases = () =>
      this.purchaseOrdersRepository
        .createQueryBuilder('po')
        .where('po.business_id = :businessId', { businessId })
        .andWhere("po.status IN ('received', 'paid')")
        .andWhere('po.updated_at BETWEEN :start AND :end', { start, end });

    const [inByMethod, inByDay, expByCategory, expByDay, purchaseTotal, purchaseByDay] = await Promise.all([
      received()
        .select("COALESCE(p.payment_method, 'Other')", 'label')
        .addSelect('SUM(p.amount)', 'total')
        .addSelect('COUNT(*)', 'count')
        .groupBy("COALESCE(p.payment_method, 'Other')")
        .orderBy('"total"', 'DESC')
        .getRawMany(),
      received().select(day('p.created_at'), 'day').addSelect('SUM(p.amount)', 'total').groupBy('1').getRawMany(),
      expenses()
        .select("COALESCE(e.category, 'Uncategorised')", 'label')
        .addSelect('SUM(e.amount)', 'total')
        .addSelect('COUNT(*)', 'count')
        .groupBy("COALESCE(e.category, 'Uncategorised')")
        .orderBy('"total"', 'DESC')
        .getRawMany(),
      expenses().select(day('e.created_at'), 'day').addSelect('SUM(e.amount)', 'total').groupBy('1').getRawMany(),
      purchases().select('COALESCE(SUM(po.total_amount), 0)', 'total').addSelect('COUNT(*)', 'count').getRawOne(),
      purchases().select(day('po.updated_at'), 'day').addSelect('SUM(po.total_amount)', 'total').groupBy('1').getRawMany(),
    ]);

    const rowsOf = (rows: any[]) => rows.map((r) => ({ label: r.label as string, total: round2(Number(r.total)), count: Number(r.count) }));
    const moneyInByMethod = rowsOf(inByMethod);
    const expenseByCategory = rowsOf(expByCategory);
    const purchaseSummary = { total: round2(Number(purchaseTotal.total)), count: Number(purchaseTotal.count) };

    const days = new Map<string, { moneyIn: number; moneyOut: number }>();
    const add = (rows: any[], key: 'moneyIn' | 'moneyOut') => {
      for (const r of rows) {
        const d = days.get(r.day) ?? { moneyIn: 0, moneyOut: 0 };
        d[key] += Number(r.total);
        days.set(r.day, d);
      }
    };
    add(inByDay, 'moneyIn');
    add(expByDay, 'moneyOut');
    add(purchaseByDay, 'moneyOut');

    const totalIn = moneyInByMethod.reduce((sum, m) => sum + m.total, 0);
    const totalOut = expenseByCategory.reduce((sum, m) => sum + m.total, 0) + purchaseSummary.total;
    const cashIn = moneyInByMethod.filter((m) => m.label === 'Cash').reduce((sum, m) => sum + m.total, 0);

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      moneyInByMethod,
      expenseByCategory,
      purchases: purchaseSummary,
      daily: [...days.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, d]) => ({ date, moneyIn: round2(d.moneyIn), moneyOut: round2(d.moneyOut), net: round2(d.moneyIn - d.moneyOut) })),
      totals: {
        moneyIn: round2(totalIn),
        moneyOut: round2(totalOut),
        net: round2(totalIn - totalOut),
        cashIn: round2(cashIn),
        digitalIn: round2(totalIn - cashIn),
      },
    };
  }

  /**
   * Profit per bill. Same basis as the Overview profit figure: revenue is the pre-tax line total,
   * cost is quantity x the product's current purchase price. Free-text items have no cost basis and
   * count as zero cost — `uncostedLines` tells the caller how many bills are affected.
   */
  async saleWiseProfit(businessId: string, from?: string, to?: string) {
    const { start, end } = parseRange(from, to);

    const base = () =>
      this.orderItemsRepository
        .createQueryBuilder('i')
        .innerJoin('orders', 'o', 'o.id = i.order_id')
        .leftJoin('products', 'p', 'p.id = i.product_id')
        .where('o.business_id = :businessId', { businessId })
        .andWhere('o.status NOT IN (:...excluded)', { excluded: UNBILLED_ORDER_STATUSES })
        .andWhere('o.created_at BETWEEN :start AND :end', { start, end });

    const [rows, totalRow, billCount] = await Promise.all([
      base()
        .select('o.id', 'id')
        .addSelect('o.order_number', 'orderNumber')
        .addSelect('o.created_at', 'createdAt')
        .addSelect('o.customer_name', 'customerName')
        .addSelect('COALESCE(SUM(i.subtotal), 0)', 'revenue')
        .addSelect('COALESCE(SUM(i.quantity * COALESCE(p.purchase_price, 0)), 0)', 'cost')
        .addSelect('COUNT(i.id)', 'lines')
        .addSelect('COALESCE(SUM(CASE WHEN i.product_id IS NULL THEN 1 ELSE 0 END), 0)', 'uncostedLines')
        .groupBy('o.id')
        .addGroupBy('o.order_number')
        .addGroupBy('o.created_at')
        .addGroupBy('o.customer_name')
        .orderBy('o.created_at', 'DESC')
        .limit(MAX_ROWS)
        .getRawMany(),
      base()
        .select('COALESCE(SUM(i.subtotal), 0)', 'revenue')
        .addSelect('COALESCE(SUM(i.quantity * COALESCE(p.purchase_price, 0)), 0)', 'cost')
        .getRawOne(),
      base().select('COUNT(DISTINCT o.id)', 'count').getRawOne(),
    ]);

    const sales = rows.map((r) => {
      const revenue = Number(r.revenue);
      const cost = Number(r.cost);
      return {
        id: r.id,
        orderNumber: r.orderNumber,
        createdAt: new Date(r.createdAt).toISOString(),
        customerName: r.customerName || 'Walk-in',
        revenue: round2(revenue),
        cost: round2(cost),
        profit: round2(revenue - cost),
        marginPercent: pct(revenue - cost, revenue),
        uncostedLines: Number(r.uncostedLines),
      };
    });
    const revenue = Number(totalRow.revenue);
    const cost = Number(totalRow.cost);
    const billTotal = Number(billCount.count);

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      sales,
      truncated: billTotal > sales.length,
      totals: {
        bills: billTotal,
        revenue: round2(revenue),
        cost: round2(cost),
        profit: round2(revenue - cost),
        marginPercent: pct(revenue - cost, revenue),
        lossMakingBills: sales.filter((s) => s.profit < 0).length,
      },
    };
  }

  /** Sales per team member (whoever created the bill). Bills with no creator — QR/online orders — are grouped separately. */
  async staffWiseSales(businessId: string, from?: string, to?: string) {
    const { start, end } = parseRange(from, to);

    const rows = await this.ordersRepository
      .createQueryBuilder('o')
      .leftJoin('users', 'u', 'u.id = o.created_by_user_id')
      .where('o.business_id = :businessId', { businessId })
      .andWhere('o.status NOT IN (:...excluded)', { excluded: UNBILLED_ORDER_STATUSES })
      .andWhere('o.created_at BETWEEN :start AND :end', { start, end })
      .select('u.id', 'userId')
      .addSelect('u.full_name', 'name')
      .addSelect('u.role', 'role')
      .addSelect('COUNT(o.id)', 'bills')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'sales')
      .addSelect('COALESCE(SUM(o.tax_amount), 0)', 'tax')
      .groupBy('u.id')
      .addGroupBy('u.full_name')
      .addGroupBy('u.role')
      .orderBy('"sales"', 'DESC')
      .getRawMany();

    const staff = rows.map((r) => {
      const bills = Number(r.bills);
      const sales = Number(r.sales);
      return {
        userId: r.userId || null,
        name: r.userId ? r.name || 'Unnamed' : 'QR / online / unassigned',
        role: r.role || null,
        bills,
        sales: round2(sales),
        tax: round2(Number(r.tax)),
        averageBill: bills > 0 ? round2(sales / bills) : 0,
      };
    });
    const totalSales = staff.reduce((sum, s) => sum + s.sales, 0);

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      staff: staff.map((s) => ({ ...s, sharePercent: totalSales > 0 ? round2((s.sales / totalSales) * 100) : 0 })),
      totals: { bills: staff.reduce((sum, s) => sum + s.bills, 0), sales: round2(totalSales) },
    };
  }

  /**
   * Item-wise stock position. Current stock and value are exact; purchased/sold are the quantities
   * received and billed in the period. Sales do not write stock-ledger rows, so an opening/closing
   * balance can't be reconstructed reliably and is deliberately not shown.
   */
  async stockSummary(businessId: string, from?: string, to?: string) {
    const { start, end } = parseRange(from, to);

    const [products, sold, purchased] = await Promise.all([
      this.productsRepository
        .createQueryBuilder('p')
        .where('p.business_id = :businessId', { businessId })
        .andWhere('p.is_draft = false')
        .andWhere('p.is_archived = false')
        .orderBy('p.name', 'ASC')
        .limit(2000)
        .getMany(),
      this.orderItemsRepository
        .createQueryBuilder('i')
        .innerJoin('orders', 'o', 'o.id = i.order_id')
        .where('o.business_id = :businessId', { businessId })
        .andWhere('i.product_id IS NOT NULL')
        .andWhere('o.status NOT IN (:...excluded)', { excluded: UNBILLED_ORDER_STATUSES })
        .andWhere('o.created_at BETWEEN :start AND :end', { start, end })
        .select('i.product_id', 'productId')
        .addSelect('COALESCE(SUM(i.quantity - COALESCE(i.returned_quantity, 0)), 0)', 'qty')
        .addSelect('COALESCE(SUM(i.subtotal), 0)', 'revenue')
        .groupBy('i.product_id')
        .getRawMany(),
      this.purchaseItemsRepository
        .createQueryBuilder('pi')
        .innerJoin('purchase_orders', 'po', 'po.id = pi.purchase_order_id')
        .where('po.business_id = :businessId', { businessId })
        .andWhere("po.status IN ('received', 'paid')")
        .andWhere('po.updated_at BETWEEN :start AND :end', { start, end })
        .select('pi.product_id', 'productId')
        .addSelect('COALESCE(SUM(pi.quantity), 0)', 'qty')
        .groupBy('pi.product_id')
        .getRawMany(),
    ]);

    const soldBy = new Map<string, { qty: number; revenue: number }>(
      sold.map((r) => [r.productId, { qty: Number(r.qty), revenue: Number(r.revenue) }]),
    );
    const purchasedBy = new Map<string, number>(purchased.map((r) => [r.productId, Number(r.qty)]));

    const items = products.map((p) => {
      const stock = Number(p.stock_quantity ?? 0);
      const cost = Number(p.purchase_price ?? 0);
      const reorder = p.reorder_point == null ? null : Number(p.reorder_point);
      const s = soldBy.get(p.id);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku || null,
        category: p.category || null,
        unit: p.unit || null,
        currentStock: stock,
        costPrice: round2(cost),
        stockValue: round2(stock * cost),
        purchasedQty: purchasedBy.get(p.id) ?? 0,
        soldQty: s?.qty ?? 0,
        soldRevenue: round2(s?.revenue ?? 0),
        status: stock <= 0 ? 'out' : reorder != null && stock <= reorder ? 'low' : 'ok',
      };
    });

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      items,
      totals: {
        products: items.length,
        stockValue: round2(items.reduce((sum, i) => sum + i.stockValue, 0)),
        outOfStock: items.filter((i) => i.status === 'out').length,
        lowStock: items.filter((i) => i.status === 'low').length,
        purchasedQty: items.reduce((sum, i) => sum + i.purchasedQty, 0),
        soldQty: items.reduce((sum, i) => sum + i.soldQty, 0),
      },
    };
  }
}
