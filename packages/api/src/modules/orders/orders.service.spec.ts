import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Product } from '../../database/entities/product.entity';
import { PriceHistory } from '../../database/entities/price-history.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Ledger } from '../../database/entities/ledger.entity';
import { InvoicesService } from '../billing/invoices.service';

jest.mock('../billing/templates/invoice.template', () => ({ renderA4ReceiptHtml: jest.fn(() => '<html></html>') }), {
  virtual: true,
});
jest.mock('../../common/utils/image-data-uri.util', () => ({ loadImageDataUri: jest.fn(() => null) }), {
  virtual: true,
});

describe('OrdersService', () => {
  let service: OrdersService;
  let ordersRepo: Record<string, jest.Mock>;
  let orderItemsRepo: Record<string, jest.Mock>;
  let productsRepo: Record<string, jest.Mock>;
  let priceHistoryRepo: Record<string, jest.Mock>;
  let customersRepo: Record<string, jest.Mock>;
  let ledgerRepo: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };
  let invoicesService: Record<string, jest.Mock>;

  const buildQb = (overrides: Record<string, any> = {}) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue({}),
    getRawMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  });

  /** Generic fake EntityManager keyed by entity class name — mirrors the pattern used for InventoryService. */
  const buildManager = (entityData: Record<string, any> = {}, qbOverrides: Record<string, any> = {}) => {
    const manager: any = {
      findOne: jest.fn((Entity: any) => Promise.resolve(entityData[Entity.name] ?? null)),
      find: jest.fn((Entity: any) => Promise.resolve(entityData[`${Entity.name}List`] ?? [])),
      count: jest.fn((Entity: any) => Promise.resolve(entityData[`${Entity.name}Count`] ?? 0)),
      create: jest.fn((Entity: any, data: any) => ({ id: `${Entity.name}-new-id`, ...data })),
      save: jest.fn(async (a: any, b?: any) => (b !== undefined ? b : a)),
      update: jest.fn(),
      increment: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn((Entity?: any) => buildQb(qbOverrides[Entity?.name] ?? {})),
      getRepository: jest.fn((Entity: any) => ({
        createQueryBuilder: jest.fn(() => buildQb(qbOverrides[`${Entity.name}Repo`] ?? {})),
      })),
    };
    return manager;
  };

  beforeEach(async () => {
    ordersRepo = { findOne: jest.fn(), findAndCount: jest.fn() };
    orderItemsRepo = { find: jest.fn(), createQueryBuilder: jest.fn() };
    productsRepo = { findOne: jest.fn() };
    priceHistoryRepo = { findOne: jest.fn() };
    customersRepo = { findOne: jest.fn() };
    ledgerRepo = {};
    dataSource = { transaction: jest.fn(), getRepository: jest.fn(() => ({ findOne: jest.fn().mockResolvedValue(null), find: jest.fn().mockResolvedValue([]) })) };
    invoicesService = { generateCreditNoteForReturn: jest.fn(), syncFromOrder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemsRepo },
        { provide: getRepositoryToken(Product), useValue: productsRepo },
        { provide: getRepositoryToken(PriceHistory), useValue: priceHistoryRepo },
        { provide: getRepositoryToken(Customer), useValue: customersRepo },
        { provide: getRepositoryToken(Ledger), useValue: ledgerRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: InvoicesService, useValue: invoicesService },
      ],
    }).compile();

    service = module.get(OrdersService);
    jest.clearAllMocks();
  });

  describe('suggestPrice', () => {
    it('returns null when no customerId is given', async () => {
      expect(await service.suggestPrice('biz-1', undefined, { quantity: 1, productId: 'p1' } as any)).toBeNull();
    });

    it('returns null when the item has neither productId nor customProductName', async () => {
      expect(await service.suggestPrice('biz-1', 'cust-1', { quantity: 1 } as any)).toBeNull();
    });

    it('returns the last paid price for the product', async () => {
      priceHistoryRepo.findOne.mockResolvedValue({ price: '45.50' });

      const result = await service.suggestPrice('biz-1', 'cust-1', { quantity: 1, productId: 'p1' } as any);

      expect(result).toBe(45.5);
    });

    it('returns null when no price history exists', async () => {
      priceHistoryRepo.findOne.mockResolvedValue(null);

      expect(await service.suggestPrice('biz-1', 'cust-1', { quantity: 1, productId: 'p1' } as any)).toBeNull();
    });
  });

  describe('create', () => {
    it('returns the existing order when clientRequestId matches a prior submission (idempotency)', async () => {
      ordersRepo.findOne.mockResolvedValue({ id: 'order-1', client_request_id: 'req-1' });
      orderItemsRepo.find.mockResolvedValue([{ id: 'item-1' }]);

      const result = await service.create({ businessId: 'biz-1', clientRequestId: 'req-1', items: [] } as any);

      expect(result.id).toBe('order-1');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('creates a draft order with a custom free-text item, computing totals', async () => {
      ordersRepo.findOne.mockResolvedValue(null);
      const manager = buildManager({ Business: { inventory_enabled: true, allow_orders_beyond_stock: true } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const dto = {
        businessId: 'biz-1',
        customerName: 'Walk-in',
        items: [{ customProductName: 'Chai', quantity: 2, unitPrice: 15 }],
      };

      const result = await service.create(dto as any);

      expect(manager.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('rejects an item with neither productId nor customProductName', async () => {
      ordersRepo.findOne.mockResolvedValue(null);
      const manager = buildManager({ Business: { inventory_enabled: true, allow_orders_beyond_stock: true } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.create({ businessId: 'biz-1', customerName: 'X', items: [{ quantity: 1 }] } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('decrements stock for a catalog product on a regular (non dine-in/take-away) order', async () => {
      ordersRepo.findOne.mockResolvedValue(null);
      const manager = buildManager(
        {
          Business: { inventory_enabled: true, allow_orders_beyond_stock: true },
        },
        {
          Product: { getOne: jest.fn().mockResolvedValue({ id: 'p1', name: 'Widget', stock_quantity: 10, mrp: null, tax_percentage: 5, selling_price: 20 }) },
          ProductBatch: { getMany: jest.fn().mockResolvedValue([]) },
        },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const dto = {
        businessId: 'biz-1',
        customerName: 'Walk-in',
        items: [{ productId: 'p1', quantity: 3, unitPrice: 20 }],
      };

      await service.create(dto as any);

      expect(manager.update).toHaveBeenCalledWith(Product, { id: 'p1' }, expect.objectContaining({ stock_quantity: 7 }));
    });

    it('rejects when stock is insufficient and the business disallows orders beyond stock', async () => {
      ordersRepo.findOne.mockResolvedValue(null);
      const manager = buildManager(
        { Business: { inventory_enabled: true, allow_orders_beyond_stock: false } },
        { Product: { getOne: jest.fn().mockResolvedValue({ id: 'p1', name: 'Widget', stock_quantity: 1 }) } },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.create({
          businessId: 'biz-1',
          customerName: 'Walk-in',
          items: [{ productId: 'p1', quantity: 5, unitPrice: 20 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('skips stock decrement for dine_in orders even with a real productId', async () => {
      ordersRepo.findOne.mockResolvedValue(null);
      productsRepo.findOne.mockResolvedValue({ id: 'p1', mrp: null, tax_percentage: 5, selling_price: 20 });
      const manager = buildManager({ Business: { inventory_enabled: true, allow_orders_beyond_stock: true } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.create({
        businessId: 'biz-1',
        customerName: 'Table 5',
        orderType: 'dine_in',
        items: [{ productId: 'p1', quantity: 2, unitPrice: 20 }],
      } as any);

      expect(manager.update).not.toHaveBeenCalledWith(Product, expect.anything(), expect.objectContaining({ stock_quantity: expect.anything() }));
    });

    it('throws BadRequestException when no price can be resolved for an unlinked custom item without unitPrice', async () => {
      ordersRepo.findOne.mockResolvedValue(null);
      const manager = buildManager({ Business: { inventory_enabled: true, allow_orders_beyond_stock: true } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.create({
          businessId: 'biz-1',
          customerName: 'Walk-in',
          items: [{ customProductName: 'Mystery Item', quantity: 1 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveOrCreateCustomerByContact', () => {
    it('returns undefined when neither name nor phone is given', async () => {
      expect(await service.resolveOrCreateCustomerByContact('biz-1', {})).toBeUndefined();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('creates a customer by name when no match exists', async () => {
      const manager = buildManager({ Customer: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.resolveOrCreateCustomerByContact('biz-1', { customerName: 'Neel' });

      expect(manager.create).toHaveBeenCalledWith(Customer, expect.objectContaining({ name: 'Neel' }));
      expect(result).toBeDefined();
    });

    it('treats "guest" as a placeholder name and does not create a customer', async () => {
      const manager = buildManager();
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.resolveOrCreateCustomerByContact('biz-1', { customerName: 'Guest' });

      expect(manager.create).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('restores stock for each item and deletes the order and its dependents', async () => {
      const manager = buildManager({
        Order: { id: 'order-1', business_id: 'biz-1', status: 'draft', customer_id: null, items: [{ product_id: 'p1', quantity: 2 }] },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.remove('order-1', 'biz-1');

      expect(manager.increment).toHaveBeenCalledWith(Product, { id: 'p1' }, 'stock_quantity', 2);
      expect(manager.remove).toHaveBeenCalled();
      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException when the order does not exist', async () => {
      const manager = buildManager({ Order: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.remove('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('credits back outstanding_amount when deleting an already-billed order', async () => {
      const manager = buildManager({
        Order: { id: 'order-1', business_id: 'biz-1', status: 'confirmed', customer_id: 'cust-1', total_amount: 100, order_number: 'ORD-1', items: [] },
        PaymentList: [{ amount: 40 }],
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.remove('order-1', 'biz-1');

      expect(manager.increment).toHaveBeenCalledWith(Customer, { id: 'cust-1' }, 'outstanding_amount', -60);
    });
  });

  describe('findAll', () => {
    it('returns orders with their items attached and strips password_hash from created_by', async () => {
      ordersRepo.findAndCount.mockResolvedValue([
        [{ id: 'order-1', created_by: { id: 'u1', password_hash: 'secret', full_name: 'Admin' } }],
        1,
      ]);
      orderItemsRepo.find.mockResolvedValue([{ id: 'item-1', order_id: 'order-1' }]);

      const result = await service.findAll('biz-1');

      expect(result.total).toBe(1);
      expect((result.orders[0] as any).items).toEqual([{ id: 'item-1', order_id: 'order-1' }]);
      expect((result.orders[0] as any).created_by.password_hash).toBeUndefined();
    });

    it('returns an empty result without querying items when there are no orders', async () => {
      ordersRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll('biz-1');

      expect(result).toEqual({ orders: [], total: 0 });
      expect(orderItemsRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the order with its items', async () => {
      ordersRepo.findOne.mockResolvedValue({ id: 'order-1', business_id: 'biz-1' });
      orderItemsRepo.find.mockResolvedValue([{ id: 'item-1' }]);

      const result = await service.findOne('order-1', 'biz-1');

      expect(result.items).toEqual([{ id: 'item-1' }]);
    });

    it('throws NotFoundException when the order does not exist', async () => {
      ordersRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findActiveOrderByTable / findActiveOrderByToken', () => {
    it('returns null when no active order exists for the table', async () => {
      ordersRepo.findOne.mockResolvedValue(null);

      expect(await service.findActiveOrderByTable('table-1', 'biz-1')).toBeNull();
    });

    it('returns the active order with items for the table', async () => {
      ordersRepo.findOne.mockResolvedValue({ id: 'order-1' });
      orderItemsRepo.find.mockResolvedValue([{ id: 'item-1' }]);

      const result = await service.findActiveOrderByTable('table-1', 'biz-1');

      expect(result!.items).toEqual([{ id: 'item-1' }]);
    });

    it('returns null when no active order exists for the token', async () => {
      ordersRepo.findOne.mockResolvedValue(null);

      expect(await service.findActiveOrderByToken(5, 'biz-1')).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('rejects setting status to "returned" directly', async () => {
      await expect(service.updateStatus('order-1', 'biz-1', { status: 'returned' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when the order does not exist', async () => {
      const manager = buildManager({ Order: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.updateStatus('missing', 'biz-1', { status: 'confirmed' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debits the customer outstanding amount and posts a ledger entry when entering a billed status', async () => {
      const manager = buildManager({
        Order: { id: 'order-1', business_id: 'biz-1', status: 'draft', customer_id: 'cust-1', total_amount: 200, order_number: 'ORD-1' },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.updateStatus('order-1', 'biz-1', { status: 'confirmed' } as any);

      expect(manager.increment).toHaveBeenCalledWith(Customer, { id: 'cust-1' }, 'outstanding_amount', 200);
    });

    it('credits back outstanding amount when leaving a billed status (e.g. cancelled)', async () => {
      const manager = buildManager({
        Order: { id: 'order-1', business_id: 'biz-1', status: 'confirmed', customer_id: 'cust-1', total_amount: 200, order_number: 'ORD-1' },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.updateStatus('order-1', 'biz-1', { status: 'cancelled' } as any);

      expect(manager.increment).toHaveBeenCalledWith(Customer, { id: 'cust-1' }, 'outstanding_amount', -200);
    });

    it('releases the table when the order is marked paid', async () => {
      const manager = buildManager({
        Order: { id: 'order-1', business_id: 'biz-1', status: 'confirmed', customer_id: null, total_amount: 100, order_number: 'ORD-1', table_id: 'table-1' },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.updateStatus('order-1', 'biz-1', { status: 'paid' } as any);

      expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 'table-1' }, { status: 'available' });
    });
  });

  describe('returnOrder', () => {
    it('throws NotFoundException when the order does not exist', async () => {
      const manager = buildManager({ Order: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.returnOrder('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the order is already returned', async () => {
      const manager = buildManager({ Order: { id: 'order-1', business_id: 'biz-1', status: 'returned', items: [] } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.returnOrder('order-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the order is cancelled', async () => {
      const manager = buildManager({ Order: { id: 'order-1', business_id: 'biz-1', status: 'cancelled', items: [] } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.returnOrder('order-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when there is nothing left to return', async () => {
      const manager = buildManager({
        Order: { id: 'order-1', business_id: 'biz-1', status: 'draft', items: [{ id: 'item-1', quantity: 2, returned_quantity: 2 }] },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.returnOrder('order-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });

    it('fully returns the order, restores stock, and marks the order returned', async () => {
      const orderItem = { id: 'item-1', product_id: 'p1', quantity: 2, returned_quantity: 0, unit_price: 50, tax_amount: 5, tax_percentage: 5, subtotal: 100 };
      const manager = buildManager({
        Order: { id: 'order-1', business_id: 'biz-1', status: 'confirmed', customer_id: null, total_amount: 105, tax_amount: 5, order_number: 'ORD-1', table_id: null, items: [orderItem] },
        Business: { inventory_enabled: true },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));
      ordersRepo.findOne.mockResolvedValue({ id: 'order-1', business_id: 'biz-1', status: 'returned' });
      orderItemsRepo.find.mockResolvedValue([]);

      await service.returnOrder('order-1', 'biz-1');

      expect(manager.increment).toHaveBeenCalledWith(Product, { id: 'p1' }, 'stock_quantity', 2);
      expect(invoicesService.generateCreditNoteForReturn).toHaveBeenCalled();
    });

    it('partially returns only the requested items/quantities', async () => {
      const orderItem = { id: 'item-1', product_id: 'p1', quantity: 4, returned_quantity: 0, unit_price: 25, tax_amount: 0, tax_percentage: 0, subtotal: 100 };
      const manager = buildManager({
        Order: { id: 'order-1', business_id: 'biz-1', status: 'confirmed', customer_id: null, total_amount: 100, tax_amount: 0, order_number: 'ORD-1', table_id: null, items: [orderItem] },
        Business: { inventory_enabled: true },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));
      ordersRepo.findOne.mockResolvedValue({ id: 'order-1', business_id: 'biz-1', status: 'confirmed' });
      orderItemsRepo.find.mockResolvedValue([]);

      await service.returnOrder('order-1', 'biz-1', [{ id: 'item-1', quantity: 1 }]);

      expect(manager.increment).toHaveBeenCalledWith(Product, { id: 'p1' }, 'stock_quantity', 1);
      expect(manager.increment).toHaveBeenCalledWith(OrderItem, { id: 'item-1' }, 'returned_quantity', 1);
    });
  });

  describe('customerPrices', () => {
    it('returns the most recent price/unit per product', async () => {
      const qb = buildQb({
        getMany: jest.fn().mockResolvedValue([
          { product_id: 'p1', unit_price: '30', unit: 'kg' },
          { product_id: 'p1', unit_price: '25', unit: 'g' },
        ]),
      });
      orderItemsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.customerPrices('biz-1', 'cust-1');

      expect(result).toEqual({ p1: { price: 30, unit: 'kg' } });
    });
  });

  describe('getOrderReceiptHtml', () => {
    it('throws NotFoundException when the order does not exist', async () => {
      ordersRepo.findOne.mockResolvedValue(null);

      await expect(service.getOrderReceiptHtml('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('renders the receipt html for an existing order', async () => {
      ordersRepo.findOne.mockResolvedValue({ id: 'order-1', order_number: 'ORD-1', customer_id: null, created_at: new Date(), tax_amount: 5, total_amount: 105 });
      orderItemsRepo.find.mockResolvedValue([]);

      const result = await service.getOrderReceiptHtml('order-1', 'biz-1');

      expect(result).toBe('<html></html>');
    });
  });
});
