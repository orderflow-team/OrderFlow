import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { Commission, CommissionStatus } from '../../../database/entities/commission.entity';
import { User } from '../../../database/entities/user.entity';
import { Order } from '../../../database/entities/order.entity';

describe('CommissionsService', () => {
  let service: CommissionsService;
  let commissionsRepo: { create: jest.Mock; save: jest.Mock; createQueryBuilder: jest.Mock; find: jest.Mock };
  let usersRepo: { find: jest.Mock };

  beforeEach(async () => {
    commissionsRepo = {
      create: jest.fn((entity) => ({ id: 'comm-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
    };
    usersRepo = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionsService,
        { provide: getRepositoryToken(Commission), useValue: commissionsRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Order), useValue: {} },
      ],
    }).compile();

    service = module.get(CommissionsService);
  });

  describe('createForOrder', () => {
    it('computes and persists the commission earned', async () => {
      const result = await service.createForOrder('biz-1', 'order-1', 'user-1', 10, 500);

      expect(commissionsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ commission_earned: 50, status: CommissionStatus.PENDING }),
      );
      expect(result).toBeDefined();
    });

    it('returns null when the commission rate is zero or negative', async () => {
      expect(await service.createForOrder('biz-1', 'order-1', 'user-1', 0, 500)).toBeNull();
      expect(await service.createForOrder('biz-1', 'order-1', 'user-1', -5, 500)).toBeNull();
    });

    it('returns null when the sale amount is zero or negative', async () => {
      expect(await service.createForOrder('biz-1', 'order-1', 'user-1', 10, 0)).toBeNull();
    });
  });

  describe('getCommissions', () => {
    it('applies userId and status filters when provided', () => {
      const qb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      commissionsRepo.createQueryBuilder.mockReturnValue(qb);

      service.getCommissions('biz-1', 'user-1', CommissionStatus.PAID);

      expect(qb.andWhere).toHaveBeenCalledWith('comm.user_id = :userId', { userId: 'user-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('comm.status = :status', { status: CommissionStatus.PAID });
    });
  });

  describe('getSummary', () => {
    it('maps raw aggregate rows to named staff summaries', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { userId: 'user-1', totalSales: '1000', totalCommission: '100', paidCommission: '40', pendingCommission: '60' },
        ]),
      };
      commissionsRepo.createQueryBuilder.mockReturnValue(qb);
      usersRepo.find.mockResolvedValue([{ id: 'user-1', full_name: 'Salesman One', email: 'sm@example.com' }]);

      const result = await service.getSummary('biz-1');

      expect(result).toEqual([
        { userId: 'user-1', userName: 'Salesman One', totalSales: 1000, totalCommission: 100, paidCommission: 40, pendingCommission: 60 },
      ]);
    });

    it('falls back to "Staff Member" when the user cannot be found', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ userId: 'missing-user', totalSales: '0', totalCommission: '0', paidCommission: '0', pendingCommission: '0' }]),
      };
      commissionsRepo.createQueryBuilder.mockReturnValue(qb);
      usersRepo.find.mockResolvedValue([]);

      const result = await service.getSummary('biz-1');

      expect(result[0].userName).toBe('Staff Member');
    });
  });

  describe('payout', () => {
    it('marks the requested commissions as paid', async () => {
      commissionsRepo.find.mockResolvedValue([
        { id: 'comm-1', status: CommissionStatus.PENDING },
        { id: 'comm-2', status: CommissionStatus.PENDING },
      ]);

      const result = await service.payout({ businessId: 'biz-1', commissionIds: ['comm-1', 'comm-2'] } as any);

      expect(commissionsRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ status: CommissionStatus.PAID }),
        expect.objectContaining({ status: CommissionStatus.PAID }),
      ]);
      expect(result.count).toBe(2);
    });

    it('throws NotFoundException when none of the requested commissions exist', async () => {
      commissionsRepo.find.mockResolvedValue([]);

      await expect(service.payout({ businessId: 'biz-1', commissionIds: ['missing'] } as any)).rejects.toThrow(NotFoundException);
    });
  });
});
