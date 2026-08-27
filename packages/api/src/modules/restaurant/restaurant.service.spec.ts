import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { RestaurantService } from './restaurant.service';
import { Table } from '../../database/entities/table.entity';
import { KOT } from '../../database/entities/kot.entity';
import { Order } from '../../database/entities/order.entity';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';

jest.mock('bcryptjs', () => ({ hash: jest.fn() }));
jest.mock('../../common/utils/credential-crypto.util', () => ({
  encryptPassword: jest.fn((p: string) => `encrypted(${p})`),
  decryptPassword: jest.fn((p: string) => p.replace(/^encrypted\((.*)\)$/, '$1')),
}));

describe('RestaurantService', () => {
  let service: RestaurantService;
  let tablesRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock; findOne: jest.Mock; update: jest.Mock; remove: jest.Mock };
  let kotRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock; findOne: jest.Mock; update: jest.Mock; manager: { getRepository: jest.Mock } };
  let usersRepo: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let orderRepoViaManager: { update: jest.Mock };

  beforeEach(async () => {
    tablesRepo = {
      create: jest.fn((entity) => ({ id: 'table-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(async (entity) => entity),
    };
    orderRepoViaManager = { update: jest.fn() };
    kotRepo = {
      create: jest.fn((entity) => ({ id: 'kot-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      manager: { getRepository: jest.fn(() => orderRepoViaManager) },
    };
    usersRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((entity) => ({ id: 'user-new', ...entity })),
      save: jest.fn(async (entity) => entity),
    };
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantService,
        { provide: getRepositoryToken(Table), useValue: tablesRepo },
        { provide: getRepositoryToken(KOT), useValue: kotRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();

    service = module.get(RestaurantService);
  });

  describe('createKitchenStaffLogin', () => {
    it('creates a KITCHEN_STAFF login', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      const result = await service.createKitchenStaffLogin('biz-1', { email: 'cook@example.com', password: 'pass123', name: 'Cook' } as any);

      expect(usersRepo.create).toHaveBeenCalledWith(expect.objectContaining({ role: UserRole.KITCHEN_STAFF }));
      expect(result).toEqual({ id: 'user-new', email: 'cook@example.com', fullName: 'Cook' });
    });

    it('throws ConflictException when the email is already registered', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createKitchenStaffLogin('biz-1', { email: 'taken@example.com', password: 'p', name: 'Cook' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listKitchenStaff', () => {
    it('maps kitchen staff users to the public shape', async () => {
      usersRepo.find.mockResolvedValue([{ id: 'u1', email: 'cook@example.com', full_name: 'Cook', is_active: true }]);

      const result = await service.listKitchenStaff('biz-1');

      expect(result).toEqual([{ id: 'u1', email: 'cook@example.com', fullName: 'Cook', isActive: true }]);
    });
  });

  describe('getKitchenStaffCredentials', () => {
    it('decrypts and returns the plaintext password', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', email: 'cook@example.com', password_plain: 'encrypted(pass123)' });

      const result = await service.getKitchenStaffCredentials('u1', 'biz-1');

      expect(result).toEqual({ email: 'cook@example.com', password: 'pass123' });
    });

    it('throws NotFoundException when the login does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.getKitchenStaffCredentials('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateKitchenStaffLogin', () => {
    it('updates email/name/password', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ id: 'u1', business_id: 'biz-1', email: 'old@example.com', full_name: 'Old' }).mockResolvedValueOnce(null);

      const result = await service.updateKitchenStaffLogin('u1', 'biz-1', { email: 'new@example.com', name: 'New Name', password: 'newpass' } as any);

      expect(result.email).toBe('new@example.com');
      expect(result.fullName).toBe('New Name');
    });

    it('throws ConflictException when the new email belongs to another user', async () => {
      usersRepo.findOne.mockResolvedValueOnce({ id: 'u1', business_id: 'biz-1', email: 'old@example.com' }).mockResolvedValueOnce({ id: 'other' });

      await expect(service.updateKitchenStaffLogin('u1', 'biz-1', { email: 'taken@example.com' } as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when the login does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.updateKitchenStaffLogin('missing', 'biz-1', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createTable', () => {
    it('applies a default capacity of 4', () => {
      service.createTable({ businessId: 'biz-1', name: 'Table 1' } as any);

      expect(tablesRepo.create).toHaveBeenCalledWith(expect.objectContaining({ capacity: 4 }));
    });

    it('respects an explicit capacity', () => {
      service.createTable({ businessId: 'biz-1', name: 'Table 1', capacity: 8 } as any);

      expect(tablesRepo.create).toHaveBeenCalledWith(expect.objectContaining({ capacity: 8 }));
    });
  });

  describe('findAllTables', () => {
    it('filters by status when provided', () => {
      service.findAllTables('biz-1', 'occupied');

      expect(tablesRepo.find).toHaveBeenCalledWith({ where: { business_id: 'biz-1', status: 'occupied' }, order: { name: 'ASC' } });
    });
  });

  describe('updateTableStatus', () => {
    it('updates the table status', async () => {
      tablesRepo.findOne.mockResolvedValue({ id: 'table-1', business_id: 'biz-1', status: 'available' });

      const result = await service.updateTableStatus('table-1', 'biz-1', { status: 'occupied' } as any);

      expect(result.status).toBe('occupied');
    });

    it('throws NotFoundException when the table does not exist', async () => {
      tablesRepo.findOne.mockResolvedValue(null);

      await expect(service.updateTableStatus('missing', 'biz-1', { status: 'occupied' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteTable', () => {
    it('nulls out KOT/order references before removing the table', async () => {
      tablesRepo.findOne.mockResolvedValue({ id: 'table-1', business_id: 'biz-1' });

      const result = await service.deleteTable('table-1', 'biz-1');

      expect(kotRepo.update).toHaveBeenCalledWith({ table_id: 'table-1' }, { table_id: null });
      expect(orderRepoViaManager.update).toHaveBeenCalledWith({ table_id: 'table-1' }, { table_id: null });
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when the table does not exist', async () => {
      tablesRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteTable('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createKot', () => {
    it('occupies the table when one is specified', async () => {
      await service.createKot({ businessId: 'biz-1', orderId: 'order-1', tableId: 'table-1' } as any);

      expect(tablesRepo.update).toHaveBeenCalledWith({ id: 'table-1', business_id: 'biz-1' }, { status: 'occupied' });
    });

    it('does not touch any table when none is specified', async () => {
      await service.createKot({ businessId: 'biz-1', orderId: 'order-1' } as any);

      expect(tablesRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('findAllKots', () => {
    it('filters by status when provided', () => {
      service.findAllKots('biz-1', 'pending');

      expect(kotRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { business_id: 'biz-1', status: 'pending' } }));
    });
  });

  describe('updateKotStatus', () => {
    it('allows a valid forward transition', async () => {
      kotRepo.findOne.mockResolvedValue({ id: 'kot-1', business_id: 'biz-1', status: 'pending' });

      const result = await service.updateKotStatus('kot-1', 'biz-1', { status: 'preparing' } as any);

      expect(result.status).toBe('preparing');
    });

    it('rejects skipping ahead in the workflow', async () => {
      kotRepo.findOne.mockResolvedValue({ id: 'kot-1', business_id: 'biz-1', status: 'pending' });

      await expect(service.updateKotStatus('kot-1', 'biz-1', { status: 'served' } as any)).rejects.toThrow(BadRequestException);
    });

    it('rejects reverting to a prior status', async () => {
      kotRepo.findOne.mockResolvedValue({ id: 'kot-1', business_id: 'biz-1', status: 'preparing' });

      await expect(service.updateKotStatus('kot-1', 'biz-1', { status: 'pending' } as any)).rejects.toThrow(BadRequestException);
    });

    it('rejects any transition once a KOT is served (terminal state)', async () => {
      kotRepo.findOne.mockResolvedValue({ id: 'kot-1', business_id: 'biz-1', status: 'served' });

      await expect(service.updateKotStatus('kot-1', 'biz-1', { status: 'preparing' } as any)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the KOT does not exist', async () => {
      kotRepo.findOne.mockResolvedValue(null);

      await expect(service.updateKotStatus('missing', 'biz-1', { status: 'preparing' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('releaseTable', () => {
    it('sets the table status to available', async () => {
      tablesRepo.findOne.mockResolvedValue({ id: 'table-1', business_id: 'biz-1', status: 'occupied' });

      const result = await service.releaseTable('table-1', 'biz-1');

      expect(result.status).toBe('available');
    });

    it('throws NotFoundException when the table does not exist', async () => {
      tablesRepo.findOne.mockResolvedValue(null);

      await expect(service.releaseTable('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });
});
