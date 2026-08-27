import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: jest.Mocked<ReportsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: {
            dashboard: jest.fn(),
            salesReport: jest.fn(),
            outstandingReport: jest.fn(),
            profitReport: jest.fn(),
            taxReport: jest.fn(),
            gstSummaryReport: jest.fn(),
            scheduleH1Register: jest.fn(),
            analyticsDashboard: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ReportsController);
    service = module.get(ReportsService);
  });

  it('dashboard delegates to the service', () => {
    controller.dashboard('biz-1');
    expect(service.dashboard).toHaveBeenCalledWith('biz-1');
  });

  it('salesReport delegates to the service', () => {
    controller.salesReport('biz-1', '2026-01-01', '2026-01-31');
    expect(service.salesReport).toHaveBeenCalledWith('biz-1', '2026-01-01', '2026-01-31');
  });

  it('outstandingReport delegates to the service', () => {
    controller.outstandingReport('biz-1');
    expect(service.outstandingReport).toHaveBeenCalledWith('biz-1');
  });

  it('profitReport delegates to the service', () => {
    controller.profitReport('biz-1', '2026-01-01', '2026-01-31');
    expect(service.profitReport).toHaveBeenCalledWith('biz-1', '2026-01-01', '2026-01-31');
  });

  it('taxReport delegates to the service', () => {
    controller.taxReport('biz-1', '2026-01-01', '2026-01-31');
    expect(service.taxReport).toHaveBeenCalledWith('biz-1', '2026-01-01', '2026-01-31');
  });

  it('gstSummaryReport delegates to the service', () => {
    controller.gstSummaryReport('biz-1', '2026-01-01', '2026-01-31');
    expect(service.gstSummaryReport).toHaveBeenCalledWith('biz-1', '2026-01-01', '2026-01-31');
  });

  it('scheduleH1Register delegates to the service', () => {
    controller.scheduleH1Register('biz-1', '2026-01-01', '2026-01-31');
    expect(service.scheduleH1Register).toHaveBeenCalledWith('biz-1', '2026-01-01', '2026-01-31');
  });

  describe('analyticsDashboard', () => {
    it('converts the days query string to a number', () => {
      controller.analyticsDashboard('biz-1', '90');
      expect(service.analyticsDashboard).toHaveBeenCalledWith('biz-1', 90);
    });

    it('defaults to 30 days when not provided', () => {
      controller.analyticsDashboard('biz-1');
      expect(service.analyticsDashboard).toHaveBeenCalledWith('biz-1', 30);
    });
  });
});
