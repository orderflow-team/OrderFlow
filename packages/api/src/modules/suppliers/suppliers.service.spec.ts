import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { Supplier } from '../../database/entities/supplier.entity';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let repo: { create: jest.Mock; save: jest.Mock; find: jest.Mock; findOne: jest.Mock; remove: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((entity) => ({ id: 'sup-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(async (entity) => entity),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SuppliersService, { provide: getRepositoryToken(Supplier), useValue: repo }],
    }).compile();

    service = module.get(SuppliersService);
  });

  describe('create', () => {
    it('applies defaults for optional fields', async () => {
      const result = await service.create({ businessId: 'biz-1', name: 'Acme Supply' } as any);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ payment_terms: 'due_on_receipt', credit_limit: 0, trade_discount_percentage: 0, is_active: true }),
      );
      expect(result).toBeDefined();
    });

    it('respects explicitly-provided optional fields', async () => {
      await service.create({ businessId: 'biz-1', name: 'Acme', creditLimit: 5000, isActive: false } as any);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ credit_limit: 5000, is_active: false }));
    });
  });

  describe('findAll', () => {
    it('returns suppliers for the business ordered by created_at desc', async () => {
      repo.find.mockResolvedValue([{ id: 's1' }]);

      const result = await service.findAll('biz-1');

      expect(repo.find).toHaveBeenCalledWith({ where: { business_id: 'biz-1' }, order: { created_at: 'DESC' } });
      expect(result).toEqual([{ id: 's1' }]);
    });
  });

  describe('findOne', () => {
    it('returns the supplier scoped to the business', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', business_id: 'biz-1' });

      expect((await service.findOne('s1', 'biz-1')).id).toBe('s1');
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('merges provided fields over existing values', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', business_id: 'biz-1', name: 'Old', phone: '111' });

      const result = await service.update('s1', 'biz-1', { name: 'New' } as any);

      expect(result.name).toBe('New');
      expect((result as any).phone).toBe('111');
    });

    it('throws NotFoundException when the supplier does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', 'biz-1', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the supplier and returns a deleted flag', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', business_id: 'biz-1' });

      const result = await service.remove('s1', 'biz-1');

      expect(repo.remove).toHaveBeenCalled();
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when the supplier does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });
});
