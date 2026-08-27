import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification } from '../../database/entities/notification.entity';
import { Order } from '../../database/entities/order.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Business } from '../../database/entities/business.entity';
import { Product } from '../../database/entities/product.entity';
import { ProductBatch } from '../../database/entities/product-batch.entity';
import { DeviceToken } from '../../database/entities/device-token.entity';
import { FcmService } from '../../common/services/fcm.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationsRepo: Record<string, jest.Mock>;
  let ordersRepo: Record<string, jest.Mock>;
  let customersRepo: Record<string, jest.Mock>;
  let businessesRepo: Record<string, jest.Mock>;
  let productsRepo: Record<string, jest.Mock>;
  let productBatchesRepo: Record<string, jest.Mock>;
  let deviceTokensRepo: Record<string, jest.Mock>;
  let fcmService: { isConfigured: boolean; sendToTokens: jest.Mock };

  const dedupeQb = (result: any = null) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
  });

  beforeEach(async () => {
    notificationsRepo = {
      create: jest.fn((entity) => ({ id: 'notif-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      find: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => dedupeQb(null)),
    };
    ordersRepo = { createQueryBuilder: jest.fn() };
    customersRepo = { createQueryBuilder: jest.fn() };
    businessesRepo = { findOne: jest.fn(), find: jest.fn() };
    productsRepo = { createQueryBuilder: jest.fn() };
    productBatchesRepo = { createQueryBuilder: jest.fn() };
    deviceTokensRepo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn(), create: jest.fn((e) => e), delete: jest.fn() };
    fcmService = { isConfigured: true, sendToTokens: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: notificationsRepo },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: getRepositoryToken(Customer), useValue: customersRepo },
        { provide: getRepositoryToken(Business), useValue: businessesRepo },
        { provide: getRepositoryToken(Product), useValue: productsRepo },
        { provide: getRepositoryToken(ProductBatch), useValue: productBatchesRepo },
        { provide: getRepositoryToken(DeviceToken), useValue: deviceTokensRepo },
        { provide: FcmService, useValue: fcmService },
      ],
    }).compile();

    service = module.get(NotificationsService);
    businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', notification_preferences: null, inventory_enabled: true });
    deviceTokensRepo.find.mockResolvedValue([]);
  });

  describe('registerDeviceToken', () => {
    it('updates an existing token record', async () => {
      deviceTokensRepo.findOne.mockResolvedValue({ token: 'tok-1', business_id: 'old-biz' });

      await service.registerDeviceToken('biz-1', 'user-1', 'tok-1', 'ios');

      expect(deviceTokensRepo.save).toHaveBeenCalledWith(expect.objectContaining({ business_id: 'biz-1', user_id: 'user-1', platform: 'ios' }));
    });

    it('creates a new token record when none exists', async () => {
      deviceTokensRepo.findOne.mockResolvedValue(null);

      const result = await service.registerDeviceToken('biz-1', null, 'tok-2', 'android');

      expect(deviceTokensRepo.create).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok-2' }));
      expect(result).toEqual({ success: true });
    });
  });

  describe('unregisterDeviceToken', () => {
    it('deletes the token scoped to the business', async () => {
      const result = await service.unregisterDeviceToken('biz-1', 'tok-1');

      expect(deviceTokensRepo.delete).toHaveBeenCalledWith({ business_id: 'biz-1', token: 'tok-1' });
      expect(result).toEqual({ success: true });
    });
  });

  describe('sendTestPush', () => {
    it('throws BadRequestException when FCM is not configured', async () => {
      fcmService.isConfigured = false;

      await expect(service.sendTestPush('biz-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no device is registered', async () => {
      deviceTokensRepo.find.mockResolvedValue([]);

      await expect(service.sendTestPush('biz-1')).rejects.toThrow(BadRequestException);
    });

    it('sends to every registered device and removes invalid tokens', async () => {
      deviceTokensRepo.find.mockResolvedValue([{ token: 'tok-1' }, { token: 'tok-2' }]);
      fcmService.sendToTokens.mockResolvedValue(['tok-2']);

      const result = await service.sendTestPush('biz-1');

      expect(deviceTokensRepo.delete).toHaveBeenCalledWith({ token: expect.anything() });
      expect(result).toEqual({ devicesNotified: 1, invalidTokensRemoved: 1 });
    });
  });

  describe('sendCustomPush', () => {
    it('targets a single business when businessId is given', async () => {
      deviceTokensRepo.find.mockResolvedValue([]);

      const result = await service.sendCustomPush('biz-1', 'Title', 'Message');

      expect(notificationsRepo.save).toHaveBeenCalledWith([expect.objectContaining({ business_id: 'biz-1', type: 'admin_message' })]);
      expect(result.businessesReached).toBe(1);
    });

    it('broadcasts to every business when businessId is null', async () => {
      businessesRepo.find.mockResolvedValue([{ id: 'biz-1' }, { id: 'biz-2' }]);
      deviceTokensRepo.find.mockResolvedValue([]);

      const result = await service.sendCustomPush(null, 'Title', 'Message');

      expect(result.businessesReached).toBe(2);
    });

    it('throws BadRequestException when there are no businesses to notify', async () => {
      businessesRepo.find.mockResolvedValue([]);

      await expect(service.sendCustomPush(null, 'Title', 'Message')).rejects.toThrow(BadRequestException);
    });

    it('skips push when FCM is not configured but still saves the notification row', async () => {
      fcmService.isConfigured = false;

      const result = await service.sendCustomPush('biz-1', 'Title', 'Message');

      expect(notificationsRepo.save).toHaveBeenCalled();
      expect(result.devicesNotified).toBe(0);
    });

    it('sends push to every device across the targeted businesses', async () => {
      deviceTokensRepo.find.mockResolvedValue([{ token: 'tok-1' }]);

      const result = await service.sendCustomPush('biz-1', 'Title', 'Message');

      expect(fcmService.sendToTokens).toHaveBeenCalledWith(['tok-1'], 'Title', 'Message', { type: 'admin_message' });
      expect(result.devicesNotified).toBe(1);
    });
  });

  describe('findAll', () => {
    it('returns all notifications when unreadOnly is not set', async () => {
      notificationsRepo.find.mockResolvedValue([{ id: 'n1', type: 'low_stock' }]);

      const result = await service.findAll('biz-1');

      expect(notificationsRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { business_id: 'biz-1' } }));
      expect(result).toHaveLength(1);
    });

    it('filters to unread only when requested', async () => {
      notificationsRepo.find.mockResolvedValue([]);

      await service.findAll('biz-1', true);

      expect(notificationsRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { business_id: 'biz-1', is_read: false } }));
    });

    it('filters out inventory-related notifications when inventory tracking is disabled', async () => {
      notificationsRepo.find.mockResolvedValue([
        { id: 'n1', type: 'low_stock' },
        { id: 'n2', type: 'order_reminder' },
      ]);
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', inventory_enabled: false });

      const result = await service.findAll('biz-1');

      expect(result).toEqual([{ id: 'n2', type: 'order_reminder' }]);
    });
  });

  describe('markRead', () => {
    it('marks the notification as read scoped to the business', async () => {
      const result = await service.markRead('n1', 'biz-1');

      expect(notificationsRepo.update).toHaveBeenCalledWith({ id: 'n1', business_id: 'biz-1' }, { is_read: true });
      expect(result).toEqual({ success: true });
    });
  });

  describe('checkReminders (daily cron sweep)', () => {
    it('runs all four reminder checks', async () => {
      ordersRepo.createQueryBuilder.mockReturnValue({ where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) });
      customersRepo.createQueryBuilder.mockReturnValue({ where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) });
      productsRepo.createQueryBuilder.mockReturnValue({ innerJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) });
      productBatchesRepo.createQueryBuilder.mockReturnValue({ innerJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), addSelect: jest.fn().mockReturnThis(), getRawMany: jest.fn().mockResolvedValue([]) });

      await service.checkReminders();

      expect(ordersRepo.createQueryBuilder).toHaveBeenCalled();
      expect(customersRepo.createQueryBuilder).toHaveBeenCalled();
      expect(productsRepo.createQueryBuilder).toHaveBeenCalled();
      expect(productBatchesRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('notifies for a stale order not yet notified, and skips one already notified', async () => {
      const staleOrder = { id: 'order-1', business_id: 'biz-1', order_number: 'ORD-1', customer_name: 'Neel', status: 'confirmed' };
      ordersRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([staleOrder]),
      });
      notificationsRepo.createQueryBuilder.mockReturnValue(dedupeQb(null));

      await (service as any).checkOrderReminders();

      expect(notificationsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ business_id: 'biz-1', type: 'order_reminder' }));
    });

    it('skips creating a duplicate order reminder while one is already unread', async () => {
      const staleOrder = { id: 'order-1', business_id: 'biz-1', order_number: 'ORD-1', customer_name: 'Neel', status: 'confirmed' };
      ordersRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([staleOrder]),
      });
      notificationsRepo.createQueryBuilder.mockReturnValue(dedupeQb({ id: 'existing-notif' }));

      await (service as any).checkOrderReminders();

      expect(notificationsRepo.save).not.toHaveBeenCalled();
    });

    it('respects a business explicit opt-out of a notification type', async () => {
      const staleOrder = { id: 'order-1', business_id: 'biz-1', order_number: 'ORD-1', customer_name: 'Neel', status: 'confirmed' };
      ordersRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([staleOrder]),
      });
      notificationsRepo.createQueryBuilder.mockReturnValue(dedupeQb(null));
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', notification_preferences: { order_reminder: false } });

      await (service as any).checkOrderReminders();

      expect(notificationsRepo.save).not.toHaveBeenCalled();
    });

    it('notifies for an overdue customer payment', async () => {
      const overdueCustomer = { id: 'cust-1', business_id: 'biz-1', name: 'Neel', outstanding_amount: 500 };
      customersRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([overdueCustomer]),
      });
      notificationsRepo.createQueryBuilder.mockReturnValue(dedupeQb(null));

      await (service as any).checkPaymentReminders();

      expect(notificationsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ type: 'payment_reminder' }));
    });

    it('notifies for a low-stock product', async () => {
      const lowStockProduct = { id: 'p1', business_id: 'biz-1', name: 'Widget', stock_quantity: 2, unit: 'pcs' };
      productsRepo.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([lowStockProduct]),
      });
      notificationsRepo.createQueryBuilder.mockReturnValue(dedupeQb(null));

      await (service as any).checkLowStockAlerts();

      expect(notificationsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ type: 'low_stock' }));
    });

    it('notifies for a batch nearing expiry', async () => {
      productBatchesRepo.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { batch_id: 'batch-1', batch_business_id: 'biz-1', batch_expiry_date: new Date('2026-09-01'), batch_batch_number: 'B1', product_name: 'Widget' },
        ]),
      });
      notificationsRepo.createQueryBuilder.mockReturnValue(dedupeQb(null));

      await (service as any).checkExpiryAlerts();

      expect(notificationsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ type: 'expiry_alert' }));
    });
  });
});
