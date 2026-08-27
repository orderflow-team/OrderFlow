import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment } from '../../database/entities/payment.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Order } from '../../database/entities/order.entity';
import { Table } from '../../database/entities/table.entity';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentsRepo: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock };

  const buildQb = (raw: any = { total: '0' }) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(raw),
    getMany: jest.fn().mockResolvedValue([]),
  });

  const buildManager = (entityData: Record<string, any> = {}, qbRaw: any = { total: '0' }) => ({
    findOne: jest.fn((Entity: any) => Promise.resolve(entityData[Entity.name] ?? null)),
    find: jest.fn((Entity: any) => Promise.resolve(entityData[`${Entity.name}List`] ?? [])),
    count: jest.fn((Entity: any) => Promise.resolve(entityData[`${Entity.name}Count`] ?? 0)),
    create: jest.fn((Entity: any, data: any) => ({ id: `${Entity.name}-new-id`, ...data })),
    save: jest.fn(async (a: any, b?: any) => (b !== undefined ? b : a)),
    increment: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => buildQb(qbRaw)),
  });

  beforeEach(async () => {
    paymentsRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    dataSource = { transaction: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe('create', () => {
    it('returns the existing payment when clientRequestId matches a prior submission', async () => {
      paymentsRepo.findOne.mockResolvedValue({ id: 'pay-1' });

      const result = await service.create({ businessId: 'biz-1', clientRequestId: 'req-1', amount: 10, paymentMethod: 'Cash' } as any);

      expect(result).toEqual({ id: 'pay-1' });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when orderId is given but the order does not exist', async () => {
      const manager = buildManager({ Order: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.create({ businessId: 'biz-1', orderId: 'missing', amount: 10, paymentMethod: 'Cash' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('records a pure customer-level payment (no order) and decrements outstanding', async () => {
      const manager = buildManager({ Customer: { id: 'cust-1', outstanding_amount: 100 } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.create({ businessId: 'biz-1', customerId: 'cust-1', amount: 40, paymentMethod: 'Cash' } as any);

      expect(manager.increment).toHaveBeenCalledWith(Customer, { id: 'cust-1' }, 'outstanding_amount', -40);
    });

    it('rejects a customer-level payment exceeding the outstanding balance', async () => {
      const manager = buildManager({ Customer: { id: 'cust-1', outstanding_amount: 10 } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.create({ businessId: 'biz-1', customerId: 'cust-1', amount: 50, paymentMethod: 'Cash' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not touch outstanding_amount for a customer-level "Credit" payment', async () => {
      const manager = buildManager({ Customer: { id: 'cust-1', outstanding_amount: 10 } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.create({ businessId: 'biz-1', customerId: 'cust-1', amount: 500, paymentMethod: 'Credit' } as any);

      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a customer-level payment references a missing customer', async () => {
      const manager = buildManager({ Customer: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.create({ businessId: 'biz-1', customerId: 'missing', amount: 10, paymentMethod: 'Cash' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('applies a payment to an order and marks it paid once fully covered', async () => {
      const manager = buildManager(
        { Order: { id: 'order-1', business_id: 'biz-1', status: 'confirmed', total_amount: 100, order_number: 'ORD-1' } },
        { total: '100' },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.create({ businessId: 'biz-1', orderId: 'order-1', amount: 100, paymentMethod: 'Cash' } as any);

      expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid' }));
    });

    it('releases the table when the fully-paid order has one assigned', async () => {
      const manager = buildManager(
        { Order: { id: 'order-1', business_id: 'biz-1', status: 'confirmed', total_amount: 100, order_number: 'ORD-1', table_id: 'table-1' } },
        { total: '100' },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.create({ businessId: 'biz-1', orderId: 'order-1', amount: 100, paymentMethod: 'Cash' } as any);

      expect(manager.update).toHaveBeenCalledWith(Table, { id: 'table-1' }, { status: 'available' });
    });

    it('caps the payment at the remaining balance and records the excess as advance credit', async () => {
      const manager = buildManager(
        {
          Order: { id: 'order-1', business_id: 'biz-1', status: 'confirmed', total_amount: 100, order_number: 'ORD-1' },
          Customer: { id: 'cust-1', business_id: 'biz-1' },
        },
        { total: '0' },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.create({
        businessId: 'biz-1',
        orderId: 'order-1',
        customerId: 'cust-1',
        amount: 150,
        paymentMethod: 'Cash',
      } as any);

      expect(manager.increment).toHaveBeenCalledWith(Customer, { id: 'cust-1' }, 'advance_balance', 50);
    });

    it('bills a not-yet-billed order (e.g. a draft closed directly) before applying the payment', async () => {
      const manager = buildManager(
        {
          Order: { id: 'order-1', business_id: 'biz-1', status: 'draft', total_amount: 100, order_number: 'ORD-1' },
          Customer: { id: 'cust-1', business_id: 'biz-1' },
        },
        { total: '100' },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.create({
        businessId: 'biz-1',
        orderId: 'order-1',
        customerId: 'cust-1',
        amount: 100,
        paymentMethod: 'Cash',
      } as any);

      expect(manager.increment).toHaveBeenCalledWith(Customer, { id: 'cust-1' }, 'outstanding_amount', 100);
    });
  });

  describe('payAllOutstanding', () => {
    it('returns the existing result when clientRequestId matches a prior submission', async () => {
      paymentsRepo.findOne.mockResolvedValue({ id: 'pay-1' });

      const result = await service.payAllOutstanding({ businessId: 'biz-1', customerId: 'cust-1', clientRequestId: 'req-1', amount: 10, paymentMethod: 'Cash' } as any);

      expect(result).toEqual({ payments: [{ id: 'pay-1' }], advanceApplied: 0 });
    });

    it('throws NotFoundException when the customer does not exist', async () => {
      const manager = buildManager({ Customer: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.payAllOutstanding({ businessId: 'biz-1', customerId: 'missing', amount: 10, paymentMethod: 'Cash' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('allocates the payment across outstanding orders oldest-first, skipping cancelled/returned', async () => {
      const manager = buildManager(
        {
          Customer: { id: 'cust-1' },
          OrderList: [
            { id: 'order-1', business_id: 'biz-1', status: 'cancelled', total_amount: 999, order_number: 'ORD-1' },
            { id: 'order-2', business_id: 'biz-1', status: 'confirmed', total_amount: 60, order_number: 'ORD-2' },
          ],
        },
        { total: '0' },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.payAllOutstanding({ businessId: 'biz-1', customerId: 'cust-1', amount: 60, paymentMethod: 'Cash' } as any);

      expect(result.payments).toHaveLength(1);
      expect(result.advanceApplied).toBe(0);
    });

    it('records leftover as advance credit once every order is covered', async () => {
      const manager = buildManager(
        {
          Customer: { id: 'cust-1' },
          OrderList: [{ id: 'order-1', business_id: 'biz-1', status: 'confirmed', total_amount: 60, order_number: 'ORD-1' }],
        },
        { total: '0' },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.payAllOutstanding({ businessId: 'biz-1', customerId: 'cust-1', amount: 100, paymentMethod: 'Cash' } as any);

      expect(result.advanceApplied).toBe(40);
    });

    it('throws BadRequestException when there is nothing outstanding to pay', async () => {
      const manager = buildManager({ Customer: { id: 'cust-1' }, OrderList: [] });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.payAllOutstanding({ businessId: 'biz-1', customerId: 'cust-1', amount: 50, paymentMethod: 'Credit' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('undo', () => {
    it('throws NotFoundException when the payment does not exist', async () => {
      const manager = buildManager({ Payment: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.undo('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for a payment not tied to an order', async () => {
      const manager = buildManager({ Payment: { id: 'pay-1', order_id: null, amount: 50 } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.undo('pay-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });

    it('reverses a Cash payment, restoring outstanding_amount', async () => {
      const manager = buildManager(
        {
          Payment: { id: 'pay-1', order_id: 'order-1', amount: 40, payment_method: 'Cash' },
          Order: { id: 'order-1', business_id: 'biz-1', customer_id: 'cust-1', status: 'confirmed', total_amount: 100, order_number: 'ORD-1' },
        },
        { total: '0' },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.undo('pay-1', 'biz-1');

      expect(manager.increment).toHaveBeenCalledWith(Customer, { id: 'cust-1' }, 'outstanding_amount', 40);
      expect(manager.remove).toHaveBeenCalled();
      expect(result).toEqual({ undone: true, orderId: 'order-1', orderStatus: 'confirmed' });
    });

    it('reverses an Advance Credit payment, restoring both advance_balance and outstanding_amount', async () => {
      const manager = buildManager(
        {
          Payment: { id: 'pay-1', order_id: 'order-1', amount: 30, payment_method: 'Advance Credit' },
          Order: { id: 'order-1', business_id: 'biz-1', customer_id: 'cust-1', status: 'confirmed', total_amount: 100, order_number: 'ORD-1' },
        },
        { total: '0' },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.undo('pay-1', 'biz-1');

      expect(manager.increment).toHaveBeenCalledWith(Customer, { id: 'cust-1' }, 'advance_balance', 30);
      expect(manager.increment).toHaveBeenCalledWith(Customer, { id: 'cust-1' }, 'outstanding_amount', 30);
    });

    it('does not touch balances for undoing a "Credit" (label-only) payment', async () => {
      const manager = buildManager(
        {
          Payment: { id: 'pay-1', order_id: 'order-1', amount: 30, payment_method: 'Credit' },
          Order: { id: 'order-1', business_id: 'biz-1', customer_id: 'cust-1', status: 'confirmed', total_amount: 100, order_number: 'ORD-1' },
        },
        { total: '0' },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.undo('pay-1', 'biz-1');

      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('reverts a paid order back to confirmed once undoing drops it below fully-paid', async () => {
      const manager = buildManager(
        {
          Payment: { id: 'pay-1', order_id: 'order-1', amount: 40, payment_method: 'Cash' },
          Order: { id: 'order-1', business_id: 'biz-1', customer_id: 'cust-1', status: 'paid', total_amount: 100, order_number: 'ORD-1' },
        },
        { total: '0' },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.undo('pay-1', 'biz-1');

      expect(result.orderStatus).toBe('confirmed');
    });

    it('throws BadRequestException when the payment amount is zero or negative', async () => {
      const manager = buildManager({ Payment: { id: 'pay-1', order_id: 'order-1', amount: -10 } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.undo('pay-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('applyAdvanceToOutstanding', () => {
    it('throws NotFoundException when the customer does not exist', async () => {
      const manager = buildManager({ Customer: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.applyAdvanceToOutstanding({ businessId: 'biz-1', customerId: 'missing' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the customer has no advance credit', async () => {
      const manager = buildManager({ Customer: { id: 'cust-1', advance_balance: 0 } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.applyAdvanceToOutstanding({ businessId: 'biz-1', customerId: 'cust-1' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('applies advance credit across outstanding orders and decrements the balance', async () => {
      const manager = buildManager(
        {
          Customer: { id: 'cust-1', advance_balance: 100 },
          OrderList: [{ id: 'order-1', business_id: 'biz-1', status: 'confirmed', total_amount: 40, order_number: 'ORD-1' }],
        },
        { total: '0' },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.applyAdvanceToOutstanding({ businessId: 'biz-1', customerId: 'cust-1' } as any);

      expect(result.applied).toBe(40);
      expect(manager.increment).toHaveBeenCalledWith(Customer, { id: 'cust-1' }, 'advance_balance', -40);
    });

    it('throws BadRequestException when there is nothing outstanding to apply credit to', async () => {
      const manager = buildManager({ Customer: { id: 'cust-1', advance_balance: 100 }, OrderList: [] });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.applyAdvanceToOutstanding({ businessId: 'biz-1', customerId: 'cust-1' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('filters by orderId when provided', () => {
      const qb = buildQb();
      paymentsRepo.createQueryBuilder.mockReturnValue(qb);

      service.findAll('biz-1', 'order-1');

      expect(qb.andWhere).toHaveBeenCalledWith('p.order_id = :orderId', { orderId: 'order-1' });
    });

    it('joins on order and filters by customerId when provided', () => {
      const qb = buildQb();
      paymentsRepo.createQueryBuilder.mockReturnValue(qb);

      service.findAll('biz-1', undefined, 'cust-1');

      expect(qb.innerJoin).toHaveBeenCalledWith('p.order', 'o');
      expect(qb.andWhere).toHaveBeenCalledWith('o.customer_id = :customerId', { customerId: 'cust-1' });
    });
  });
});
