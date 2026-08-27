import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BusinessConnectionsService } from './business-connections.service';
import { BusinessConnection } from '../../database/entities/business-connection.entity';
import { Business } from '../../database/entities/business.entity';
import { Notification } from '../../database/entities/notification.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Order } from '../../database/entities/order.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { OrdersService } from '../orders/orders.service';
import { InventoryService } from '../inventory/inventory.service';

describe('BusinessConnectionsService', () => {
  let service: BusinessConnectionsService;
  let connectionsRepo: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let businessesRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let notificationsRepo: { create: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let ordersService: { mirrorExistingOrderToRetailer: jest.Mock };
  let inventoryService: { mirrorExistingPurchaseOrderToWholesaler: jest.Mock };

  const buildManager = (entityData: Record<string, any> = {}, qbResultByEntity: Record<string, any> = {}) => {
    const manager: any = {
      findOne: jest.fn((Entity: any) => Promise.resolve(entityData[Entity.name] ?? null)),
      find: jest.fn((Entity: any) => Promise.resolve(entityData[`${Entity.name}List`] ?? [])),
      create: jest.fn((Entity: any, data: any) => ({ id: `${Entity.name}-new-id`, ...data })),
      save: jest.fn(async (a: any, b?: any) => (b !== undefined ? b : a)),
      update: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn((Entity: any) => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(qbResultByEntity[Entity?.name] ?? null),
      })),
    };
    return manager;
  };

  beforeEach(async () => {
    connectionsRepo = { findOne: jest.fn(), find: jest.fn(), create: jest.fn((e) => ({ id: 'conn-new', ...e })), save: jest.fn(async (e) => e) };
    businessesRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      })),
    };
    notificationsRepo = { create: jest.fn((e) => e), save: jest.fn(async (e) => e) };
    dataSource = { transaction: jest.fn() };
    ordersService = { mirrorExistingOrderToRetailer: jest.fn() };
    inventoryService = { mirrorExistingPurchaseOrderToWholesaler: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessConnectionsService,
        { provide: getRepositoryToken(BusinessConnection), useValue: connectionsRepo },
        { provide: getRepositoryToken(Business), useValue: businessesRepo },
        { provide: getRepositoryToken(Notification), useValue: notificationsRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: OrdersService, useValue: ordersService },
        { provide: InventoryService, useValue: inventoryService },
      ],
    }).compile();

    service = module.get(BusinessConnectionsService);
  });

  describe('checkPhone', () => {
    it('returns no match when no business has that phone number', async () => {
      const result = await service.checkPhone('biz-1', '9876543210');

      expect(result).toEqual({ match: null, connectionStatus: 'none' });
    });

    it('returns no match when the target business has disabled b2b sync', async () => {
      businessesRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'target-1', name: 'Target Co', b2b_sync_enabled: false }),
      });

      const result = await service.checkPhone('biz-1', '9876543210');

      expect(result.match).toBeNull();
    });

    it('returns the match and existing connection status', async () => {
      businessesRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'target-1', name: 'Target Co', b2b_sync_enabled: true }),
      });
      connectionsRepo.findOne.mockResolvedValue({ status: 'pending' });

      const result = await service.checkPhone('biz-1', '9876543210');

      expect(result).toEqual({ match: { businessId: 'target-1', name: 'Target Co' }, connectionStatus: 'pending' });
    });

    it('defaults connectionStatus to "none" when no connection row exists yet', async () => {
      businessesRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'target-1', name: 'Target Co', b2b_sync_enabled: true }),
      });
      connectionsRepo.findOne.mockResolvedValue(null);

      const result = await service.checkPhone('biz-1', '9876543210');

      expect(result.connectionStatus).toBe('none');
    });
  });

  describe('request', () => {
    const targetQb = (target: any) => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(target),
    });

    it('throws NotFoundException when the requesting business does not exist', async () => {
      businessesRepo.findOne.mockResolvedValue(null);

      await expect(service.request({ businessId: 'missing', targetPhone: '123', role: 'retailer' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when no business matches the target phone', async () => {
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', name: 'My Biz' });
      businessesRepo.createQueryBuilder.mockReturnValue(targetQb(null));

      await expect(service.request({ businessId: 'biz-1', targetPhone: '123', role: 'retailer' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the target has disabled b2b sync', async () => {
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', name: 'My Biz' });
      businessesRepo.createQueryBuilder.mockReturnValue(targetQb({ id: 'target-1', name: 'Target', b2b_sync_enabled: false }));

      await expect(service.request({ businessId: 'biz-1', targetPhone: '123', role: 'retailer' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates a new pending connection and notifies the target', async () => {
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', name: 'My Biz' });
      businessesRepo.createQueryBuilder.mockReturnValue(targetQb({ id: 'target-1', name: 'Target', b2b_sync_enabled: true }));
      connectionsRepo.findOne.mockResolvedValue(null);

      const result = await service.request({ businessId: 'biz-1', targetPhone: '123', role: 'retailer' } as any);

      expect(connectionsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ retailer_business_id: 'biz-1', wholesaler_business_id: 'target-1', status: 'pending' }),
      );
      expect(notificationsRepo.save).toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });

    it('throws BadRequestException when already connected', async () => {
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', name: 'My Biz' });
      businessesRepo.createQueryBuilder.mockReturnValue(targetQb({ id: 'target-1', name: 'Target', b2b_sync_enabled: true }));
      connectionsRepo.findOne.mockResolvedValue({ status: 'accepted' });

      await expect(service.request({ businessId: 'biz-1', targetPhone: '123', role: 'retailer' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when a request is already pending', async () => {
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', name: 'My Biz' });
      businessesRepo.createQueryBuilder.mockReturnValue(targetQb({ id: 'target-1', name: 'Target', b2b_sync_enabled: true }));
      connectionsRepo.findOne.mockResolvedValue({ status: 'pending' });

      await expect(service.request({ businessId: 'biz-1', targetPhone: '123', role: 'retailer' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows re-requesting a previously-rejected connection', async () => {
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', name: 'My Biz' });
      businessesRepo.createQueryBuilder.mockReturnValue(targetQb({ id: 'target-1', name: 'Target', b2b_sync_enabled: true }));
      connectionsRepo.findOne.mockResolvedValue({ id: 'conn-1', status: 'rejected', retailer_business_id: 'biz-1', wholesaler_business_id: 'target-1' });

      const result = await service.request({ businessId: 'biz-1', targetPhone: '123', role: 'retailer' } as any);

      expect(result.status).toBe('pending');
    });
  });

  describe('listForBusiness', () => {
    it('splits connections into accepted/incoming/outgoing', async () => {
      connectionsRepo.find.mockResolvedValue([
        { id: 'c1', status: 'accepted', retailer_business_id: 'biz-1', wholesaler_business_id: 'w1', initiated_by_business_id: 'biz-1', wholesaler_business: { id: 'w1', name: 'W1', phone: '1' }, retailer_business: { id: 'biz-1' }, created_at: new Date() },
        { id: 'c2', status: 'pending', retailer_business_id: 'r2', wholesaler_business_id: 'biz-1', initiated_by_business_id: 'r2', wholesaler_business: { id: 'biz-1' }, retailer_business: { id: 'r2', name: 'R2', phone: '2' }, created_at: new Date() },
        { id: 'c3', status: 'pending', retailer_business_id: 'biz-1', wholesaler_business_id: 'w3', initiated_by_business_id: 'biz-1', wholesaler_business: { id: 'w3', name: 'W3', phone: '3' }, retailer_business: { id: 'biz-1' }, created_at: new Date() },
      ]);

      const result = await service.listForBusiness('biz-1');

      expect(result.connections).toHaveLength(1);
      expect(result.incomingRequests).toHaveLength(1);
      expect(result.outgoingRequests).toHaveLength(1);
      expect(result.incomingRequests[0].counterpartName).toBe('R2');
    });
  });

  describe('accept', () => {
    it('throws NotFoundException when the connection does not exist', async () => {
      const manager = buildManager({ BusinessConnection: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.accept('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller initiated the request themselves', async () => {
      const manager = buildManager({
        BusinessConnection: { id: 'conn-1', retailer_business_id: 'biz-1', wholesaler_business_id: 'w1', initiated_by_business_id: 'biz-1', status: 'pending' },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.accept('conn-1', 'biz-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when the connection is not pending', async () => {
      const manager = buildManager({
        BusinessConnection: { id: 'conn-1', retailer_business_id: 'biz-1', wholesaler_business_id: 'w1', initiated_by_business_id: 'w1', status: 'accepted' },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.accept('conn-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });

    it('accepts, creates linked supplier/customer contacts, and backfills unmirrored orders', async () => {
      const manager = buildManager({
        BusinessConnection: { id: 'conn-1', retailer_business_id: 'biz-1', wholesaler_business_id: 'w1', initiated_by_business_id: 'w1', status: 'pending' },
        Business: { id: 'w1', name: 'Wholesaler Co', phone: '999' },
        Supplier: null,
        Customer: null,
        OrderList: [{ id: 'order-1' }],
        PurchaseOrderList: [],
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.accept('conn-1', 'biz-1');

      expect(manager.create).toHaveBeenCalledWith(Supplier, expect.objectContaining({ linked_business_id: 'w1' }));
      expect(manager.create).toHaveBeenCalledWith(Customer, expect.objectContaining({ linked_business_id: 'biz-1' }));
      expect(ordersService.mirrorExistingOrderToRetailer).toHaveBeenCalled();
      expect(result.status).toBe('accepted');
    });

    it('reuses an existing linkable contact by phone instead of creating a duplicate', async () => {
      const manager = buildManager(
        {
          BusinessConnection: { id: 'conn-1', retailer_business_id: 'biz-1', wholesaler_business_id: 'w1', initiated_by_business_id: 'w1', status: 'pending' },
          Business: { id: 'w1', name: 'Wholesaler Co', phone: '999' },
          Supplier: null,
          Customer: null,
          OrderList: [],
          PurchaseOrderList: [],
        },
        { Supplier: { id: 'existing-supplier-1' }, Customer: { id: 'existing-customer-1' } },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.accept('conn-1', 'biz-1');

      expect(manager.save).toHaveBeenCalledWith(Supplier, expect.objectContaining({ id: 'existing-supplier-1', linked_business_id: 'w1' }));
      expect(manager.save).toHaveBeenCalledWith(Customer, expect.objectContaining({ id: 'existing-customer-1', linked_business_id: 'biz-1' }));
    });
  });

  describe('resync', () => {
    it('throws NotFoundException when the connection does not exist', async () => {
      const manager = buildManager({ BusinessConnection: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.resync('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not part of the connection', async () => {
      const manager = buildManager({
        BusinessConnection: { id: 'conn-1', retailer_business_id: 'r1', wholesaler_business_id: 'w1', status: 'accepted' },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.resync('conn-1', 'outsider')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when the connection is not yet accepted', async () => {
      const manager = buildManager({
        BusinessConnection: { id: 'conn-1', retailer_business_id: 'biz-1', wholesaler_business_id: 'w1', status: 'pending' },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.resync('conn-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when a linked contact is missing', async () => {
      const manager = buildManager({
        BusinessConnection: { id: 'conn-1', retailer_business_id: 'biz-1', wholesaler_business_id: 'w1', status: 'accepted' },
        Supplier: null,
        Customer: { id: 'cust-1' },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.resync('conn-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });

    it('re-runs the backfill for an accepted connection with both contacts present', async () => {
      const manager = buildManager({
        BusinessConnection: { id: 'conn-1', retailer_business_id: 'biz-1', wholesaler_business_id: 'w1', status: 'accepted' },
        Supplier: { id: 'sup-1' },
        Customer: { id: 'cust-1' },
        OrderList: [],
        PurchaseOrderList: [],
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.resync('conn-1', 'biz-1');

      expect(result).toEqual({ synced: true });
    });
  });

  describe('reject', () => {
    it('marks a pending connection as rejected', async () => {
      connectionsRepo.findOne.mockResolvedValue({ id: 'conn-1', retailer_business_id: 'r1', wholesaler_business_id: 'biz-1', initiated_by_business_id: 'r1', status: 'pending' });

      const result = await service.reject('conn-1', 'biz-1');

      expect(result.status).toBe('rejected');
    });

    it('throws ForbiddenException when the caller initiated the request', async () => {
      connectionsRepo.findOne.mockResolvedValue({ id: 'conn-1', retailer_business_id: 'biz-1', wholesaler_business_id: 'w1', initiated_by_business_id: 'biz-1', status: 'pending' });

      await expect(service.reject('conn-1', 'biz-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when the connection does not exist', async () => {
      connectionsRepo.findOne.mockResolvedValue(null);

      await expect(service.reject('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the connection is not pending', async () => {
      connectionsRepo.findOne.mockResolvedValue({ id: 'conn-1', retailer_business_id: 'r1', wholesaler_business_id: 'biz-1', initiated_by_business_id: 'r1', status: 'accepted' });

      await expect(service.reject('conn-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('unlinks the supplier/customer contacts and deletes the connection', async () => {
      const manager = buildManager({
        BusinessConnection: { id: 'conn-1', retailer_business_id: 'biz-1', wholesaler_business_id: 'w1' },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.remove('conn-1', 'biz-1');

      expect(manager.update).toHaveBeenCalledWith(Supplier, expect.objectContaining({ business_id: 'biz-1' }), { linked_business_id: null });
      expect(manager.update).toHaveBeenCalledWith(Customer, expect.objectContaining({ business_id: 'w1' }), { linked_business_id: null });
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when the connection does not exist', async () => {
      const manager = buildManager({ BusinessConnection: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.remove('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not part of the connection', async () => {
      const manager = buildManager({
        BusinessConnection: { id: 'conn-1', retailer_business_id: 'r1', wholesaler_business_id: 'w1' },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.remove('conn-1', 'outsider')).rejects.toThrow(ForbiddenException);
    });
  });
});
