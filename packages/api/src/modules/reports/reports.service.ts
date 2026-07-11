import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Product } from '../../database/entities/product.entity';
import { Customer } from '../../database/entities/customer.entity';

const ACTIVE_ORDER_STATUSES = ['draft', 'confirmed', 'packed', 'dispatched'];

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order) private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    @InjectRepository(Customer) private customersRepository: Repository<Customer>,
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
        .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: ['cancelled', 'returned'] })
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
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: ['cancelled', 'returned'] });

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
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: ['cancelled', 'returned'] });

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
      .andWhere('order.status NOT IN (:...excludedStatuses)', { excludedStatuses: ['cancelled', 'returned'] });

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

  private daysFromNow(days: number) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }
}
