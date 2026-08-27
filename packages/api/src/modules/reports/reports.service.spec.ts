import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Product } from '../../database/entities/product.entity';
import { ProductBatch } from '../../database/entities/product-batch.entity';
import { Business } from '../../database/entities/business.entity';
import { Customer } from '../../database/entities/customer.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { PurchaseItem } from '../../database/entities/purchase-item.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Expense } from '../../database/entities/expense.entity';
import { Salesman } from '../../database/entities/salesman.entity';

/** Any property read on this returns '0' — a stand-in for a getRawOne() row whose exact select aliases we don't care about in a generic smoke test. */
const zeroRow = () => new Proxy({}, { get: () => '0' });

const genericQb = (overrides: Record<string, any> = {}) => {
  const qb: any = {};
  const chain = ['where', 'andWhere', 'select', 'addSelect', 'groupBy', 'addGroupBy', 'orderBy', 'limit', 'skip', 'take', 'innerJoin', 'leftJoin', 'having'];
  chain.forEach((m) => (qb[m] = jest.fn().mockReturnValue(qb)));
  qb.getRawOne = jest.fn().mockResolvedValue(overrides.getRawOne ?? zeroRow());
  qb.getRawMany = jest.fn().mockResolvedValue(overrides.getRawMany ?? []);
  qb.getMany = jest.fn().mockResolvedValue(overrides.getMany ?? []);
  qb.getCount = jest.fn().mockResolvedValue(overrides.getCount ?? 0);
  return qb;
};

