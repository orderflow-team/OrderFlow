import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PlatformAdminService } from './platform-admin.service';
import { Business, User, Product, Order, UserActivityLog, BusinessConnection, PlatformSetting } from '../../database/entities';
import { NotificationsService } from '../notifications/notifications.service';

jest.mock('bcryptjs', () => ({ hash: jest.fn() }));
jest.mock('../../common/utils/credential-crypto.util', () => ({ encryptPassword: jest.fn((p: string) => `encrypted(${p})`) }));

describe('PlatformAdminService', () => {
  let service: PlatformAdminService;
  let businessRepo: Record<string, jest.Mock>;
  let userRepo: Record<string, jest.Mock>;
  let productRepo: Record<string, jest.Mock>;
  let orderRepo: Record<string, jest.Mock>;
  let activityLogRepo: Record<string, jest.Mock>;
  let businessConnectionRepo: Record<string, jest.Mock>;
  let platformSettingRepo: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock; query: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let notificationsService: Record<string, jest.Mock>;

  const buildQb = (result: [any[], number] = [[], 0]) => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
    getRawOne: jest.fn().mockResolvedValue({ sum: '0' }),
  });

  beforeEach(async () => {
    businessRepo = { count: jest.fn(), findOne: jest.fn(), find: jest.fn(), save: jest.fn(async (e) => e), createQueryBuilder: jest.fn(() => buildQb()) };
    userRepo = { count: jest.fn(), find: jest.fn(), findOne: jest.fn(), save: jest.fn(async (e) => e), createQueryBuilder: jest.fn(() => buildQb()) };
    productRepo = { count: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn(() => buildQb()) };
    orderRepo = { count: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn(() => buildQb()) };
    activityLogRepo = { create: jest.fn((e) => e), save: jest.fn(async (e) => e), find: jest.fn(), createQueryBuilder: jest.fn(() => buildQb()) };
    businessConnectionRepo = { createQueryBuilder: jest.fn(() => buildQb()) };
    platformSettingRepo = { find: jest.fn().mockResolvedValue([]), create: jest.fn((e) => e ?? {}), save: jest.fn(async (e) => e) };
    dataSource = { transaction: jest.fn(async (cb) => cb({ query: jest.fn().mockResolvedValue([]) })), query: jest.fn().mockResolvedValue([]) };
    jwtService = { sign: jest.fn().mockReturnValue('signed-token') };
    notificationsService = { sendTestPush: jest.fn(), sendCustomPush: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformAdminService,
        { provide: NotificationsService, useValue: notificationsService },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(UserActivityLog), useValue: activityLogRepo },
        { provide: getRepositoryToken(BusinessConnection), useValue: businessConnectionRepo },
        { provide: getRepositoryToken(PlatformSetting), useValue: platformSettingRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(PlatformAdminService);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
  });

  describe('logActivity', () => {
    it('saves the activity log row', async () => {
      await service.logActivity('TEST_ACTION', 'user-1', 'biz-1');

      expect(activityLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ action: 'TEST_ACTION' }));
    });

    it('swallows errors rather than throwing', async () => {
      activityLogRepo.save.mockRejectedValue(new Error('db down'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(service.logActivity('TEST_ACTION')).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getOverviewStats', () => {
    it('aggregates platform-wide counts and revenue', async () => {
      businessRepo.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8);
      userRepo.count.mockResolvedValueOnce(50).mockResolvedValueOnce(45);
      productRepo.count.mockResolvedValue(200);
      orderRepo.count.mockResolvedValue(500);
      orderRepo.createQueryBuilder.mockReturnValue(buildQb());
      orderRepo.createQueryBuilder().getRawOne = jest.fn().mockResolvedValue({ sum: '10000' });
      userRepo.find.mockResolvedValue([{ id: 'u1', full_name: 'A', email: 'a@b.com', role: 'admin', business: { name: 'Biz' }, created_at: new Date() }]);
      activityLogRepo.find.mockResolvedValue([]);

      const result = await service.getOverviewStats();

      expect(result.stats.totalStores).toBe(10);
      expect(result.stats.activeStores).toBe(8);
      expect(result.recentSignups[0].business_name).toBe('Biz');
    });
  });

  describe('getAllUsers', () => {
    it('paginates and applies search/role/active filters', async () => {
      const qb = buildQb([[{ id: 'u1', full_name: 'A', email: 'a@b.com', role: 'admin', is_active: true, business_id: 'biz-1', business: { name: 'Biz' } }], 1]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getAllUsers({ search: 'a', role: 'admin', business_id: 'biz-1', is_active: 'true', page: 1, limit: 20 });

      expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), { search: '%a%' });
      expect(result.meta.total).toBe(1);
      expect(result.data[0].business_name).toBe('Biz');
    });

    it('clamps limit to 100 and page to at least 1', async () => {
      const qb = buildQb();
      userRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getAllUsers({ page: -5, limit: 500 });

      expect(qb.take).toHaveBeenCalledWith(100);
      expect(qb.skip).toHaveBeenCalledWith(0);
    });
  });

  describe('getStoresForUser', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getStoresForUser('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns owned stores plus the active workspace when it is not owned', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'user-1', full_name: 'A', email: 'a@b.com', role: 'salesman', business_id: 'biz-active' });
      businessRepo.find.mockResolvedValue([{ id: 'biz-owned', name: 'Owned', category: 'retail', owner_user_id: 'user-1', created_at: new Date() }]);
      businessRepo.findOne.mockResolvedValue({ id: 'biz-active', name: 'Active', category: 'retail', owner_user_id: 'other', created_at: new Date() });

      const result = await service.getStoresForUser('user-1');

      expect(result.stores).toHaveLength(2);
      expect(result.stores[1].is_active_workspace).toBe(true);
    });
  });

  describe('updateUser', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.updateUser('missing', {})).rejects.toThrow(NotFoundException);
    });

    it('updates fields and logs the change with old/new values', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1', full_name: 'Old', email: 'old@b.com', role: 'cashier', business_id: 'biz-1', is_active: true });

      const result = await service.updateUser('u1', { full_name: 'New' }, 'admin-1');

      expect(result.user.full_name).toBe('New');
      expect(activityLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE_USER', metadata: expect.objectContaining({ changes: { full_name: { old: 'Old', new: 'New' } } }) }),
      );
    });

    it('throws BadRequestException when the new email is already used by another user', async () => {
      userRepo.findOne.mockResolvedValueOnce({ id: 'u1', email: 'old@b.com' }).mockResolvedValueOnce({ id: 'other-user' });

      await expect(service.updateUser('u1', { email: 'taken@b.com' })).rejects.toThrow(BadRequestException);
    });

    it('re-hashes and re-encrypts a password reset', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      await service.updateUser('u1', { password: 'newpass123' });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpass123', 10);
      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ password_plain: 'encrypted(newpass123)' }));
    });
  });

  describe('toggleUserStatus', () => {
    it('delegates to updateUser with just the is_active flag', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1', is_active: true });

      const result = await service.toggleUserStatus('u1', false, 'admin-1');

      expect(result.user.is_active).toBe(false);
    });
  });

  describe('getAllStores', () => {
    it('enriches each store with owner and counts', async () => {
      const qb = buildQb([[{ id: 'biz-1', owner_user_id: 'owner-1' }], 1]);
      businessRepo.createQueryBuilder.mockReturnValue(qb);
      userRepo.findOne.mockResolvedValue({ email: 'owner@b.com', full_name: 'Owner' });
      userRepo.count.mockResolvedValue(5);
      productRepo.count.mockResolvedValue(20);
      orderRepo.count.mockResolvedValue(40);

      const result = await service.getAllStores({});

      expect(result.data[0]).toEqual(
        expect.objectContaining({ owner_email: 'owner@b.com', owner_name: 'Owner', user_count: 5, product_count: 20, order_count: 40 }),
      );
    });

    it('applies category and search filters', async () => {
      const qb = buildQb();
      businessRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getAllStores({ category: 'pharmacy', search: 'acme' });

      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateStore', () => {
    it('throws NotFoundException when the store does not exist', async () => {
      businessRepo.findOne.mockResolvedValue(null);

      await expect(service.updateStore('missing', {})).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for an invalid GSTIN', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1' });

      await expect(service.updateStore('biz-1', { gst_number: 'not-a-gstin' })).rejects.toThrow(BadRequestException);
    });

    it('applies valid updates and logs the change', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1', name: 'Old' });

      const result = await service.updateStore('biz-1', { name: 'New' }, 'admin-1');

      expect(result.name).toBe('New');
      expect(activityLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE_STORE' }));
    });
  });

  describe('sendTestPush', () => {
    it('throws NotFoundException when the store does not exist', async () => {
      businessRepo.findOne.mockResolvedValue(null);

      await expect(service.sendTestPush('missing')).rejects.toThrow(NotFoundException);
    });

    it('delegates to NotificationsService and logs the result', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1' });
      notificationsService.sendTestPush.mockResolvedValue({ devicesNotified: 2 });

      const result = await service.sendTestPush('biz-1', 'admin-1');

      expect(result).toEqual({ devicesNotified: 2 });
      expect(activityLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ action: 'TEST_PUSH' }));
    });
  });

  describe('sendCustomPush', () => {
    it('throws NotFoundException when a specific store is targeted but does not exist', async () => {
      businessRepo.findOne.mockResolvedValue(null);

      await expect(service.sendCustomPush('missing', 'Title', 'Message')).rejects.toThrow(NotFoundException);
    });

    it('broadcasts when storeId is null without checking any store', async () => {
      notificationsService.sendCustomPush.mockResolvedValue({ businessesReached: 5, devicesNotified: 3 });

      const result = await service.sendCustomPush(null, 'Title', 'Message', 'admin-1');

      expect(businessRepo.findOne).not.toHaveBeenCalled();
      expect(result.businessesReached).toBe(5);
    });
  });

  describe('deleteStore', () => {
    it('throws NotFoundException when the store does not exist', async () => {
      businessRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteStore('missing')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when deleting the platform admin own dev-shell business', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1', owner_user_id: 'owner-1', name: 'Dev Shell' });
      userRepo.findOne.mockResolvedValue({ email: 'admin@orderflow.com' });

      await expect(service.deleteStore('biz-1')).rejects.toThrow(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('runs the deletion transaction and logs the action', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1', owner_user_id: 'owner-1', name: 'Test Store' });
      userRepo.findOne.mockResolvedValue({ email: 'owner@example.com' });

      const result = await service.deleteStore('biz-1', 'admin-1');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.message).toContain('Test Store');
      expect(activityLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE_STORE' }));
    });

    it('deletes a store with no owner without looking up an owner user', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1', owner_user_id: null, name: 'Orphan Store' });

      await service.deleteStore('biz-1');

      expect(userRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getActivityLogs', () => {
    it('filters by action and search', async () => {
      const qb = buildQb();
      activityLogRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getActivityLogs({ action: 'UPDATE_USER', search: 'neel' });

      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe('getProductsOverview', () => {
    it('maps products with business names and safe numeric defaults', async () => {
      const qb = buildQb([[{ id: 'p1', name: 'Widget', sku: null, barcode: null, selling_price: null, purchase_price: null, stock_quantity: null, business_id: 'biz-1', business: null, category: 'General', created_at: new Date() }], 1]);
      productRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getProductsOverview({});

      expect(result.data[0]).toEqual(expect.objectContaining({ price: 0, cost_price: 0, current_stock: 0, business_name: 'N/A' }));
    });
  });

  describe('getGlobalOrders', () => {
    it('maps orders and includes total platform revenue', async () => {
      const qb = buildQb([[{ id: 'o1', order_number: 'ORD-1', customer_name: 'Neel', business_id: 'biz-1', business: { name: 'Biz' }, status: 'paid', origin: 'manual', total_amount: '100', tax_amount: '10', created_at: new Date() }], 1]);
      const revenueQb = buildQb();
      revenueQb.getRawOne = jest.fn().mockResolvedValue({ sum: '99999' });
      orderRepo.createQueryBuilder.mockReturnValueOnce(qb).mockReturnValueOnce(revenueQb);

      const result = await service.getGlobalOrders({});

      expect(result.data[0].business_name).toBe('Biz');
      expect(result.summary.totalOrders).toBe(1);
    });
  });

  describe('getBusinessConnections', () => {
    it('maps connection rows with counterpart business names', async () => {
      const qb = buildQb([
        [{ id: 'c1', status: 'accepted', retailer_business_id: 'r1', retailer_business: { name: 'Retailer' }, wholesaler_business_id: 'w1', wholesaler_business: { name: 'Wholesaler' }, initiated_by_business_id: 'r1', created_at: new Date(), updated_at: new Date() }],
        1,
      ]);
      businessConnectionRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getBusinessConnections({});

      expect(result.data[0].retailer_name).toBe('Retailer');
      expect(result.data[0].wholesaler_name).toBe('Wholesaler');
    });
  });

  describe('getSystemHealth', () => {
    it('pings the database and reports system telemetry', async () => {
      const result = await service.getSystemHealth();

      expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
      expect(result.status).toBe('HEALTHY');
      expect(result.database.status).toBe('CONNECTED');
    });
  });

  describe('getLiveUsers', () => {
    it('maps recently-active users', async () => {
      userRepo.find.mockResolvedValue([{ id: 'u1', full_name: 'A', email: 'a@b.com', role: 'admin', business: { name: 'Biz' }, last_active_at: new Date() }]);

      const result = await service.getLiveUsers();

      expect(result[0].business_name).toBe('Biz');
    });
  });

  describe('announcement / maintenance settings', () => {
    it('getAnnouncement creates a default settings row lazily', async () => {
      platformSettingRepo.find.mockResolvedValue([]);
      platformSettingRepo.save.mockResolvedValue({ announcement_active: false, announcement_message: null, announcement_type: 'info', updated_at: new Date() });

      const result = await service.getAnnouncement();

      expect(result.active).toBe(false);
      expect(result.message).toBe('');
    });

    it('setAnnouncement persists the new announcement', async () => {
      platformSettingRepo.find.mockResolvedValue([{ id: 'settings-1' }]);
      platformSettingRepo.save.mockImplementation(async (s) => s);

      const result = await service.setAnnouncement({ active: true, message: 'Hello', type: 'warning' });

      expect(result).toEqual({ active: true, message: 'Hello', type: 'warning', updated_at: undefined });
    });

    it('getMaintenanceStatus reads the settings row', async () => {
      platformSettingRepo.find.mockResolvedValue([{ maintenance_mode: true, maintenance_message: 'Down for maintenance' }]);

      const result = await service.getMaintenanceStatus();

      expect(result).toEqual({ active: true, message: 'Down for maintenance' });
    });

    it('setMaintenanceMode updates the mode and optionally the message', async () => {
      platformSettingRepo.find.mockResolvedValue([{ maintenance_mode: false, maintenance_message: null }]);
      platformSettingRepo.save.mockImplementation(async (s) => s);

      const result = await service.setMaintenanceMode({ active: true, message: 'Back soon' });

      expect(result).toEqual({ active: true, message: 'Back soon' });
    });
  });

  describe('impersonateStore', () => {
    it('throws NotFoundException when the store does not exist', async () => {
      businessRepo.findOne.mockResolvedValue(null);

      await expect(service.impersonateStore('missing')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when no owner/staff user can be found', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1', owner_user_id: null });
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.impersonateStore('biz-1')).rejects.toThrow(NotFoundException);
    });

    it('signs a token for the store owner with a camelCase businessId payload', async () => {
      businessRepo.findOne.mockResolvedValue({ id: 'biz-1', name: 'Test Store', owner_user_id: 'owner-1' });
      userRepo.findOne.mockResolvedValue({ id: 'owner-1', email: 'owner@example.com', full_name: 'Owner', role: 'admin' });

      const result = await service.impersonateStore('biz-1');

      expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ businessId: 'biz-1' }));
      expect(result.access_token).toBe('signed-token');
      expect(activityLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ action: 'SUPER_ADMIN_IMPERSONATE_STORE' }));
    });
  });

  describe('exportSystemSnapshot', () => {
    it('redacts credential fields from every user row', async () => {
      businessRepo.find.mockResolvedValue([]);
      userRepo.find.mockResolvedValue([{ id: 'u1', email: 'a@b.com', password_hash: 'secret', password_plain: 'secret2', password_reset_token: 'secret3' }]);
      productRepo.find.mockResolvedValue([]);
      orderRepo.find.mockResolvedValue([]);
      activityLogRepo.find.mockResolvedValue([]);

      const result = await service.exportSystemSnapshot();

      expect(result.data.users[0]).not.toHaveProperty('password_hash');
      expect(result.data.users[0]).not.toHaveProperty('password_plain');
      expect(result.data.users[0]).not.toHaveProperty('password_reset_token');
      expect(result.counts.users).toBe(1);
    });
  });
});
