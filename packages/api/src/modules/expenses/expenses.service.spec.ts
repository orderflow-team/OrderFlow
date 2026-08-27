import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { Expense } from '../../database/entities/expense.entity';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let repo: { create: jest.Mock; save: jest.Mock; createQueryBuilder: jest.Mock; findOne: jest.Mock; remove: jest.Mock };

  const buildQb = (result: any[] = []) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
  });

  beforeEach(async () => {
    repo = {
      create: jest.fn((entity) => ({ id: 'exp-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      remove: jest.fn(async (entity) => entity),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ExpensesService, { provide: getRepositoryToken(Expense), useValue: repo }],
    }).compile();

    service = module.get(ExpensesService);
  });

  describe('create', () => {
    it('creates an expense, parsing the expense date', async () => {
      const result = await service.create({ businessId: 'biz-1', category: 'Rent', amount: 500, expenseDate: '2026-01-15' } as any);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ business_id: 'biz-1', category: 'Rent', amount: 500, expense_date: new Date('2026-01-15') }),
      );
      expect(result).toBeDefined();
    });

    it('leaves expense_date undefined when not provided', async () => {
      await service.create({ businessId: 'biz-1', category: 'Rent', amount: 500 } as any);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ expense_date: undefined }));
    });
  });

  describe('findAll', () => {
    it('applies from/to date filters when provided', async () => {
      const qb = buildQb([{ id: 'e1' }]);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('biz-1', '2026-01-01', '2026-01-31');

      expect(qb.andWhere).toHaveBeenCalledWith('expense.expense_date >= :from', { from: '2026-01-01' });
      expect(qb.andWhere).toHaveBeenCalledWith('expense.expense_date <= :to', { to: '2026-01-31' });
      expect(result).toEqual([{ id: 'e1' }]);
    });

    it('omits date filters when not provided', async () => {
      const qb = buildQb([]);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('biz-1');

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes the expense and returns a deleted flag', async () => {
      repo.findOne.mockResolvedValue({ id: 'e1', business_id: 'biz-1' });

      const result = await service.remove('e1', 'biz-1');

      expect(repo.remove).toHaveBeenCalled();
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when the expense does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });
});
