import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import { BusinessesService } from './businesses.service';
import { DevToolsService } from '../dev-tools/dev-tools.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Business } from '../../database/entities/business.entity';
import { User } from '../../database/entities/user.entity';

jest.mock('fs', () => ({ unlink: jest.fn((_path: string, cb: (err: any) => void) => cb(null)) }));

describe('BusinessesService', () => {
  let service: BusinessesService;
  let businessesRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  let usersRepo: { findOne: jest.Mock; update: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const business = (overrides: Partial<Business> = {}): Business =>
    ({
      id: 'biz-1',
      owner_user_id: 'owner-1',
      name: 'My Business',
      logo_url: null,
      upi_qr_url: null,
      ...overrides,
    }) as Business;

  beforeEach(async () => {
    businessesRepo = {
      create: jest.fn((entity) => ({ id: 'new-biz-id', ...entity })),
      save: jest.fn(async (entity) => entity),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
    usersRepo = { findOne: jest.fn(), update: jest.fn() };
    dataSource = { transaction: jest.fn(async (cb) => cb({ query: jest.fn().mockResolvedValue([]) })) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessesService,
        { provide: getRepositoryToken(Business), useValue: businessesRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: DevToolsService, useValue: {} },
        { provide: SubscriptionsService, useValue: { getUserSubscriptionStatus: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(BusinessesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a business with defaults applied for optional fields', async () => {
      const result = await service.create({ name: 'Acme' } as any, 'owner-1');

      expect(businessesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Acme',
          owner_user_id: 'owner-1',
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          inventory_enabled: true,
          ai_chat_enabled: true,
          allow_orders_beyond_stock: true,
          b2b_sync_enabled: true,
        }),
      );
      expect(businessesRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('respects explicitly-provided optional fields over defaults', async () => {
      await service.create(
        { name: 'Acme', currency: 'USD', timezone: 'UTC', inventoryEnabled: false, b2bSyncEnabled: false } as any,
        'owner-1',
      );

      expect(businessesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD', timezone: 'UTC', inventory_enabled: false, b2b_sync_enabled: false }),
      );
    });
  });

  describe('onboard', () => {
    it('creates a business and sets it as the user active business', async () => {
      const result = await service.onboard('user-1', { name: 'Acme' } as any);

      expect(usersRepo.update).toHaveBeenCalledWith({ id: 'user-1' }, { business_id: expect.anything() });
      expect(result).toBeDefined();
    });
  });

  describe('findMine', () => {
    it('backfills ownership for the user active business when unset, then lists owned businesses', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', business_id: 'biz-1' });
      businessesRepo.find.mockResolvedValue([business()]);

      const result = await service.findMine('user-1');

      expect(businessesRepo.update).toHaveBeenCalledWith(
        { id: 'biz-1', owner_user_id: expect.anything() },
        { owner_user_id: 'user-1' },
      );
      expect(businessesRepo.find).toHaveBeenCalledWith({
        where: { owner_user_id: 'user-1' },
        order: { created_at: 'ASC' },
      });
      expect(result).toHaveLength(1);
    });

    it('skips the backfill update when the user has no active business_id', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', business_id: null });
      businessesRepo.find.mockResolvedValue([]);

      await service.findMine('user-1');

      expect(businessesRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('selectActive', () => {
    it('switches active business when the caller owns it', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'user-1' }));

      const result = await service.selectActive('user-1', 'biz-1');

      expect(usersRepo.update).toHaveBeenCalledWith({ id: 'user-1' }, { business_id: 'biz-1' });
      expect(result.id).toBe('biz-1');
    });

    it('throws NotFoundException when the caller does not own the business', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'someone-else' }));

      await expect(service.selectActive('user-1', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('returns the business when the caller owns it', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'user-1' }));

      const result = await service.findOne('biz-1', 'user-1', undefined);
      expect(result.id).toBe('biz-1');
    });

    it('returns the business when it is the caller active workspace (staff login)', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'owner-1' }));

      const result = await service.findOne('biz-1', 'staff-user', 'biz-1');
      expect(result.id).toBe('biz-1');
    });

    it('throws NotFoundException when the caller neither owns nor is scoped to the business', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'owner-1' }));

      await expect(service.findOne('biz-1', 'random-user', 'other-biz')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the business does not exist', async () => {
      businessesRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', 'user-1', undefined)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates provided fields while retaining existing values for omitted ones', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'user-1', name: 'Old Name', phone: '111' } as any));

      const result = await service.update('biz-1', { name: 'New Name' } as any, 'user-1');

      expect(result.name).toBe('New Name');
      expect((result as any).phone).toBe('111');
    });

    it('throws ForbiddenException when the caller is not the owner', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'owner-1' }));

      await expect(service.update('biz-1', { name: 'X' } as any, 'not-owner')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateLogo / removeLogo', () => {
    it('updates the logo and deletes the previous file when it changes', async () => {
      businessesRepo.findOne.mockResolvedValue(
        business({ owner_user_id: 'user-1', logo_url: '/uploads/logos/old.png' } as any),
      );

      const result = await service.updateLogo('biz-1', '/uploads/logos/new.png', 'user-1');

      expect(result.logo_url).toBe('/uploads/logos/new.png');
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('does not attempt file deletion when the logo url is unchanged', async () => {
      businessesRepo.findOne.mockResolvedValue(
        business({ owner_user_id: 'user-1', logo_url: '/uploads/logos/same.png' } as any),
      );

      await service.updateLogo('biz-1', '/uploads/logos/same.png', 'user-1');

      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException on updateLogo when not the owner', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'owner-1' }));

      await expect(service.updateLogo('biz-1', '/uploads/logos/x.png', 'not-owner')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('removes the logo and deletes the file', async () => {
      businessesRepo.findOne.mockResolvedValue(
        business({ owner_user_id: 'user-1', logo_url: '/uploads/logos/old.png' } as any),
      );

      const result = await service.removeLogo('biz-1', 'user-1');

      expect(result.logo_url).toBeNull();
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('throws ForbiddenException on removeLogo when not the owner', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'owner-1' }));

      await expect(service.removeLogo('biz-1', 'not-owner')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateUpiQr / removeUpiQr', () => {
    it('updates the UPI QR url and deletes the previous file when it changes', async () => {
      businessesRepo.findOne.mockResolvedValue(
        business({ owner_user_id: 'user-1', upi_qr_url: '/uploads/upi-qr/old.png' } as any),
      );

      const result = await service.updateUpiQr('biz-1', '/uploads/upi-qr/new.png', 'user-1');

      expect((result as any).upi_qr_url).toBe('/uploads/upi-qr/new.png');
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('throws ForbiddenException on updateUpiQr when not the owner', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'owner-1' }));

      await expect(service.updateUpiQr('biz-1', '/uploads/upi-qr/x.png', 'not-owner')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('removes the UPI QR and deletes the file', async () => {
      businessesRepo.findOne.mockResolvedValue(
        business({ owner_user_id: 'user-1', upi_qr_url: '/uploads/upi-qr/old.png' } as any),
      );

      const result = await service.removeUpiQr('biz-1', 'user-1');

      expect((result as any).upi_qr_url).toBeNull();
    });

    it('throws ForbiddenException on removeUpiQr when not the owner', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'owner-1' }));

      await expect(service.removeUpiQr('biz-1', 'not-owner')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteAccount', () => {
    it('runs the deletion transaction and returns a confirmation message when name matches and caller is owner', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'user-1', name: 'Acme Shop' } as any));

      const result = await service.deleteAccount('biz-1', 'user-1', 'Acme Shop');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.message).toContain('Acme Shop');
    });

    it('throws ForbiddenException when the caller is not the owner', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'owner-1', name: 'Acme Shop' } as any));

      await expect(service.deleteAccount('biz-1', 'not-owner', 'Acme Shop')).rejects.toThrow(ForbiddenException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the confirmation name does not match', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'user-1', name: 'Acme Shop' } as any));

      await expect(service.deleteAccount('biz-1', 'user-1', 'Wrong Name')).rejects.toThrow(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when no confirmation name is supplied', async () => {
      businessesRepo.findOne.mockResolvedValue(business({ owner_user_id: 'user-1', name: 'Acme Shop' } as any));

      await expect(service.deleteAccount('biz-1', 'user-1', '')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOneOrFail (via findOne)', () => {
    it('propagates NotFoundException when the business row does not exist', async () => {
      businessesRepo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', {} as any, 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
