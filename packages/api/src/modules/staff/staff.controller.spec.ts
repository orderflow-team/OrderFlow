import { Test, TestingModule } from '@nestjs/testing';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { AttendanceService } from './services/attendance.service';
import { CommissionsService } from './services/commissions.service';
import { CommissionStatus } from '../../database/entities/commission.entity';

describe('StaffController', () => {
  let controller: StaffController;
  let staffService: jest.Mocked<StaffService>;
  let attendanceService: jest.Mocked<AttendanceService>;
  let commissionsService: jest.Mocked<CommissionsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffController],
      providers: [
        {
          provide: StaffService,
          useValue: { create: jest.fn(), findAll: jest.fn(), getCredentials: jest.fn(), update: jest.fn(), remove: jest.fn() },
        },
        {
          provide: AttendanceService,
          useValue: { clockIn: jest.fn(), clockOut: jest.fn(), getRoster: jest.fn(), markManual: jest.fn() },
        },
        {
          provide: CommissionsService,
          useValue: { getCommissions: jest.fn(), getSummary: jest.fn(), payout: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(StaffController);
    staffService = module.get(StaffService);
    attendanceService = module.get(AttendanceService);
    commissionsService = module.get(CommissionsService);
  });

  it('create delegates to StaffService with the businessId pulled from the dto', () => {
    const dto = { businessId: 'biz-1', email: 'a@b.com' } as any;
    controller.create(dto);
    expect(staffService.create).toHaveBeenCalledWith('biz-1', dto);
  });

  it('findAll delegates to StaffService', () => {
    controller.findAll('biz-1');
    expect(staffService.findAll).toHaveBeenCalledWith('biz-1');
  });

  it('getCredentials delegates to StaffService', () => {
    controller.getCredentials('u1', 'biz-1');
    expect(staffService.getCredentials).toHaveBeenCalledWith('u1', 'biz-1');
  });

  it('update delegates to StaffService', () => {
    const dto = { name: 'New' } as any;
    controller.update('u1', 'biz-1', dto);
    expect(staffService.update).toHaveBeenCalledWith('u1', 'biz-1', dto);
  });

  it('remove delegates to StaffService', () => {
    controller.remove('u1', 'biz-1');
    expect(staffService.remove).toHaveBeenCalledWith('u1', 'biz-1');
  });

  it('clockIn delegates to AttendanceService', () => {
    const dto = { businessId: 'biz-1', userId: 'u1' } as any;
    controller.clockIn(dto);
    expect(attendanceService.clockIn).toHaveBeenCalledWith(dto);
  });

  it('clockOut delegates to AttendanceService', () => {
    const dto = { businessId: 'biz-1', userId: 'u1' } as any;
    controller.clockOut(dto);
    expect(attendanceService.clockOut).toHaveBeenCalledWith(dto);
  });

  it('getRoster delegates to AttendanceService', () => {
    controller.getRoster('biz-1', '2026-01-01', 'u1');
    expect(attendanceService.getRoster).toHaveBeenCalledWith('biz-1', '2026-01-01', 'u1');
  });

  it('markManual delegates to AttendanceService', () => {
    const dto = { businessId: 'biz-1', userId: 'u1', date: '2026-01-01', status: 'ABSENT' } as any;
    controller.markManual(dto);
    expect(attendanceService.markManual).toHaveBeenCalledWith(dto);
  });

  it('getCommissions delegates to CommissionsService', () => {
    controller.getCommissions('biz-1', 'u1', CommissionStatus.PENDING);
    expect(commissionsService.getCommissions).toHaveBeenCalledWith('biz-1', 'u1', CommissionStatus.PENDING);
  });

  it('getCommissionsSummary delegates to CommissionsService', () => {
    controller.getCommissionsSummary('biz-1');
    expect(commissionsService.getSummary).toHaveBeenCalledWith('biz-1');
  });

  it('payoutCommissions delegates to CommissionsService', () => {
    const dto = { businessId: 'biz-1', commissionIds: ['c1'] } as any;
    controller.payoutCommissions(dto);
    expect(commissionsService.payout).toHaveBeenCalledWith(dto);
  });
});
