import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../database/entities/notification.entity';
import { Order } from '../../database/entities/order.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Business } from '../../database/entities/business.entity';
import { Product } from '../../database/entities/product.entity';
import { ProductBatch } from '../../database/entities/product-batch.entity';

const STALE_ORDER_STATUSES = ['confirmed', 'packed', 'dispatched'];
const ORDER_REMINDER_AFTER_HOURS = 24;
const PAYMENT_REMINDER_AFTER_DAYS = 7;
const DEFAULT_REORDER_THRESHOLD = 10;
const EXPIRY_ALERT_WITHIN_DAYS = 30;
const INVENTORY_NOTIFICATION_TYPES = ['low_stock', 'expiry_alert'];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private notificationsRepository: Repository<Notification>,
    @InjectRepository(Order) private ordersRepository: Repository<Order>,
    @InjectRepository(Customer) private customersRepository: Repository<Customer>,
    @InjectRepository(Business) private businessesRepository: Repository<Business>,
    @InjectRepository(Product) private productsRepository: Repository<Product>,
    @InjectRepository(ProductBatch) private productBatchesRepository: Repository<ProductBatch>,
  ) {}

  async findAll(businessId: string, unreadOnly?: boolean) {
    const where: Record<string, any> = { business_id: businessId };
    if (unreadOnly) {
      where.is_read = false;
    }
    const notifications = await this.notificationsRepository.find({ where, order: { created_at: 'DESC' }, take: 50 });

    const business = await this.businessesRepository.findOne({ where: { id: businessId } });
    if (business?.inventory_enabled === false) {
      // Stock/expiry alerts are stale noise once a business turns inventory tracking off.
      return notifications.filter((n) => !INVENTORY_NOTIFICATION_TYPES.includes(n.type));
    }
    return notifications;
  }

  async markRead(id: string, businessId: string) {
    await this.notificationsRepository.update({ id, business_id: businessId }, { is_read: true });
    return { success: true };
  }

  /**
   * Daily sweep: orders stuck without progressing to delivery, customers with
   * outstanding balances that haven't been chased recently, and — new —
   * products at/under their reorder point or batches nearing expiry. The
   * 'low_stock'/'expiry_alert' notification types already existed (surfaced
   * by findAll's inventory-off filter below) but nothing ever actually
   * generated one outside of dev-tools' fake seed data; this is that sweep,
   * reusing the exact threshold logic reports.service.ts's dashboard already
   * uses for its own Low Stock / Expiring Soon widgets.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkReminders() {
    await this.checkOrderReminders();
    await this.checkPaymentReminders();
    await this.checkLowStockAlerts();
    await this.checkExpiryAlerts();
  }

  private async checkOrderReminders() {
    const cutoff = new Date(Date.now() - ORDER_REMINDER_AFTER_HOURS * 60 * 60 * 1000);

    const staleOrders = await this.ordersRepository
      .createQueryBuilder('order')
      .where('order.status IN (:...statuses)', { statuses: STALE_ORDER_STATUSES })
      .andWhere('order.updated_at <= :cutoff', { cutoff })
      .getMany();

    for (const order of staleOrders) {
      // Dedupe on the stable "Order <number>" prefix while unread, not the
      // full message — re-notifies once the prior reminder is read/dismissed,
      // instead of going silent forever after the first read.
      const alreadyNotified = await this.notificationsRepository
        .createQueryBuilder('n')
        .where('n.business_id = :businessId', { businessId: order.business_id })
        .andWhere('n.type = :type', { type: 'order_reminder' })
        .andWhere('n.is_read = false')
        .andWhere('n.message LIKE :prefix', { prefix: `Order ${order.order_number} %` })
        .getOne();
      if (alreadyNotified) continue;

      await this.notificationsRepository.save(
        this.notificationsRepository.create({
          business_id: order.business_id,
          type: 'order_reminder',
          message: this.orderReminderMessage(order),
        }),
      );
    }

    this.logger.log(`Order reminder sweep: ${staleOrders.length} stale order(s) checked`);
  }

  private orderReminderMessage(order: Order) {
    return `Order ${order.order_number} (${order.customer_name}) has been "${order.status}" for over ${ORDER_REMINDER_AFTER_HOURS}h`;
  }

  private async checkPaymentReminders() {
    const cutoff = new Date(Date.now() - PAYMENT_REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000);

    const overdueCustomers = await this.customersRepository
      .createQueryBuilder('customer')
      .where('customer.outstanding_amount > 0')
      .andWhere('customer.updated_at <= :cutoff', { cutoff })
      .getMany();

    for (const customer of overdueCustomers) {
      const message = `${customer.name} has an outstanding balance of ₹${Number(customer.outstanding_amount).toFixed(2)}`;
      // Dedupe on the customer name prefix while unread, ignoring the amount
      // suffix — a balance drifting by a few rupees shouldn't spam a fresh
      // notification every cron run, but a read/dismissed one re-fires.
      const alreadyNotified = await this.notificationsRepository
        .createQueryBuilder('n')
        .where('n.business_id = :businessId', { businessId: customer.business_id })
        .andWhere('n.type = :type', { type: 'payment_reminder' })
        .andWhere('n.is_read = false')
        .andWhere('n.message LIKE :prefix', { prefix: `${customer.name} has an outstanding balance of %` })
        .getOne();
      if (alreadyNotified) continue;

      await this.notificationsRepository.save(
        this.notificationsRepository.create({
          business_id: customer.business_id,
          type: 'payment_reminder',
          message,
        }),
      );
    }

    this.logger.log(`Payment reminder sweep: ${overdueCustomers.length} overdue customer(s) checked`);
  }

  private async checkLowStockAlerts() {
    const lowStockProducts = await this.productsRepository
      .createQueryBuilder('product')
      .innerJoin('product.business', 'business')
      .where('business.inventory_enabled != false')
      .andWhere('product.is_draft = false')
      .andWhere('product.is_archived = false')
      .andWhere('product.name != :placeholder', { placeholder: 'Table Session Started' })
      .andWhere('product.stock_quantity <= COALESCE(product.reorder_point, :threshold)', {
        threshold: DEFAULT_REORDER_THRESHOLD,
      })
      .getMany();

    for (const product of lowStockProducts) {
      const prefix = `${product.name} is low on stock`;
      const message = `${prefix} (${product.stock_quantity} ${product.unit || 'units'} left)`;

      const alreadyNotified = await this.notificationsRepository
        .createQueryBuilder('n')
        .where('n.business_id = :businessId', { businessId: product.business_id })
        .andWhere('n.type = :type', { type: 'low_stock' })
        .andWhere('n.is_read = false')
        .andWhere('n.message LIKE :prefix', { prefix: `${prefix} %` })
        .getOne();
      if (alreadyNotified) continue;

      await this.notificationsRepository.save(
        this.notificationsRepository.create({
          business_id: product.business_id,
          type: 'low_stock',
          message,
        }),
      );
    }

    this.logger.log(`Low stock sweep: ${lowStockProducts.length} product(s) checked`);
  }

  private async checkExpiryAlerts() {
    const soon = new Date(Date.now() + EXPIRY_ALERT_WITHIN_DAYS * 24 * 60 * 60 * 1000);

    const expiringBatches = await this.productBatchesRepository
      .createQueryBuilder('batch')
      .innerJoin('batch.product', 'product')
      .innerJoin('batch.business', 'business')
      .where('business.inventory_enabled != false')
      .andWhere("business.category != 'restaurant'")
      .andWhere('batch.quantity > 0')
      .andWhere('batch.expiry_date IS NOT NULL')
      .andWhere('batch.expiry_date >= :today', { today: new Date() })
      .andWhere('batch.expiry_date <= :soon', { soon })
      .select(['batch.id', 'batch.business_id', 'batch.expiry_date', 'batch.batch_number'])
      .addSelect('product.name', 'product_name')
      .getRawMany();

    for (const batch of expiringBatches) {
      const productName = batch.product_name;
      const expiryDate = new Date(batch.batch_expiry_date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const prefix = `${productName} has a batch expiring`;
      const message = `${prefix} on ${expiryDate}${batch.batch_batch_number ? ` (batch ${batch.batch_batch_number})` : ''}`;

      const alreadyNotified = await this.notificationsRepository
        .createQueryBuilder('n')
        .where('n.business_id = :businessId', { businessId: batch.batch_business_id })
        .andWhere('n.type = :type', { type: 'expiry_alert' })
        .andWhere('n.is_read = false')
        .andWhere('n.message LIKE :prefix', { prefix: `${prefix} %` })
        .getOne();
      if (alreadyNotified) continue;

      await this.notificationsRepository.save(
        this.notificationsRepository.create({
          business_id: batch.batch_business_id,
          type: 'expiry_alert',
          message,
        }),
      );
    }

    this.logger.log(`Expiry alert sweep: ${expiringBatches.length} batch(es) checked`);
  }
}
