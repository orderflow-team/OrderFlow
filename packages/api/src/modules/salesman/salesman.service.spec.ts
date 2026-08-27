import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { SalesmanService } from './salesman.service';
import { Salesman } from '../../database/entities/salesman.entity';
import { Visit } from '../../database/entities/visit.entity';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';

jest.mock('bcryptjs', () => ({ hash: jest.fn() }));
jest.mock('../../common/utils/credential-crypto.util', () => ({
  encryptPassword: jest.fn((p: string) => `encrypted(${p})`),
  decryptPassword: jest.fn((p: string) => p.replace(/^encrypted\((.*)\)$/, '$1')),
}));

describe('SalesmanService', () => {
  let service: SalesmanService;
  let salesmenRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock; findOne: jest.Mock; remove: jest.Mock };
  let visitsRepo: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; find: jest.Mock; delete: jest.Mock; createQueryBuilder: jest.Mock };
  let usersRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    salesmenRepo = {
      create: jest.fn((entity) => ({ id: 'sm-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(async (entity) => entity),
    };
    visitsRepo = {
      create: jest.fn((entity) => ({ id: 'visit-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    usersRepo = {
      findOne: jest.fn(),
      create: jest.fn((entity) => ({ id: 'user-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      update: jest.fn(),
    };
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesmanService,
        { provide: getRepositoryToken(Salesman), useValue: salesmenRepo },
        { provide: getRepositoryToken(Visit), useValue: visitsRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();

    service = module.get(SalesmanService);
  });

  describe('create', () => {
    it('creates a salesman without a login when no email/password given', async () => {
      await service.create({ businessId: 'biz-1', name: 'Ravi', userId: 'existing-user' } as any);

      expect(usersRepo.create).not.toHaveBeenCalled();
      expect(salesmenRepo.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'existing-user' }));
    });

    it('creates a login user with SALESMAN role when email/password are given', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await service.create({ businessId: 'biz-1', name: 'Ravi', email: 'ravi@example.com', password: 'pass123' } as any);

      expect(usersRepo.create).toHaveBeenCalledWith(expect.objectContaining({ role: UserRole.SALESMAN }));
      expect(salesmenRepo.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-new' }));
    });

    it('throws ConflictException when the login email is already registered', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ businessId: 'biz-1', name: 'Ravi', email: 'taken@example.com', password: 'pass123' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createLogin', () => {
    it('creates a login for a salesman that has none', async () => {
      salesmenRepo.findOne.mockResolvedValue({ id: 'sm-1', business_id: 'biz-1', name: 'Ravi', user_id: null });
      usersRepo.findOne.mockResolvedValue(null);

      const result = await service.createLogin('sm-1', 'biz-1', { email: 'ravi@example.com', password: 'pass123' } as any);

      expect(result).toEqual({ id: 'user-new', email: 'ravi@example.com' });
    });

    it('throws ConflictException when the salesman already has a login', async () => {
      salesmenRepo.findOne.mockResolvedValue({ id: 'sm-1', business_id: 'biz-1', user_id: 'existing-user' });

      await expect(service.createLogin('sm-1', 'biz-1', { email: 'x@y.com', password: 'p' } as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('flattens each salesman email from its linked user', async () => {
      salesmenRepo.find.mockResolvedValue([{ id: 'sm-1', name: 'Ravi', user: { email: 'ravi@example.com' } }]);

      const result = await service.findAll('biz-1');

      expect(result[0].email).toBe('ravi@example.com');
    });

    it('sets email null when there is no linked user', async () => {
      salesmenRepo.find.mockResolvedValue([{ id: 'sm-1', name: 'Ravi', user: null }]);

      const result = await service.findAll('biz-1');

      expect(result[0].email).toBeNull();
    });
  });

  describe('getLoginCredentials', () => {
    it('decrypts and returns the plaintext password', async () => {
      salesmenRepo.findOne.mockResolvedValue({ id: 'sm-1', business_id: 'biz-1', user_id: 'user-1' });
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', email: 'ravi@example.com', password_plain: 'encrypted(pass123)' });

      const result = await service.getLoginCredentials('sm-1', 'biz-1');

      expect(result).toEqual({ email: 'ravi@example.com', password: 'pass123' });
    });

    it('throws NotFoundException when the salesman has no login', async () => {
      salesmenRepo.findOne.mockResolvedValue({ id: 'sm-1', business_id: 'biz-1', user_id: null });

      await expect(service.getLoginCredentials('sm-1', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the linked user record is missing', async () => {
      salesmenRepo.findOne.mockResolvedValue({ id: 'sm-1', business_id: 'biz-1', user_id: 'user-1' });
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.getLoginCredentials('sm-1', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLogin', () => {
    it('updates the email and password of an existing login', async () => {
      salesmenRepo.findOne.mockResolvedValue({ id: 'sm-1', business_id: 'biz-1', user_id: 'user-1' });
      usersRepo.findOne.mockResolvedValueOnce({ id: 'user-1', email: 'old@example.com' }).mockResolvedValueOnce(null);

      const result = await service.updateLogin('sm-1', 'biz-1', { email: 'new@example.com', password: 'newpass' } as any);

      expect(result.email).toBe('new@example.com');
    });

    it('throws NotFoundException when the salesman has no login', async () => {
      salesmenRepo.findOne.mockResolvedValue({ id: 'sm-1', business_id: 'biz-1', user_id: null });

      await expect(service.updateLogin('sm-1', 'biz-1', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the new email is already used by another user', async () => {
      salesmenRepo.findOne.mockResolvedValue({ id: 'sm-1', business_id: 'biz-1', user_id: 'user-1' });
      usersRepo.findOne.mockResolvedValueOnce({ id: 'user-1', email: 'old@example.com' }).mockResolvedValueOnce({ id: 'other-user' });

      await expect(service.updateLogin('sm-1', 'biz-1', { email: 'taken@example.com' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the salesman does not exist', async () => {
      salesmenRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes visits, deactivates the login, and removes the salesman', async () => {
      salesmenRepo.findOne.mockResolvedValue({ id: 'sm-1', business_id: 'biz-1', user_id: 'user-1' });

      const result = await service.remove('sm-1', 'biz-1');

      expect(visitsRepo.delete).toHaveBeenCalledWith({ salesman_id: 'sm-1' });
      expect(usersRepo.update).toHaveBeenCalledWith({ id: 'user-1' }, { is_active: false });
      expect(result).toEqual({ deleted: true });
    });

    it('skips deactivating a login when the salesman never had one', async () => {
      salesmenRepo.findOne.mockResolvedValue({ id: 'sm-1', business_id: 'biz-1', user_id: null });

      await service.remove('sm-1', 'biz-1');

      expect(usersRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('checkIn', () => {
    it('opens a new visit when none is currently open', async () => {
      salesmenRepo.findOne.mockResolvedValue({ id: 'sm-1', business_id: 'biz-1' });
      visitsRepo.findOne.mockResolvedValue(null);

      const result = await service.checkIn({ salesmanId: 'sm-1', businessId: 'biz-1', customerId: 'cust-1' } as any);

      expect(result.check_in_time).toBeInstanceOf(Date);
    });

    it('throws ConflictException when a visit is already open', async () => {
      salesmenRepo.findOne.mockResolvedValue({ id: 'sm-1', business_id: 'biz-1' });
      visitsRepo.findOne.mockResolvedValue({ id: 'visit-1', check_out_time: null });

      await expect(service.checkIn({ salesmanId: 'sm-1', businessId: 'biz-1' } as any)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when the salesman does not belong to the business', async () => {
      salesmenRepo.findOne.mockResolvedValue(null);

      await expect(service.checkIn({ salesmanId: 'missing', businessId: 'biz-1' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkOut', () => {
    it('closes an open visit', async () => {
      const qb = { innerJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue({ id: 'visit-1', check_out_time: null }) };
      visitsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.checkOut('visit-1', 'biz-1');

      expect(result.check_out_time).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when the visit does not exist for this business', async () => {
      const qb = { innerJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
      visitsRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.checkOut('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the visit is already checked out', async () => {
      const qb = { innerJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue({ id: 'visit-1', check_out_time: new Date() }) };
      visitsRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.checkOut('visit-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findVisitsBySalesman', () => {
    it('returns visits after validating the salesman belongs to the business', async () => {
      salesmenRepo.findOne.mockResolvedValue({ id: 'sm-1', business_id: 'biz-1' });
      visitsRepo.find.mockResolvedValue([{ id: 'visit-1' }]);

      const result = await service.findVisitsBySalesman('sm-1', 'biz-1');

      expect(result).toEqual([{ id: 'visit-1' }]);
    });
  });

  describe('findVisitsByCustomer', () => {
    it('scopes visits to the business via the salesman join', () => {
      const qb = { innerJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) };
      visitsRepo.createQueryBuilder.mockReturnValue(qb);

      service.findVisitsByCustomer('cust-1', 'biz-1');

      expect(qb.andWhere).toHaveBeenCalledWith('salesman.business_id = :businessId', { businessId: 'biz-1' });
    });
  });
});
