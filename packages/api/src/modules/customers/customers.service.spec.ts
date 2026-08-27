import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { Customer } from '../../database/entities/customer.entity';

describe('CustomersService', () => {
  let service: CustomersService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
    count: jest.Mock;
    findOne: jest.Mock;
    manager: { transaction: jest.Mock };
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn((entity) => ({ id: 'cust-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      manager: { transaction: jest.fn(async (cb) => cb({ update: jest.fn(), delete: jest.fn(), remove: jest.fn() })) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomersService, { provide: getRepositoryToken(Customer), useValue: repo }],
    }).compile();

    service = module.get(CustomersService);
  });

  describe('create', () => {
    it('applies defaults for optional fields', async () => {
      const result = await service.create({ businessId: 'biz-1', name: 'Acme Client' } as any);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: 'biz-1',
          name: 'Acme Client',
          credit_limit: 0,
          payment_terms: 'due_on_receipt',
          trade_discount_percentage: 0,
        }),
      );
      expect(result).toBeDefined();
    });

    it('respects explicitly-provided optional fields', async () => {
      await service.create({
        businessId: 'biz-1',
        name: 'Acme',
        creditLimit: 5000,
        paymentTerms: 'net_30',
        tradeDiscountPercentage: 10,
      } as any);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ credit_limit: 5000, payment_terms: 'net_30', trade_discount_percentage: 10 }),
      );
    });
  });

  describe('findAll', () => {
    it('returns all customers for the business ordered by created_at desc', async () => {
      repo.find.mockResolvedValue([{ id: 'c1' }]);

      const result = await service.findAll('biz-1');

      expect(repo.find).toHaveBeenCalledWith({ where: { business_id: 'biz-1' }, order: { created_at: 'DESC' } });
      expect(result).toEqual([{ id: 'c1' }]);
    });
  });

  describe('findAllPaginated', () => {
    const buildQb = (customers: any[], total: number) => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([customers, total]),
    });

    it('applies a search filter when provided', async () => {
      const qb = buildQb([{ id: 'c1' }], 1);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllPaginated('biz-1', 'acme', 10, 0);

      expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), { search: '%acme%' });
      expect(result).toEqual({ customers: [{ id: 'c1' }], total: 1 });
    });

    it('skips the search filter when not provided', async () => {
      const qb = buildQb([], 0);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAllPaginated('biz-1');

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('aggregates outstanding totals and top debtors', async () => {
      const sumQb = { select: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getRawOne: jest.fn().mockResolvedValue({ sum: '150.5' }) };
      const duesCountQb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getCount: jest.fn().mockResolvedValue(3) };
      const topQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'c1' }]),
      };
      repo.createQueryBuilder
        .mockReturnValueOnce(sumQb)
        .mockReturnValueOnce(duesCountQb)
        .mockReturnValueOnce(topQb);
      repo.count.mockResolvedValue(20);

      const result = await service.getStats('biz-1');

      expect(result).toEqual({
        totalOutstanding: 150.5,
        totalClients: 20,
        clientsWithDues: 3,
        topOutstanding: [{ id: 'c1' }],
      });
    });
  });

  describe('findOne', () => {
    it('returns the customer scoped to the business', async () => {
      repo.findOne.mockResolvedValue({ id: 'c1', business_id: 'biz-1' });

      const result = await service.findOne('c1', 'biz-1');

      expect(result.id).toBe('c1');
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('merges provided fields over existing values', async () => {
      repo.findOne.mockResolvedValue({ id: 'c1', business_id: 'biz-1', name: 'Old', phone: '111', custom_fields: { a: 1 } });

      const result = await service.update('c1', 'biz-1', { name: 'New' } as any);

      expect(result.name).toBe('New');
      expect((result as any).phone).toBe('111');
    });

    it('allows explicitly clearing custom_fields with an empty object', async () => {
      repo.findOne.mockResolvedValue({ id: 'c1', business_id: 'biz-1', custom_fields: { a: 1 } });

      const result = await service.update('c1', 'biz-1', { customFields: {} } as any);

      expect(result.custom_fields).toEqual({});
    });

    it('throws NotFoundException when the customer does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', 'biz-1', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('runs the cleanup transaction and returns a deleted flag', async () => {
      repo.findOne.mockResolvedValue({ id: 'c1', business_id: 'biz-1' });

      const result = await service.remove('c1', 'biz-1');

      expect(repo.manager.transaction).toHaveBeenCalled();
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when the customer does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing', 'biz-1')).rejects.toThrow(NotFoundException);
      expect(repo.manager.transaction).not.toHaveBeenCalled();
    });
  });
});
