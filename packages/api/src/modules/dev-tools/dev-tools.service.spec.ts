import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DevToolsService } from './dev-tools.service';
import { CustomersService } from '../customers/customers.service';
import { ProductsService } from '../products/products.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { OrdersService } from '../orders/orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { SalesmanService } from '../salesman/salesman.service';
import { InvoicesService } from '../billing/invoices.service';
import { PaymentsService } from '../billing/payments.service';

describe('DevToolsService', () => {
  let service: DevToolsService;
  let customersService: Record<string, jest.Mock>;
  let productsService: Record<string, jest.Mock>;
  let suppliersService: Record<string, jest.Mock>;
  let ordersService: Record<string, jest.Mock>;
  let inventoryService: Record<string, jest.Mock>;
  let restaurantService: Record<string, jest.Mock>;
  let salesmanService: Record<string, jest.Mock>;
  let invoicesService: Record<string, jest.Mock>;
  let paymentsService: Record<string, jest.Mock>;
  let dataSource: { getRepository: jest.Mock; transaction: jest.Mock };
  let repos: Record<string, any>;

  const makeRepo = (overrides: Record<string, any> = {}) => ({
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((data: any) => data),
    save: jest.fn(async (data: any) => data),
    ...overrides,
  });

  const productSpec = (name: string, overrides: any = {}) => ({
    id: `${name}-id`,
    name,
    selling_price: 100,
    purchase_price: 60,
    unit: 'pcs',
    stock_quantity: 20,
    ...overrides,
  });

  beforeEach(async () => {
    customersService = { create: jest.fn((dto: any) => ({ id: 'cust-new', ...dto })) };
    productsService = { create: jest.fn((dto: any) => productSpec(dto.name, dto)) };
    suppliersService = { create: jest.fn((dto: any) => ({ id: 'sup-new', ...dto })) };
    ordersService = {
      create: jest.fn(() => ({ id: 'order-new', total_amount: 500 })),
      updateStatus: jest.fn(),
    };
    inventoryService = { createPurchaseOrder: jest.fn(() => ({ id: 'po-new' })), receivePurchaseOrder: jest.fn() };
    restaurantService = {
      findAllTables: jest.fn().mockResolvedValue([]),
      createTable: jest.fn((dto: any) => ({ id: `table-${dto.name}`, name: dto.name })),
      createKot: jest.fn(() => ({ id: 'kot-new' })),
      updateKotStatus: jest.fn(),
    };
    salesmanService = { create: jest.fn((dto: any) => ({ id: 'sm-new', name: dto.name })), checkIn: jest.fn(() => ({ id: 'visit-new' })), checkOut: jest.fn() };
    invoicesService = { generateFromOrder: jest.fn() };
    paymentsService = { create: jest.fn() };

    repos = {
      Business: makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'biz-1', category: 'others', inventory_enabled: true }) }),
      Customer: makeRepo(),
      Product: makeRepo(),
      Salesman: makeRepo(),
      Supplier: makeRepo(),
      Notification: makeRepo(),
    };

    dataSource = {
      getRepository: jest.fn((Entity: any) => repos[Entity.name] ?? makeRepo()),
      transaction: jest.fn(async (cb) => cb({
        find: jest.fn().mockResolvedValue([]),
        delete: jest.fn(),
        update: jest.fn(),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevToolsService,
        { provide: CustomersService, useValue: customersService },
        { provide: ProductsService, useValue: productsService },
        { provide: SuppliersService, useValue: suppliersService },
        { provide: OrdersService, useValue: ordersService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: RestaurantService, useValue: restaurantService },
        { provide: SalesmanService, useValue: salesmanService },
        { provide: InvoicesService, useValue: invoicesService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(DevToolsService);
  });

  describe('seedAll', () => {
    it('throws NotFoundException when the business does not exist', async () => {
      repos.Business.findOne.mockResolvedValue(null);

      await expect(service.seedAll('missing')).rejects.toThrow(NotFoundException);
    });

    it('seeds a fresh "others"-category business with a regular order flow, invoice, and payment', async () => {
      const result = await service.seedAll('biz-1');

      expect(productsService.create).toHaveBeenCalled();
      expect(customersService.create).toHaveBeenCalled();
      expect(ordersService.create).toHaveBeenCalled();
      expect(invoicesService.generateFromOrder).toHaveBeenCalled();
      expect(paymentsService.create).toHaveBeenCalled();
      expect(result.category).toBe('others');
      expect(result.message).toMatch(/^Demo data seeded/);
      expect(result.products).toBeGreaterThan(0);
    });

    it('reuses existing products/customers instead of recreating them', async () => {
      repos.Product.find.mockResolvedValue([productSpec('Tata Salt')]);
      repos.Customer.find.mockResolvedValue([{ id: 'existing-cust', phone: '9820000001', name: 'Ramesh Kirana Store' }]);

      await service.seedAll('biz-1');

      expect(productsService.create).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'Tata Salt' }));
    });

    it('skips creating demo orders/invoices/notifications when already seeded, but still tops up the catalog', async () => {
      repos.Customer.count.mockResolvedValue(1);

      const result = await service.seedAll('biz-1');

      expect(ordersService.create).not.toHaveBeenCalled();
      expect(invoicesService.generateFromOrder).not.toHaveBeenCalled();
      expect(result.message).toMatch(/topped up/);
      expect(result.orders).toBe(0);
    });

    it('seeds a restaurant business with tables and dine-in KOT orders', async () => {
      repos.Business.findOne.mockResolvedValue({ id: 'biz-1', category: 'restaurant', inventory_enabled: false });

      const result = await service.seedAll('biz-1');

      expect(restaurantService.createTable).toHaveBeenCalled();
      expect(restaurantService.createKot).toHaveBeenCalled();
      expect(restaurantService.updateKotStatus).toHaveBeenCalledWith('kot-new', 'biz-1', { status: 'preparing' });
      expect(result.tables).toBe(3);
    });

    it('reuses existing tables instead of recreating them for a restaurant business', async () => {
      repos.Business.findOne.mockResolvedValue({ id: 'biz-1', category: 'restaurant', inventory_enabled: false });
      restaurantService.findAllTables.mockResolvedValue([{ id: 'existing-t1', name: 'T1' }]);

      await service.seedAll('biz-1');

      expect(restaurantService.createTable).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'T1' }));
    });

    it('seeds salesmen and a check-in visit for a salesman-enabled category', async () => {
      repos.Business.findOne.mockResolvedValue({ id: 'biz-1', category: 'salesman', inventory_enabled: false });

      const result = await service.seedAll('biz-1');

      expect(salesmanService.create).toHaveBeenCalledTimes(2);
      expect(salesmanService.checkIn).toHaveBeenCalled();
      expect(salesmanService.checkOut).toHaveBeenCalled();
      expect(result.salesmen).toBe(2);
    });

    it('seeds suppliers and receives a purchase order when inventory is enabled', async () => {
      const result = await service.seedAll('biz-1');

      expect(suppliersService.create).toHaveBeenCalled();
      expect(inventoryService.createPurchaseOrder).toHaveBeenCalled();
      expect(inventoryService.receivePurchaseOrder).toHaveBeenCalledWith('po-new', 'biz-1');
      expect(result.purchaseOrders).toBe(2);
    });

    it('respects the business explicit inventory_enabled=false override even for an inventory-eligible category', async () => {
      repos.Business.findOne.mockResolvedValue({ id: 'biz-1', category: 'others', inventory_enabled: false });

      const result = await service.seedAll('biz-1');

      expect(suppliersService.create).not.toHaveBeenCalled();
      expect(result.purchaseOrders).toBe(0);
    });
  });

  describe('clearModule', () => {
    it('throws BadRequestException for an unknown module', async () => {
      await expect(service.clearModule('bogus', 'biz-1')).rejects.toThrow(BadRequestException);
    });

    it.each(['orders', 'products', 'customers', 'inventory', 'billing', 'restaurant', 'salesman'])(
      'clears the "%s" module within a transaction',
      async (moduleName) => {
        const result = await service.clearModule(moduleName, 'biz-1');

        expect(dataSource.transaction).toHaveBeenCalled();
        expect(result).toEqual({ message: `Cleared all ${moduleName} data` });
      },
    );
  });

  describe('clearAll', () => {
    it('throws NotFoundException when the business does not exist', async () => {
      repos.Business.findOne.mockResolvedValue(null);

      await expect(service.clearAll('missing')).rejects.toThrow(NotFoundException);
    });

    it('clears every module and returns a summary message', async () => {
      const result = await service.clearAll('biz-1');

      // orders, billing, restaurant, salesman, customers, products, inventory
      expect(dataSource.transaction).toHaveBeenCalledTimes(7);
      expect(result).toEqual({ message: 'All data cleared for this business' });
    });
  });
});
