import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Notification } from '../../database/entities/notification.entity';
import { Order } from '../../database/entities/order.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Business } from '../../database/entities/business.entity';
import { Product } from '../../database/entities/product.entity';
import { ProductBatch } from '../../database/entities/product-batch.entity';
import { DeviceToken } from '../../database/entities/device-token.entity';
import { FcmService } from '../../common/services/fcm.service';

const STALE_ORDER_STATUSES = ['confirmed', 'packed', 'dispatched'];
const ORDER_REMINDER_AFTER_HOURS = 24;
const PAYMENT_REMINDER_AFTER_DAYS = 7;
const DEFAULT_REORDER_THRESHOLD = 10;
const EXPIRY_ALERT_WITHIN_DAYS = 30;
const INVENTORY_NOTIFICATION_TYPES = ['low_stock', 'expiry_alert'];

const PUSH_TITLES: Record<string, string> = {
  order_reminder: 'Order reminder',
  payment_reminder: 'Payment reminder',
  low_stock: 'Low stock alert',
  expiry_alert: 'Expiry alert',
};

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
    @InjectRepository(DeviceToken) private deviceTokensRepository: Repository<DeviceToken>,
    private fcmService: FcmService,
  ) {}

  /**
   * Registers (or refreshes) a native device's FCM token for push. Upserts on
   * the token itself — a reinstall or token-refresh sends the same call again
   * rather than a distinct "first registration", and the token can only ever
   * belong to one business/user at a time (whoever is signed in on that
   * device right now).
   */
  async registerDeviceToken(businessId: string, userId: string | null, token: string, platform: string) {
    const existing = await this.deviceTokensRepository.findOne({ where: { token } });
    if (existing) {
      existing.business_id = businessId;
      existing.user_id = userId;
      existing.platform = platform;
      await this.deviceTokensRepository.save(existing);
    } else {
      await this.deviceTokensRepository.save(
        this.deviceTokensRepository.create({ business_id: businessId, user_id: userId, token, platform }),
      );
    }
    return { success: true };
  }

  /**
   * Stops push to this device — called on logout so a signed-out device
   * doesn't keep receiving another user's alerts. Scoped to businessId (not
   * just the token) so one business can't unregister another's device by
   * guessing/replaying a token value.
   */
  async unregisterDeviceToken(businessId: string, token: string) {
    await this.deviceTokensRepository.delete({ business_id: businessId, token });
    return { success: true };
  }

  /**
   * Sends a real push immediately to every device registered for this
   * business, bypassing the notification-row/dedup machinery entirely — a
   * pure connectivity check ("did my phone actually receive this") for
   * confirming the Firebase setup end-to-end, rather than waiting on the
   * next 9am cron sweep or a real stale-order/low-stock condition to occur.
   * Throws a plain, UI-displayable message for the two ways this can't work:
   * FCM not configured server-side, or no device has registered yet.
   */
  async sendTestPush(businessId: string) {
    if (!this.fcmService.isConfigured) {
      throw new BadRequestException("Push notifications aren't configured on the server (FIREBASE_SERVICE_ACCOUNT is missing).");
    }
    const devices = await this.deviceTokensRepository.find({ where: { business_id: businessId } });
    if (devices.length === 0) {
      throw new BadRequestException('No device is registered for push yet — open the native app and log in on it first.');
    }

    const invalidTokens = await this.fcmService.sendToTokens(
      devices.map((d) => d.token),
      'Test notification',
      'Push notifications are working! 🎉',
      { type: 'test' },
    );
    if (invalidTokens.length > 0) {
      await this.deviceTokensRepository.delete({ token: In(invalidTokens) });
    }

    return { devicesNotified: devices.length - invalidTokens.length, invalidTokensRemoved: invalidTokens.length };
  }

  /**
   * A platform admin's own message — not one of the four automated types
   * (order/payment reminders, low stock, expiry), so it's never subject to
   * notification_preferences (that toggle is specifically "mute this
   * automated check", not "mute the platform"). Always saved as an in-app
   * notification row too, unlike sendTestPush — an admin reaching out is
   * worth seeing in the bell even for someone without push enabled, or who
   * had their phone off when it arrived. businessId omitted broadcasts to
   * every business in the system.
   */
  async sendCustomPush(businessId: string | null, title: string, message: string) {
    const targetBusinessIds = businessId
      ? [businessId]
      : (await this.businessesRepository.find({ select: { id: true } })).map((b) => b.id);

    if (targetBusinessIds.length === 0) {
      throw new BadRequestException('No business found to notify.');
    }

    await this.notificationsRepository.save(
      targetBusinessIds.map((id) => this.notificationsRepository.create({ business_id: id, type: 'admin_message', message })),
    );

    if (!this.fcmService.isConfigured) {
      return { businessesReached: targetBusinessIds.length, devicesNotified: 0 };
    }

    const devices = await this.deviceTokensRepository.find({ where: { business_id: In(targetBusinessIds) } });
    if (devices.length === 0) {
      return { businessesReached: targetBusinessIds.length, devicesNotified: 0 };
    }

    const invalidTokens = await this.fcmService.sendToTokens(
      devices.map((d) => d.token),
      title,
      message,
      { type: 'admin_message' },
    );
    if (invalidTokens.length > 0) {
      await this.deviceTokensRepository.delete({ token: In(invalidTokens) });
    }

    return { businessesReached: targetBusinessIds.length, devicesNotified: devices.length - invalidTokens.length };
  }

  /**
   * Saves the notification row (existing behavior) and, if FCM is
   * configured, also pushes it to every device registered for this business
   * — same business-wide reach the in-app bell already has, just delivered
   * instantly instead of waiting for the next 60s poll or app open. Silently
   * a no-op for push when FIREBASE_SERVICE_ACCOUNT isn't set; the DB row
   * (and in-app bell) are unaffected either way.
   *
   * Skips both the row and the push entirely if the business has explicitly
   * disabled this type (Settings > Notifications) — a missing/unset entry in
   * notification_preferences means "enabled" (the default before this
   * feature existed), only an explicit `false` opts out.
   */
  private async createNotification(businessId: string, type: string, message: string) {
    const business = await this.businessesRepository.findOne({ where: { id: businessId } });
    if (business?.notification_preferences?.[type] === false) return;

    await this.notificationsRepository.save(this.notificationsRepository.create({ business_id: businessId, type, message }));

    if (!this.fcmService.isConfigured) return;
    const devices = await this.deviceTokensRepository.find({ where: { business_id: businessId } });
    if (devices.length === 0) return;

    const invalidTokens = await this.fcmService.sendToTokens(
      devices.map((d) => d.token),
      PUSH_TITLES[type] || 'OrderFlow',
      message,
      { type },
    );
    if (invalidTokens.length > 0) {
      await this.deviceTokensRepository.delete({ token: In(invalidTokens) });
    }
  }

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

      await this.createNotification(order.business_id, 'order_reminder', this.orderReminderMessage(order));
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

      await this.createNotification(customer.business_id, 'payment_reminder', message);
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

      await this.createNotification(product.business_id, 'low_stock', message);
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

      await this.createNotification(batch.batch_business_id, 'expiry_alert', message);
    }

    this.logger.log(`Expiry alert sweep: ${expiringBatches.length} batch(es) checked`);
  }
}
