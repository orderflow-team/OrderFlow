import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from '../../database/entities/category.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repo: {
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    manager: { createQueryBuilder: jest.Mock };
  };

  const buildQb = (result: any) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result),
    getMany: jest.fn().mockResolvedValue(result),
  });

  beforeEach(async () => {
    const updateQb: any = {};
    updateQb.update = jest.fn().mockReturnValue(updateQb);
    updateQb.set = jest.fn().mockReturnValue(updateQb);
    updateQb.where = jest.fn().mockReturnValue(updateQb);
    updateQb.execute = jest.fn().mockResolvedValue({});
    repo = {
      createQueryBuilder: jest.fn(),
      create: jest.fn((entity) => ({ id: 'cat-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      findOne: jest.fn(),
      remove: jest.fn(async (entity) => entity),
      manager: { createQueryBuilder: jest.fn(() => updateQb) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: getRepositoryToken(Category), useValue: repo }],
    }).compile();

    service = module.get(CategoriesService);
  });

  describe('create', () => {
    it('returns an existing category when one matches case-insensitively', async () => {
      const existing = { id: 'cat-1', name: 'Snacks' };
      repo.createQueryBuilder.mockReturnValue(buildQb(existing));

      const result = await service.create({ businessId: 'biz-1', name: 'snacks' } as any);

      expect(result).toBe(existing);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('trims the name and creates a new category when none exists', async () => {
      repo.createQueryBuilder.mockReturnValue(buildQb(null));

      const result = await service.create({ businessId: 'biz-1', name: '  Beverages  ' } as any);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ business_id: 'biz-1', name: 'Beverages' }));
      expect(result).toEqual(expect.objectContaining({ name: 'Beverages' }));
    });

    it('re-fetches and returns the winner on a unique-constraint race (23505)', async () => {
      const winner = { id: 'cat-2', name: 'Beverages' };
      repo.createQueryBuilder.mockReturnValueOnce(buildQb(null)).mockReturnValueOnce(buildQb(winner));
      repo.save.mockRejectedValue({ code: '23505' });

      const result = await service.create({ businessId: 'biz-1', name: 'Beverages' } as any);

      expect(result).toBe(winner);
    });

    it('rethrows non-conflict errors from save', async () => {
      repo.createQueryBuilder.mockReturnValue(buildQb(null));
      repo.save.mockRejectedValue(new Error('db down'));

      await expect(service.create({ businessId: 'biz-1', name: 'Beverages' } as any)).rejects.toThrow('db down');
    });

    it('rethrows the 23505 error if the winner cannot be found on re-fetch', async () => {
      repo.createQueryBuilder.mockReturnValueOnce(buildQb(null)).mockReturnValueOnce(buildQb(null));
      repo.save.mockRejectedValue({ code: '23505' });

      await expect(service.create({ businessId: 'biz-1', name: 'Beverages' } as any)).rejects.toEqual({ code: '23505' });
    });
  });

  describe('findAll', () => {
    it('returns categories for the business ordered by created_at', async () => {
      const list = [{ id: 'cat-1' }];
      repo.createQueryBuilder.mockReturnValue(buildQb(list));

      const result = await service.findAll('biz-1');

      expect(result).toBe(list);
    });
  });

  describe('findOne', () => {
    it('returns the category scoped to the business', async () => {
      repo.findOne.mockResolvedValue({ id: 'cat-1', business_id: 'biz-1' });

      const result = await service.findOne('cat-1', 'biz-1');

      expect(result.id).toBe('cat-1');
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates the name and cascades the rename to products sharing the old category name', async () => {
      repo.findOne.mockResolvedValue({ id: 'cat-1', business_id: 'biz-1', name: 'Old', parent_id: null });

      const result = await service.update('cat-1', 'biz-1', { name: 'New' } as any);

      expect(result.name).toBe('New');
      expect(repo.manager.createQueryBuilder).toHaveBeenCalled();
    });

    it('updates parentId without touching name-dependent product cascade when name is unchanged', async () => {
      repo.findOne.mockResolvedValue({ id: 'cat-1', business_id: 'biz-1', name: 'Same', parent_id: null });

      await service.update('cat-1', 'biz-1', { name: 'Same', parentId: 'parent-1' } as any);

      expect(repo.manager.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('leaves name/parentId untouched when dto fields are undefined', async () => {
      repo.findOne.mockResolvedValue({ id: 'cat-1', business_id: 'biz-1', name: 'Same', parent_id: 'p1' });

      const result = await service.update('cat-1', 'biz-1', {} as any);

      expect(result.name).toBe('Same');
      expect(result.parent_id).toBe('p1');
    });

    it('throws NotFoundException when the category does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', 'biz-1', { name: 'New' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the category and returns a deleted flag', async () => {
      repo.findOne.mockResolvedValue({ id: 'cat-1', business_id: 'biz-1' });

      const result = await service.remove('cat-1', 'biz-1');

      expect(repo.remove).toHaveBeenCalled();
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when the category does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });
});
