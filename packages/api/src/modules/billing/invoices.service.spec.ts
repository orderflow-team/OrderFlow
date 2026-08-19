import { EntityManager } from 'typeorm';
import { InvoicesService } from './invoices.service';

/**
 * nextDocumentNumber is private and side-effect-free on `this` (it only
 * touches the `manager` argument), so these bypass the constructor entirely
 * rather than mock all seven repositories + DataSource it doesn't need for
 * this method.
 */
function makeService(): any {
  return Object.create(InvoicesService.prototype);
}

function fakeManager(queryImpl: (sql: string, params: any[]) => Promise<any>): EntityManager {
  return { query: jest.fn(queryImpl) } as unknown as EntityManager;
}

describe('InvoicesService.nextDocumentNumber', () => {
  it('builds "INV/{fy}/{seq}" from a real TypeORM [rows, rowCount] RETURNING tuple', async () => {
    // This is the exact shape TypeORM 1.0.0's postgres driver returns for an
    // UPDATE...RETURNING via manager.query() — verified against a live
    // DataSource, not assumed. See the fix commit: result[0] used to be
    // mistaken for the row itself instead of the rows array.
    const manager = fakeManager(async () => [[{ invoice_sequence_value: 7 }], 1]);
    const service = makeService();

    const result = await service.nextDocumentNumber(manager, 'biz-1', 'invoice');

    expect(result).toMatch(/^INV\/\d{4}-\d{2}\/00007$/);
  });

  it('builds "CN/{fy}/{seq}" for the credit_note series with its own column names', async () => {
    const manager = fakeManager(async (sql: string) => {
      expect(sql).toContain('credit_note_sequence_value');
      expect(sql).toContain('credit_note_sequence_fy');
      return [[{ credit_note_sequence_value: 3 }], 1];
    });
    const service = makeService();

    const result = await service.nextDocumentNumber(manager, 'biz-1', 'credit_note');

    expect(result).toMatch(/^CN\/\d{4}-\d{2}\/00003$/);
  });

  it('pads the sequence to 5 digits', async () => {
    const manager = fakeManager(async () => [[{ invoice_sequence_value: 42 }], 1]);
    const service = makeService();

    const result = await service.nextDocumentNumber(manager, 'biz-1', 'invoice');

    expect(result.endsWith('/00042')).toBe(true);
  });

  it('throws instead of minting "undefined" when the rows array is empty (regression guard for the original bug)', async () => {
    // The exact failure mode that shipped: result[0] was the rows array
    // rather than the first row, so reading a column name off it silently
    // produced `undefined` instead of throwing. Any shape that can't yield a
    // real positive-integer sequence must now fail loudly instead.
    const manager = fakeManager(async () => [[], 0]);
    const service = makeService();

    await expect(service.nextDocumentNumber(manager, 'biz-1', 'invoice')).rejects.toThrow(/positive integer/);
  });

  it('throws if the sequence column comes back as something other than a number', async () => {
    const manager = fakeManager(async () => [[{ invoice_sequence_value: 'undefined' }], 1]);
    const service = makeService();

    await expect(service.nextDocumentNumber(manager, 'biz-1', 'invoice')).rejects.toThrow(/positive integer/);
  });

  it('throws on a zero or negative sequence value', async () => {
    const manager = fakeManager(async () => [[{ invoice_sequence_value: 0 }], 1]);
    const service = makeService();

    await expect(service.nextDocumentNumber(manager, 'biz-1', 'invoice')).rejects.toThrow(/positive integer/);
  });
});
