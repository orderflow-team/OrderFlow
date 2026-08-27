import { EntityManager } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { Invoice } from '../../database/entities/invoice.entity';
import { InvoiceItem } from '../../database/entities/invoice-item.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Business } from '../../database/entities/business.entity';

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

describe('InvoicesService (full DI)', () => {
  let service: InvoicesService;
  let invoicesRepo: Record<string, jest.Mock>;
  let invoiceItemsRepo: Record<string, jest.Mock>;
  let ordersRepo: Record<string, jest.Mock>;
  let customersRepo: Record<string, jest.Mock>;
  let paymentsRepo: Record<string, jest.Mock>;
  let businessesRepo: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };

  const buildManager = (entityData: Record<string, any> = {}) => ({
    findOne: jest.fn((Entity: any) => Promise.resolve(entityData[Entity.name] ?? null)),
    find: jest.fn((Entity: any) => Promise.resolve(entityData[`${Entity.name}List`] ?? [])),
    create: jest.fn((Entity: any, data: any) => ({ id: `${Entity.name}-new-id`, ...data })),
    save: jest.fn(async (a: any, b?: any) => (b !== undefined ? b : a)),
    delete: jest.fn(),
    query: jest.fn().mockResolvedValue([[{ invoice_sequence_value: 1, credit_note_sequence_value: 1 }], 1]),
  });

  beforeEach(async () => {
    invoicesRepo = { find: jest.fn(), findOne: jest.fn() };
    invoiceItemsRepo = { find: jest.fn() };
    ordersRepo = { find: jest.fn(), findOne: jest.fn() };
    customersRepo = { findOne: jest.fn() };
    paymentsRepo = { createQueryBuilder: jest.fn() };
    businessesRepo = { findOne: jest.fn() };
    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: getRepositoryToken(Invoice), useValue: invoicesRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: invoiceItemsRepo },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: getRepositoryToken(OrderItem), useValue: {} },
        { provide: getRepositoryToken(Customer), useValue: customersRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: getRepositoryToken(Business), useValue: businessesRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(InvoicesService);
  });

  describe('getPreviousBalanceDue', () => {
    it('sums outstanding balances across the customer other non-cancelled/returned orders', async () => {
      ordersRepo.find.mockResolvedValue([
        { id: 'o1', status: 'confirmed', total_amount: 100 },
        { id: 'o2', status: 'cancelled', total_amount: 999 },
        { id: 'excluded', status: 'confirmed', total_amount: 500 },
      ]);
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ orderId: 'o1', total: '40' }]),
      };
      paymentsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getPreviousBalanceDue('biz-1', 'cust-1', 'excluded');

      expect(result).toBe(60);
    });

    it('returns 0 when there are no other relevant orders', async () => {
      ordersRepo.find.mockResolvedValue([{ id: 'excluded', status: 'confirmed', total_amount: 500 }]);

      const result = await service.getPreviousBalanceDue('biz-1', 'cust-1', 'excluded');

      expect(result).toBe(0);
      expect(paymentsRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('generateFromOrder', () => {
    it('snapshots the order into a new invoice with its items', async () => {
      const manager = buildManager({
        Order: { id: 'order-1', business_id: 'biz-1', total_amount: 100, tax_amount: 10 },
        Invoice: null,
        OrderItemList: [{ product_id: 'p1', quantity: 2, unit_price: 45, subtotal: 90, tax_percentage: 10, tax_amount: 10 }],
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.generateFromOrder('order-1', 'biz-1');

      expect(result.items).toHaveLength(1);
      expect(manager.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when the order does not exist', async () => {
      const manager = buildManager({ Order: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.generateFromOrder('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when an invoice already exists for the order', async () => {
      const manager = buildManager({ Order: { id: 'order-1' }, Invoice: { id: 'inv-1' } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.generateFromOrder('order-1', 'biz-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('syncFromOrder', () => {
    it('re-syncs totals and line items and clears the cached pdf_url', async () => {
      const manager: any = buildManager({
        Invoice: { id: 'inv-1', total_amount: 50, tax_amount: 5, pdf_url: 'https://cached.pdf' },
        Order: { id: 'order-1', total_amount: 80, tax_amount: 8 },
        OrderItemList: [{ product_id: 'p1', quantity: 1, unit_price: 80, subtotal: 80, tax_percentage: 10, tax_amount: 8 }],
      });

      await service.syncFromOrder('order-1', manager);

      expect(manager.delete).toHaveBeenCalledWith(InvoiceItem, { invoice_id: 'inv-1' });
      const savedInvoiceCall = manager.save.mock.calls.find((c: any[]) => c[0]?.id === 'inv-1');
      expect(savedInvoiceCall[0].pdf_url).toBeNull();
      expect(savedInvoiceCall[0].total_amount).toBe(80);
    });

    it('no-ops when the order has no invoice yet', async () => {
      const manager: any = buildManager({ Invoice: null });

      await service.syncFromOrder('order-1', manager);

      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('no-ops when the order itself cannot be found', async () => {
      const manager: any = buildManager({ Invoice: { id: 'inv-1' }, Order: null });

      await service.syncFromOrder('order-1', manager);

      expect(manager.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('filters by orderId and type when provided', () => {
      service.findAll('biz-1', 'order-1', 'credit_note');

      expect(invoicesRepo.find).toHaveBeenCalledWith({
        where: { business_id: 'biz-1', order_id: 'order-1', type: 'credit_note' },
        order: { created_at: 'DESC' },
      });
    });

    it('omits optional filters when not provided', () => {
      service.findAll('biz-1');

      expect(invoicesRepo.find).toHaveBeenCalledWith({
        where: { business_id: 'biz-1' },
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('enriches the invoice with order/customer/GST-split details', async () => {
      invoicesRepo.findOne.mockResolvedValue({
        id: 'inv-1',
        business_id: 'biz-1',
        order_id: 'order-1',
        tax_amount: 100,
        reference_invoice_id: null,
      });
      invoiceItemsRepo.find.mockResolvedValue([{ id: 'item-1' }]);
      ordersRepo.findOne.mockResolvedValue({ id: 'order-1', customer_id: 'cust-1', status: 'paid', customer_name: 'Neel' });
      ordersRepo.find.mockResolvedValue([]);
      customersRepo.findOne.mockResolvedValue({ id: 'cust-1', gst_number: '07AAAAA0000A1Z5' });
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', gst_number: '27AAAAA0000A1Z5' });

      const result = await service.findOne('inv-1', 'biz-1');

      expect(result.is_interstate).toBe(true);
      expect(result.igst_amount).toBe(100);
      expect(result.cgst_amount).toBe(0);
      expect(result.items).toEqual([{ id: 'item-1' }]);
    });

    it('throws NotFoundException when the invoice does not exist', async () => {
      invoicesRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('handles an invoice with no linked order gracefully', async () => {
      invoicesRepo.findOne.mockResolvedValue({ id: 'inv-1', business_id: 'biz-1', order_id: null, tax_amount: 20, reference_invoice_id: null });
      invoiceItemsRepo.find.mockResolvedValue([]);
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1' });

      const result = await service.findOne('inv-1', 'biz-1');

      expect(result.customer).toBeNull();
      expect(result.previous_balance_due).toBe(0);
    });
  });

  describe('generateCreditNoteForReturn', () => {
    it('returns null when there are no returned lines', async () => {
      const manager: any = buildManager();

      const result = await service.generateCreditNoteForReturn(manager, 'order-1', 'biz-1', []);

      expect(result).toBeNull();
    });

    it('returns null when the order was never invoiced', async () => {
      const manager: any = buildManager({ Invoice: null });

      const result = await service.generateCreditNoteForReturn(manager, 'order-1', 'biz-1', [
        { product_id: 'p1', custom_product_name: null, quantity: 1, unit_price: 10, subtotal: 10, tax_percentage: 0, tax_amount: 0 },
      ]);

      expect(result).toBeNull();
    });

    it('creates a credit note referencing the original invoice with summed totals', async () => {
      const manager: any = buildManager({ Invoice: { id: 'original-inv-1' } });

      const result = await service.generateCreditNoteForReturn(manager, 'order-1', 'biz-1', [
        { product_id: 'p1', custom_product_name: null, quantity: 1, unit_price: 10, subtotal: 10, tax_percentage: 5, tax_amount: 0.5 },
        { product_id: 'p2', custom_product_name: null, quantity: 2, unit_price: 5, subtotal: 10, tax_percentage: 5, tax_amount: 0.5 },
      ]);

      expect(result).toEqual(
        expect.objectContaining({ type: 'credit_note', reference_invoice_id: 'original-inv-1', total_amount: 21, tax_amount: 1 }),
      );
    });
  });
});
