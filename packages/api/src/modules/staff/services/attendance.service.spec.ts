import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { Attendance, AttendanceStatus } from '../../../database/entities/attendance.entity';
import { User } from '../../../database/entities/user.entity';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let attendanceRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; createQueryBuilder: jest.Mock };
  let usersRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    attendanceRepo = {
      findOne: jest.fn(),
      create: jest.fn((entity) => ({ id: 'att-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      createQueryBuilder: jest.fn(),
    };
    usersRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: getRepositoryToken(Attendance), useValue: attendanceRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();

    service = module.get(AttendanceService);
  });

  describe('clockIn', () => {
    it('creates a new PRESENT record and sets clock_in when none exists yet today', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', business_id: 'biz-1' });
      attendanceRepo.findOne.mockResolvedValue(null);

      const result = await service.clockIn({ businessId: 'biz-1', userId: 'user-1' } as any);

      expect(attendanceRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: AttendanceStatus.PRESENT }));
      expect(result.clock_in).toBeInstanceOf(Date);
    });

    it('reuses an existing record for today that has no clock_in yet', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', business_id: 'biz-1' });
      attendanceRepo.findOne.mockResolvedValue({ id: 'att-1', clock_in: null });

      await service.clockIn({ businessId: 'biz-1', userId: 'user-1' } as any);

      expect(attendanceRepo.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when already clocked in today', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', business_id: 'biz-1' });
      attendanceRepo.findOne.mockResolvedValue({ id: 'att-1', clock_in: new Date() });

      await expect(service.clockIn({ businessId: 'biz-1', userId: 'user-1' } as any)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when the staff member does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(service.clockIn({ businessId: 'biz-1', userId: 'missing' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('clockOut', () => {
    it('computes shift_hours from clock_in to now', async () => {
      const clockInTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
      attendanceRepo.findOne.mockResolvedValue({ id: 'att-1', clock_in: clockInTime, clock_out: null });

      const result = await service.clockOut({ businessId: 'biz-1', userId: 'user-1' } as any);

      expect(result.shift_hours).toBeCloseTo(2, 1);
    });

    it('throws BadRequestException when there is no active clock-in for today', async () => {
      attendanceRepo.findOne.mockResolvedValue(null);

      await expect(service.clockOut({ businessId: 'biz-1', userId: 'user-1' } as any)).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when already clocked out today', async () => {
      attendanceRepo.findOne.mockResolvedValue({ id: 'att-1', clock_in: new Date(), clock_out: new Date() });

      await expect(service.clockOut({ businessId: 'biz-1', userId: 'user-1' } as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('getRoster', () => {
    it('filters by date and userId when provided', () => {
      const qb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      attendanceRepo.createQueryBuilder.mockReturnValue(qb);

      service.getRoster('biz-1', '2026-01-15', 'user-1');

      expect(qb.andWhere).toHaveBeenCalledWith('att.date = :date', { date: '2026-01-15' });
      expect(qb.andWhere).toHaveBeenCalledWith('att.user_id = :userId', { userId: 'user-1' });
    });
  });

  describe('markManual', () => {
    it('creates a new record for the given date with the requested status', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', business_id: 'biz-1' });
      attendanceRepo.findOne.mockResolvedValue(null);

      await service.markManual({ businessId: 'biz-1', userId: 'user-1', date: '2026-01-10', status: AttendanceStatus.ABSENT } as any);

      expect(attendanceRepo.create).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-01-10' }));
    });

    it('updates an existing record for that date', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', business_id: 'biz-1' });
      attendanceRepo.findOne.mockResolvedValue({ id: 'att-1', status: AttendanceStatus.PRESENT });

      const result = await service.markManual({ businessId: 'biz-1', userId: 'user-1', date: '2026-01-10', status: AttendanceStatus.ON_LEAVE } as any);

      expect(result.status).toBe(AttendanceStatus.ON_LEAVE);
    });

    it('throws NotFoundException when the staff member does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.markManual({ businessId: 'biz-1', userId: 'missing', date: '2026-01-10', status: AttendanceStatus.ABSENT } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
