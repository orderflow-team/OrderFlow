import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LedgerReportsService, allocateOutstanding, bucketForAge, parseRange } from './ledger-reports.service';

describe('ledger report helpers', () => {
  it('buckets ages at the 30/60/90 day boundaries', () => {
    expect([0, 30, 31, 60, 61, 90, 91].map(bucketForAge)).toEqual(['0-30', '0-30', '31-60', '31-60', '61-90', '61-90', '90+']);
  });

  it('puts dues on the newest bills first and leaves older paid bills out', () => {
    const docs = [{ total: 100 }, { total: 200 }, { total: 300 }]; // newest first
    expect(allocateOutstanding(docs, 250)).toEqual([
      { total: 100, due: 100 },
      { total: 200, due: 150 },
    ]);
    expect(allocateOutstanding(docs, 0)).toEqual([]);
  });

  it('treats a bare date as an IST calendar day regardless of server timezone', () => {
    const { start, end } = parseRange('2026-10-05', '2026-10-05');
    expect(start.toISOString()).toBe('2026-10-04T18:30:00.000Z'); // 00:00 IST
    expect(end.toISOString()).toBe('2026-10-05T18:29:59.999Z'); // 23:59:59.999 IST
  });

  it('treats a bare "to" date as the end of that day and rejects bad or reversed ranges', () => {
    const { start, end } = parseRange('2026-10-01', '2026-10-01');
    expect(end.getTime() - start.getTime()).toBeGreaterThan(86_000_000);
    expect(() => parseRange('nope', undefined)).toThrow(BadRequestException);
    expect(() => parseRange('2026-10-05', '2026-10-01')).toThrow(BadRequestException);
  });
});

describe('LedgerReportsService.ageing', () => {
  const chain = (rows: any[]) => {
    const qb: any = {};
    for (const m of ['where', 'andWhere', 'orderBy', 'limit']) qb[m] = jest.fn(() => qb);
    qb.getMany = jest.fn().mockResolvedValue(rows);
    return qb;
  };
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

  it('fetches all parties\' bills in ONE query and ages dues onto the newest bills', async () => {
    const customers = chain([
      { id: 'c1', name: 'Ravi', phone: '99', outstanding_amount: 250 },
      { id: 'c2', name: 'Sita', phone: null, outstanding_amount: 50 },
    ]);
    const orders = {
      query: jest.fn().mockResolvedValue([
        { party_id: 'c1', created_at: daysAgo(40), total_amount: '200' },
        { party_id: 'c1', created_at: daysAgo(2), total_amount: '150' },
        { party_id: 'c2', created_at: daysAgo(120), total_amount: '80' },
      ]),
    };
    const service = new LedgerReportsService(orders as any, { createQueryBuilder: () => customers } as any, {} as any, {} as any, {} as any, {} as any);

    const r = await service.ageing('biz', 'receivable');

    expect(orders.query).toHaveBeenCalledTimes(1);
    expect(r.parties[0].buckets).toMatchObject({ '0-30': 150, '31-60': 100 });
    expect(r.parties[1].buckets).toMatchObject({ '90+': 50 });
    expect(r.total).toBe(300);
    expect(r.buckets).toMatchObject({ '0-30': 150, '31-60': 100, '90+': 50 });
  });

  it('puts dues that no bill explains (opening balance) in the oldest bucket and skips the bill query when nobody owes', async () => {
    const orders = { query: jest.fn().mockResolvedValue([]) };
    const some = chain([{ id: 'c1', name: 'Ravi', phone: null, outstanding_amount: 75 }]);
    const withDebt = new LedgerReportsService(orders as any, { createQueryBuilder: () => some } as any, {} as any, {} as any, {} as any, {} as any);
    expect((await withDebt.ageing('biz', 'receivable')).parties[0].buckets['90+']).toBe(75);

    const none = new LedgerReportsService(orders as any, { createQueryBuilder: () => chain([]) } as any, {} as any, {} as any, {} as any, {} as any);
    orders.query.mockClear();
    expect((await none.ageing('biz', 'receivable')).parties).toEqual([]);
    expect(orders.query).not.toHaveBeenCalled();
  });
});

describe('LedgerReportsService.partyLedger', () => {
  const chain = (rows: any[]) => {
    const qb: any = {};
    for (const m of ['where', 'andWhere', 'innerJoinAndSelect', 'leftJoinAndSelect', 'orderBy', 'limit']) qb[m] = jest.fn(() => qb);
    qb.getMany = jest.fn().mockResolvedValue(rows);
    return qb;
  };
  const ID = '11111111-1111-1111-1111-111111111111';

  it('rejects a malformed party id before touching the database', async () => {
    const customers = { findOne: jest.fn() };
    const service = new LedgerReportsService({} as any, customers as any, {} as any, {} as any, {} as any, {} as any);
    await expect(service.partyLedger('biz', 'customer', "x' OR 1=1", '2026-10-01', '2026-10-31')).rejects.toThrow(BadRequestException);
    expect(customers.findOne).not.toHaveBeenCalled();
  });

  it('404s for a party that belongs to another shop (lookup is scoped by business)', async () => {
    const customers = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new LedgerReportsService({} as any, customers as any, {} as any, {} as any, {} as any, {} as any);
    await expect(service.partyLedger('biz', 'customer', ID, '2026-10-01', '2026-10-31')).rejects.toThrow(NotFoundException);
    expect(customers.findOne).toHaveBeenCalledWith({ where: { id: ID, business_id: 'biz' } });
  });

  it('carries the pre-period balance forward and runs the balance per row', async () => {
    const customers = { findOne: jest.fn().mockResolvedValue({ id: ID, name: 'Ravi', phone: '99', outstanding_amount: 70 }) };
    const orders = chain([
      { created_at: new Date('2026-09-10T10:00:00'), order_number: 'A1', total_amount: 100 }, // before period
      { created_at: new Date('2026-10-05T10:00:00'), order_number: 'A2', total_amount: 50 },
    ]);
    const payments = chain([{ created_at: new Date('2026-10-06T10:00:00'), amount: 80, payment_method: 'Cash', order: { order_number: 'A1' } }]);
    const service = new LedgerReportsService(
      { createQueryBuilder: () => orders } as any,
      customers as any,
      {} as any,
      {} as any,
      { createQueryBuilder: () => payments } as any,
      {} as any,
    );

    const result = await service.partyLedger('biz', 'customer', ID, '2026-10-01', '2026-10-31');

    expect(result.openingBalance).toBe(100);
    expect(result.entries.map((e) => e.balance)).toEqual([150, 70]);
    expect(result.closingBalance).toBe(70);
    expect(result.currentOutstanding).toBe(70);
  });
});
