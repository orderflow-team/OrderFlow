import { SalesReportsService } from './sales-reports.service';

const chain = (opts: { many?: any[]; one?: any }) => {
  const qb: any = {};
  for (const m of ['innerJoin', 'leftJoin', 'where', 'andWhere', 'select', 'addSelect', 'groupBy', 'addGroupBy', 'orderBy', 'limit']) qb[m] = jest.fn(() => qb);
  qb.getRawMany = jest.fn().mockResolvedValue(opts.many ?? []);
  qb.getRawOne = jest.fn().mockResolvedValue(opts.one);
  qb.getMany = jest.fn().mockResolvedValue(opts.many ?? []);
  return qb;
};

describe('SalesReportsService', () => {
  it('computes per-bill profit, margin and flags truncation', async () => {
    const rows = chain({
      many: [
        { id: '1', orderNumber: 'A1', createdAt: '2026-10-01T10:00:00Z', customerName: null, revenue: '200', cost: '150', lines: '2', uncostedLines: '0' },
        { id: '2', orderNumber: 'A2', createdAt: '2026-10-02T10:00:00Z', customerName: 'Ravi', revenue: '100', cost: '120', lines: '1', uncostedLines: '1' },
      ],
    });
    const totals = chain({ one: { revenue: '300', cost: '270' } });
    const count = chain({ one: { count: '5' } });
    const items = { createQueryBuilder: jest.fn().mockReturnValueOnce(rows).mockReturnValueOnce(totals).mockReturnValueOnce(count) };
    const service = new SalesReportsService({} as any, items as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    const r = await service.saleWiseProfit('biz', '2026-10-01', '2026-10-31');

    expect(r.sales[0]).toMatchObject({ customerName: 'Walk-in', profit: 50, marginPercent: 25 });
    expect(r.sales[1]).toMatchObject({ profit: -20, uncostedLines: 1 });
    expect(r.totals).toMatchObject({ bills: 5, revenue: 300, profit: 30, marginPercent: 10, lossMakingBills: 1 });
    expect(r.truncated).toBe(true); // 5 bills exist, 2 returned
  });

  it('groups staff, labels bills with no creator, and computes share of sales', async () => {
    const rows = chain({
      many: [
        { userId: 'u1', name: 'Asha', role: 'cashier', bills: '3', sales: '300', tax: '30' },
        { userId: null, name: null, role: null, bills: '1', sales: '100', tax: '10' },
      ],
    });
    const orders = { createQueryBuilder: jest.fn(() => rows) };
    const service = new SalesReportsService(orders as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    const r = await service.staffWiseSales('biz', '2026-10-01', '2026-10-31');

    expect(r.staff[0]).toMatchObject({ name: 'Asha', averageBill: 100, sharePercent: 75 });
    expect(r.staff[1]).toMatchObject({ userId: null, name: 'QR / online / unassigned', sharePercent: 25 });
    expect(r.totals).toEqual({ bills: 4, sales: 400 });
  });

  it('merges stock with period sales/purchases and classifies out/low/ok', async () => {
    const products = chain({
      many: [
        { id: 'p1', name: 'Rice', stock_quantity: 0, purchase_price: 60, reorder_point: 5 },
        { id: 'p2', name: 'Oil', stock_quantity: 4, purchase_price: 100, reorder_point: 5 },
        { id: 'p3', name: 'Salt', stock_quantity: 50, purchase_price: 10, reorder_point: null },
      ],
    });
    const sold = chain({ many: [{ productId: 'p3', qty: '7', revenue: '140' }] });
    const bought = chain({ many: [{ productId: 'p3', qty: '20' }] });
    const service = new SalesReportsService(
      {} as any,
      { createQueryBuilder: () => sold } as any,
      { createQueryBuilder: () => products } as any,
      { createQueryBuilder: () => bought } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const r = await service.stockSummary('biz', '2026-10-01', '2026-10-31');

    expect(r.items.map((i) => i.status)).toEqual(['out', 'low', 'ok']);
    expect(r.items[2]).toMatchObject({ soldQty: 7, purchasedQty: 20, stockValue: 500 });
    expect(r.totals).toMatchObject({ stockValue: 900, outOfStock: 1, lowStock: 1, soldQty: 7, purchasedQty: 20 });
  });

  it('splits money in by method, adds expenses and purchases to money out, and nets per day', async () => {
    const payments = chain({});
    payments.getRawMany
      .mockResolvedValueOnce([{ label: 'Cash', total: '300', count: '3' }, { label: 'UPI', total: '200', count: '2' }])
      .mockResolvedValueOnce([{ day: '2026-10-01', total: '400' }, { day: '2026-10-02', total: '100' }]);
    const expenses = chain({});
    expenses.getRawMany
      .mockResolvedValueOnce([{ label: 'Rent', total: '80', count: '1' }])
      .mockResolvedValueOnce([{ day: '2026-10-02', total: '80' }]);
    const purchases = chain({ one: { total: '120', count: '1' } });
    purchases.getRawMany.mockResolvedValue([{ day: '2026-10-01', total: '120' }]);
    const service = new SalesReportsService(
      {} as any, {} as any, {} as any, {} as any,
      { createQueryBuilder: () => payments } as any,
      { createQueryBuilder: () => expenses } as any,
      { createQueryBuilder: () => purchases } as any,
    );

    const r = await service.moneyFlow('biz', '2026-10-01', '2026-10-31');

    expect(r.totals).toEqual({ moneyIn: 500, moneyOut: 200, net: 300, cashIn: 300, digitalIn: 200 });
    expect(r.daily).toEqual([
      { date: '2026-10-01', moneyIn: 400, moneyOut: 120, net: 280 },
      { date: '2026-10-02', moneyIn: 100, moneyOut: 80, net: 20 },
    ]);
  });
});