describe('ReportsService', () => {
  let service: ReportsService;
  let ordersRepo: Record<string, jest.Mock>;
  let orderItemsRepo: Record<string, jest.Mock>;
  let productsRepo: Record<string, jest.Mock>;
  let productBatchesRepo: Record<string, jest.Mock>;
  let customersRepo: Record<string, jest.Mock>;
  let purchaseOrdersRepo: Record<string, jest.Mock>;
  let purchaseItemsRepo: Record<string, jest.Mock>;
  let paymentsRepo: Record<string, jest.Mock>;
  let expensesRepo: Record<string, jest.Mock>;
  let salesmenRepo: Record<string, jest.Mock>;
  let businessesRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    ordersRepo = { createQueryBuilder: jest.fn(() => genericQb()) };
    orderItemsRepo = { createQueryBuilder: jest.fn(() => genericQb()) };
    productsRepo = { createQueryBuilder: jest.fn(() => genericQb()) };
    productBatchesRepo = { createQueryBuilder: jest.fn(() => genericQb()) };
    customersRepo = { createQueryBuilder: jest.fn(() => genericQb()) };
    purchaseOrdersRepo = { createQueryBuilder: jest.fn(() => genericQb()) };
    purchaseItemsRepo = { createQueryBuilder: jest.fn(() => genericQb()) };
    paymentsRepo = { createQueryBuilder: jest.fn(() => genericQb()) };
    expensesRepo = { createQueryBuilder: jest.fn(() => genericQb()), find: jest.fn().mockResolvedValue([]) };
    salesmenRepo = { count: jest.fn().mockResolvedValue(0) };
    businessesRepo = { findOne: jest.fn().mockResolvedValue({ id: 'biz-1', category: 'retail', inventory_enabled: true, gst_number: '27AAAAA0000A1Z5' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemsRepo },
        { provide: getRepositoryToken(Product), useValue: productsRepo },
        { provide: getRepositoryToken(ProductBatch), useValue: productBatchesRepo },
        { provide: getRepositoryToken(Customer), useValue: customersRepo },
        { provide: getRepositoryToken(PurchaseOrder), useValue: purchaseOrdersRepo },
        { provide: getRepositoryToken(PurchaseItem), useValue: purchaseItemsRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: getRepositoryToken(Expense), useValue: expensesRepo },
        { provide: getRepositoryToken(Salesman), useValue: salesmenRepo },
        { provide: getRepositoryToken(Business), useValue: businessesRepo },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  describe('dashboard', () => {
    it('returns the full dashboard shape with numeric fields coerced', async () => {
      const result = await service.dashboard('biz-1');

      expect(result.meta).toEqual({ category: 'retail', inventoryEnabled: true });
      expect(result.todaysSales).toBe(0);
      expect(result.pendingPaymentsAmount).toBe(0);
      expect(Array.isArray(result.topProducts)).toBe(true);
      expect(Array.isArray(result.topCustomers)).toBe(true);
    });

    it('skips the low-stock query entirely when inventory tracking is disabled', async () => {
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', category: 'retail', inventory_enabled: false });

      const result = await service.dashboard('biz-1');

      expect(result.lowStockProducts).toEqual([]);
      expect(productsRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('skips the expiry query for a restaurant business even with inventory enabled', async () => {
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', category: 'restaurant', inventory_enabled: true });

      const result = await service.dashboard('biz-1');

      expect(result.expiringProducts).toEqual([]);
      expect(productBatchesRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('maps top products and top customers with default names for unlinked/unnamed rows', async () => {
      orderItemsRepo.createQueryBuilder.mockReturnValueOnce(
        genericQb({ getRawMany: [{ productId: 'p1', productName: null, totalQuantity: '5', totalRevenue: '250' }] }),
      );

      const result = await service.dashboard('biz-1');

      expect(result.topProducts[0]).toEqual({ productId: 'p1', productName: 'Unknown product', totalQuantity: 5, totalRevenue: 250 });
    });
  });

  describe('salesReport', () => {
    it('maps grouped daily rows and applies from/to filters', async () => {
      const qb = genericQb({ getRawMany: [{ date: '2026-01-01', orderCount: '3', totalSales: '900' }] });
      ordersRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.salesReport('biz-1', '2026-01-01', '2026-01-31');

      expect(qb.andWhere).toHaveBeenCalledWith('order.created_at >= :from', { from: '2026-01-01' });
      expect(qb.andWhere).toHaveBeenCalledWith('order.created_at <= :to', { to: '2026-01-31' });
      expect(result).toEqual([{ date: '2026-01-01', orderCount: 3, totalSales: 900 }]);
    });
  });

  describe('outstandingReport', () => {
    it('returns customers with an outstanding balance, ordered descending', async () => {
      const qb = genericQb({ getMany: [{ id: 'c1' }] });
      customersRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.outstandingReport('biz-1');

      expect(qb.orderBy).toHaveBeenCalledWith('customer.outstanding_amount', 'DESC');
      expect(result).toEqual([{ id: 'c1' }]);
    });
  });

  describe('profitReport', () => {
    it('computes gross profit and margin percent', async () => {
      const qb = genericQb({ getRawOne: { revenue: '1000', cost: '600' } });
      orderItemsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.profitReport('biz-1');

      expect(result).toEqual({ revenue: 1000, cost: 600, grossProfit: 400, marginPercent: 40 });
    });

    it('returns a zero margin percent when there is no revenue', async () => {
      const qb = genericQb({ getRawOne: { revenue: '0', cost: '0' } });
      orderItemsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.profitReport('biz-1');

      expect(result.marginPercent).toBe(0);
    });
  });

  describe('taxReport', () => {
    it('maps grouped daily tax rows', async () => {
      const qb = genericQb({ getRawMany: [{ date: '2026-01-01', orderCount: '2', totalSales: '500', totalTax: '25' }] });
      ordersRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.taxReport('biz-1');

      expect(result).toEqual([{ date: '2026-01-01', orderCount: 2, totalSales: 500, totalTax: 25 }]);
    });
  });

  describe('gstSummaryReport', () => {
    it('splits CGST/SGST for an intra-state item and groups by rate/HSN, plus B2B/B2C split', async () => {
      orderItemsRepo.createQueryBuilder.mockReturnValue(
        genericQb({
          getRawMany: [
            { taxPercentage: '5', quantity: '2', subtotal: '100', taxAmount: '5', hsnCode: '3004', customerGst: '27BBBBB1111B1Z5' },
          ],
        }),
      );
      ordersRepo.createQueryBuilder.mockReturnValue(
        genericQb({ getRawMany: [{ totalAmount: '105', customerGst: '27BBBBB1111B1Z5' }] }),
      );

      const result = await service.gstSummaryReport('biz-1');

      expect(result.rateWise).toEqual([
        { taxPercentage: 5, taxableValue: 100, cgstAmount: 2.5, sgstAmount: 2.5, igstAmount: 0, totalTax: 5, itemCount: 1 },
      ]);
      expect(result.hsnWise).toEqual([{ hsnCode: '3004', quantity: 2, taxableValue: 100, taxAmount: 5 }]);
      expect(result.b2b).toEqual({ invoiceCount: 1, totalValue: 105 });
      expect(result.b2c).toEqual({ invoiceCount: 0, totalValue: 0 });
    });

    it('splits to IGST for an inter-state item and buckets an unclassified HSN', async () => {
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', gst_number: '27AAAAA0000A1Z5' });
      orderItemsRepo.createQueryBuilder.mockReturnValue(
        genericQb({
          getRawMany: [{ taxPercentage: '12', quantity: '1', subtotal: '200', taxAmount: '24', hsnCode: null, customerGst: '07BBBBB1111B1Z5' }],
        }),
      );
      ordersRepo.createQueryBuilder.mockReturnValue(genericQb({ getRawMany: [] }));

      const result = await service.gstSummaryReport('biz-1');

      expect(result.rateWise[0]).toEqual(
        expect.objectContaining({ igstAmount: 24, cgstAmount: 0, sgstAmount: 0 }),
      );
      expect(result.hsnWise[0].hsnCode).toBe('Unclassified');
    });
  });

  describe('scheduleH1Register', () => {
    it('maps schedule-H1 sale rows with prescriber details', async () => {
      const qb = genericQb({
        getRawMany: [
          {
            orderId: 'order-1',
            orderNumber: 'ORD-1',
            soldAt: '2026-01-01',
            customerName: 'Neel',
            patientName: 'Patient A',
            doctorName: 'Dr. X',
            doctorRegistrationNumber: 'REG-1',
            productName: 'Restricted Drug',
            batchNumber: 'B1',
            expiryDate: '2027-01-01',
            quantity: '2',
          },
        ],
      });
      orderItemsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.scheduleH1Register('biz-1');

      expect(qb.andWhere).toHaveBeenCalledWith('product.is_schedule_h1 = true');
      expect(result[0]).toEqual(
        expect.objectContaining({ orderId: 'order-1', doctorRegistrationNumber: 'REG-1', quantity: 2 }),
      );
    });
  });

  describe('analyticsDashboard (smoke test across the full aggregate payload)', () => {
    it('returns the full shape without throwing, with every generic aggregate defaulting to zero/empty', async () => {
      const result = await service.analyticsDashboard('biz-1', 30);

      expect(result.meta).toEqual({ category: 'retail', inventoryEnabled: true });
      expect(result.kpis).toBeDefined();
      expect(result.comparison).toBeDefined();
      expect(Array.isArray(result.chart)).toBe(true);
      expect(result.customers).toBeDefined();
      expect(result.products).toBeDefined();
      expect(result.suppliers).toBeDefined();
      expect(result.finance).toBeDefined();
      expect(result.operations).toBeDefined();
    });

    it('skips salesman performance entirely when the business has no salesmen', async () => {
      const result = await service.analyticsDashboard('biz-1', 30);

      expect(result.operations.salesmanPerformance).toEqual([]);
    });
  });

  describe('private pure helpers', () => {
    describe('buildChartSeries', () => {
      it('zero-fills every day in range and merges sales/purchase rows keyed by local date', () => {
        const chartSince = new Date(2026, 0, 1);
        const now = new Date(2026, 0, 3);
        const { chart, chartGranularity } = (service as any).buildChartSeries(
          [{ date: '2026-01-02', total: '100' }],
          [{ date: '2026-01-01', total: '50' }],
          chartSince,
          now,
          30,
        );

        expect(chartGranularity).toBe('day');
        expect(chart).toEqual([
          { date: '2026-01-01', sales: 0, purchases: 50 },
          { date: '2026-01-02', sales: 100, purchases: 0 },
          { date: '2026-01-03', sales: 0, purchases: 0 },
        ]);
      });

      it('normalizes a real Date object row (not just a date string) into the correct local-date bucket (regression guard)', () => {
        const chartSince = new Date(2026, 0, 1);
        const now = new Date(2026, 0, 2);
        const dateRowAsDate = new Date(2026, 0, 1);

        const { chart } = (service as any).buildChartSeries([{ date: dateRowAsDate, total: '75' }], [], chartSince, now, 30);

        expect(chart.find((r: any) => r.date === '2026-01-01')?.sales).toBe(75);
      });

      it('buckets into weeks once the range exceeds 60 days', () => {
        const chartSince = new Date(2026, 0, 1);
        const now = new Date(2026, 3, 1);

        const { chartGranularity } = (service as any).buildChartSeries([], [], chartSince, now, 90);

        expect(chartGranularity).toBe('week');
      });

      it('buckets into months once the range exceeds 180 days', () => {
        const chartSince = new Date(2026, 0, 1);
        const now = new Date(2026, 9, 1);

        const { chartGranularity } = (service as any).buildChartSeries([], [], chartSince, now, 200);

        expect(chartGranularity).toBe('month');
      });
    });

    describe('buildActionItems', () => {
      it('ranks a high-severity reorder item before a slow-moving item and includes a credit-exposure item', () => {
        const items = (service as any).buildActionItems(
          [{ id: 'p1', name: 'Widget', stockQuantity: 5, velocityPerDay: 2, daysLeft: 2 }],
          [],
          [{ id: 'p2', name: 'Old Stock', stockQuantity: 10, tiedUpValue: 500 }],
          [{ id: 'c1', name: 'Big Spender', outstandingAmount: 900, creditLimit: 1000, utilizationPercent: 90 }],
        );

        expect(items.some((i: any) => i.type === 'reorder' && i.severity === 'high')).toBe(true);
        expect(items.some((i: any) => i.type === 'slow-moving')).toBe(true);
        expect(items.some((i: any) => i.type === 'credit' && i.severity === 'medium')).toBe(true);
        // Tied on severity 'high', the slow-moving item (₹500 tied up) outranks
        // the reorder item (value: null, treated as 0) in the final ordering.
        expect(items[0]).toEqual(expect.objectContaining({ type: 'slow-moving' }));
      });

      it('excludes a reorder suggestion with more than 14 days of stock left', () => {
        const items = (service as any).buildActionItems(
          [{ id: 'p1', name: 'Widget', stockQuantity: 100, velocityPerDay: 1, daysLeft: 100 }],
          [],
          [],
          [],
        );

        expect(items).toHaveLength(0);
      });

      it('caps the result at 12 items', () => {
        const manyCreditItems = Array.from({ length: 20 }, (_, i) => ({
          id: `c${i}`,
          name: `Customer ${i}`,
          outstandingAmount: 100,
          creditLimit: 100,
          utilizationPercent: 100,
        }));

        const items = (service as any).buildActionItems([], [], [], manyCreditItems);

        expect(items).toHaveLength(5);
      });
    });

    describe('toDateKey / weekStartKey / daysFromNow', () => {
      it('formats a date as a local YYYY-MM-DD key', () => {
        expect((service as any).toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
      });

      it('resolves the Sunday that starts the week containing the given date key', () => {
        // 2026-01-07 is a Wednesday
        expect((service as any).weekStartKey('2026-01-07')).toBe('2026-01-04');
      });

      it('shifts the current date by the given number of days', () => {
        const result = (service as any).daysFromNow(-7);
        const expected = new Date();
        expected.setDate(expected.getDate() - 7);
        expect((service as any).toDateKey(result)).toBe((service as any).toDateKey(expected));
      });
    });
  });
});
