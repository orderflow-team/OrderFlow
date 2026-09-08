import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrderParserService } from './order-parser.service';
import { OrdersService } from '../../orders/orders.service';
import { ProductsService } from '../../products/products.service';
import { RestaurantService } from '../../restaurant/restaurant.service';
import { CustomersService } from '../../customers/customers.service';
import { SuppliersService } from '../../suppliers/suppliers.service';
import { ReportsService } from '../../reports/reports.service';
import { GeminiKeyPoolService } from '../../../common/services/gemini-key-pool.service';

describe('OrderParserService', () => {
  let service: OrderParserService;
  let geminiKeyPool: { isConfigured: boolean; generateContent: jest.Mock };
  let ordersService: Record<string, jest.Mock>;
  let productsService: { findAll: jest.Mock };
  let restaurantService: { findAllTables: jest.Mock };
  let customersService: { findAll: jest.Mock };
  let suppliersService: { findAll: jest.Mock };
  let reportsService: Record<string, jest.Mock>;

  const widget = { id: 'p1', name: 'Widget', selling_price: 20, unit: 'piece', is_available: true, mrp: null, tax_percentage: 0 };

  beforeEach(async () => {
    geminiKeyPool = { isConfigured: false, generateContent: jest.fn() };
    ordersService = {
      findOne: jest.fn(),
      findActiveOrderByTable: jest.fn(),
      findActiveOrderByToken: jest.fn(),
      create: jest.fn(),
      replaceItems: jest.fn(),
      resolveOrCreateCustomerByContact: jest.fn(),
    };
    productsService = { findAll: jest.fn().mockResolvedValue([widget]) };
    restaurantService = { findAllTables: jest.fn().mockResolvedValue([]) };
    customersService = { findAll: jest.fn().mockResolvedValue([]) };
    suppliersService = { findAll: jest.fn().mockResolvedValue([]) };
    reportsService = {
      dashboard: jest.fn().mockResolvedValue({
        todaysSales: 15400,
        todaysOrders: 18,
        pendingOrders: 2,
        deliveredOrders: 16,
        pendingPaymentsAmount: 4700,
        topProducts: [{ productName: 'Widget', totalQuantity: 15, totalRevenue: 300 }],
        lowStockProducts: [{ name: 'Sugar', stock_quantity: 3, reorder_point: 10, unit: 'kg' }],
      }),
      analyticsDashboard: jest.fn().mockResolvedValue({
        chart: [{ date: '2026-09-01', sales: 450000, purchases: 310000 }],
        comparison: { salesGrowthPercent: 12.5 },
        fastMoving: [{ productId: 'p1', productName: 'Widget', totalQuantity: 150, totalRevenue: 3000 }],
        customers: { topCustomers: [{ customerId: 'c1', customerName: 'Neel Sharma', totalSpent: 45000, orderCount: 10 }] },
        products: {
          categoryBreakdown: [{ category: 'Groceries', totalRevenue: 300000, totalQuantity: 800 }],
          brandBreakdown: [{ brand: 'Nestle', totalRevenue: 150000, totalQuantity: 400 }],
          inventoryValuation: { totalPurchaseValue: 180000, totalRetailValue: 240000, totalStockUnits: 1500, trackedItemsCount: 45 },
          slowMoving: [{ id: 'p3', name: 'Old Brand Tea', stockQuantity: 20, tiedUpValue: 2000 }],
          expiryValueAtRisk: 5000,
          reorderSuggestions: [],
        },
        expiringSoon: [{ id: 'p4', name: 'Fresh Milk', batch_number: 'B01', expiry_date: '2026-09-15' }],
        suppliers: { topSuppliers: [{ supplierId: 's1', supplierName: 'Metro Cash & Carry', totalPurchased: 120000, orderCount: 5 }] },
        finance: {
          paymentMethodBreakdown: [{ method: 'cash', total: 200000, orderCount: 80 }, { method: 'upi', total: 250000, orderCount: 70 }],
          expenses: { total: 32000, byCategory: [{ category: 'Rent', total: 20000 }] },
          netProfit: 108000,
        },
        operations: {
          salesmanPerformance: [{ salesmanId: 'sm1', salesmanName: 'Rajesh Kumar', totalSales: 180000, orderCount: 45 }],
          orderStatusBreakdown: [{ status: 'delivered', orderCount: 130, totalAmount: 420000 }],
          cancellationRatePercent: 3.3,
          salesByDayOfWeek: [{ day: 'Monday', total: 60000, orderCount: 20 }],
        },
      }),
      profitReport: jest.fn().mockResolvedValue({
        revenue: 450000,
        cost: 310000,
        grossProfit: 140000,
        marginPercent: 31.11,
      }),
      gstSummaryReport: jest.fn().mockResolvedValue({
        businessGstNumber: '24AAAAA0000A1Z5',
        rateWise: [{ taxPercentage: 18, taxableValue: 300000, cgstAmount: 27000, sgstAmount: 27000, igstAmount: 0, totalTax: 54000, itemCount: 10 }],
        hsnWise: [{ hsnCode: '1006', quantity: 50, taxableValue: 50000, taxAmount: 2500 }],
        b2b: { invoiceCount: 1, totalValue: 180000 },
        b2c: { invoiceCount: 5, totalValue: 270000 },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderParserService,
        { provide: GeminiKeyPoolService, useValue: geminiKeyPool },
        { provide: OrdersService, useValue: ordersService },
        { provide: ProductsService, useValue: productsService },
        { provide: RestaurantService, useValue: restaurantService },
        { provide: CustomersService, useValue: customersService },
        { provide: SuppliersService, useValue: suppliersService },
        { provide: ReportsService, useValue: reportsService },
      ],
    }).compile();

    service = module.get(OrderParserService);
  });

  describe('parseChatOrder', () => {
    it('throws BadRequestException for an empty message', async () => {
      await expect(service.parseChatOrder('biz-1', '   ')).rejects.toThrow(BadRequestException);
    });

    it('returns a setup-needed reply when the business has no available products', async () => {
      productsService.findAll.mockResolvedValue([]);

      const result = await service.parseChatOrder('biz-1', '2 widget');

      expect(result.order).toBeNull();
      expect(result.reply).toMatch(/menu items/i);
    });

    it('replies to a greeting locally without touching the order machinery', async () => {
      const result = await service.parseChatOrder('biz-1', 'hi');

      expect(result.order).toBeNull();
      expect(result.reply).toMatch(/Obix/i);
      expect(ordersService.create).not.toHaveBeenCalled();
    });

    it('replies to a help request locally', async () => {
      const result = await service.parseChatOrder('biz-1', 'help');

      expect(result.reply).toMatch(/help you place\/edit orders/i);
    });

    it('lists the menu locally', async () => {
      const result = await service.parseChatOrder('biz-1', 'menu');

      expect(result.reply).toContain('Widget');
    });

    it('reports no active order for a table status query', async () => {
      restaurantService.findAllTables.mockResolvedValue([{ id: 'table-1', name: 'T1' }]);
      ordersService.findActiveOrderByTable.mockResolvedValue(null);

      const result = await service.parseChatOrder('biz-1', 'status of table 1');

      expect(result.reply).toMatch(/no active order/i);
    });

    it('asks who to check the balance for when neither name nor phone is given', async () => {
      const result = await service.parseChatOrder('biz-1', 'balance');

      expect(result.reply).toMatch(/whose balance/i);
    });

    it("reports a customer's balance when found", async () => {
      customersService.findAll.mockResolvedValue([{ id: 'c1', name: 'Neel', phone: '9876543210', outstanding_amount: 500, advance_balance: 0 }]);

      const result = await service.parseChatOrder('biz-1', 'balance for Neel');

      expect(result.reply).toContain('Neel');
      expect(result.reply).toMatch(/owes ₹500/);
    });

    it('deterministically matches a catalog item and places a takeaway order', async () => {
      ordersService.create.mockResolvedValue({ id: 'order-1', order_number: 'ORD-1', token_number: 5, customer_name: 'Chat Order' });

      const result = await service.parseChatOrder('biz-1', '2 widget');

      expect(ordersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz-1',
          orderType: 'take_away',
          items: [expect.objectContaining({ productId: 'p1', quantity: 2 })],
        }),
      );
      expect(result.reply).toMatch(/order placed/i);
      expect(result.order).toEqual(expect.objectContaining({ id: 'order-1' }));
    });

    it('parses conversational greetings and order prefixes locally without Gemini AI', async () => {
      ordersService.create.mockResolvedValue({ id: 'order-2', order_number: 'ORD-2', token_number: 6, customer_name: 'Chat Order' });

      const result = await service.parseChatOrder('biz-1', 'Hi Obix, I want to place an order: 3 Widget');

      expect(ordersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz-1',
          orderType: 'take_away',
          items: [expect.objectContaining({ productId: 'p1', quantity: 3 })],
        }),
      );
      expect(result.reply).toMatch(/order placed/i);
      expect(result.order).toEqual(expect.objectContaining({ id: 'order-2' }));
    });

    it('parses bracketed template instructions and hyphenated item-qty-unit formats', async () => {
      productsService.findAll.mockResolvedValue([
        { ...widget, id: 'p1', name: 'Basmati Rice', unit: 'kg' },
        { ...widget, id: 'p2', name: 'Sugar', unit: 'kg' },
      ]);
      ordersService.create.mockResolvedValue({ id: 'order-bracket-1', order_number: 'ORD-B1', token_number: 1, customer_name: 'Chat Order' });

      const templateMessage = `Hi Obix, I want to place an order:
[Write your order inside this bracket as below
Product-Qty-Unit with coma saperated 
Eg. Basmati Rice-5-Kg, Sugar-2-Kg]`;

      const result = await service.parseChatOrder('biz-1', templateMessage);

      expect(ordersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz-1',
          orderType: 'take_away',
          items: expect.arrayContaining([
            expect.objectContaining({ productId: 'p1', quantity: 5, unit: 'kg' }),
            expect.objectContaining({ productId: 'p2', quantity: 2, unit: 'kg' }),
          ]),
        }),
      );
      expect(result.reply).toMatch(/order placed/i);
      expect(result.reply).toContain('5 kg Basmati Rice');
      expect(result.reply).toContain('2 kg Sugar');
    });

    it('adds an item not on the menu as a new ₹0 draft product', async () => {
      ordersService.create.mockResolvedValue({ id: 'order-1', order_number: 'ORD-1', token_number: 6, customer_name: 'Chat Order' });

      const result = await service.parseChatOrder('biz-1', '3 gadgets');

      expect(ordersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [expect.objectContaining({ customProductName: 'gadgets', quantity: 3, unitPrice: 0 })],
        }),
      );
      expect(result.reply).toMatch(/set its price/i);
    });

    it('saves a bare customer contact when the message has no items at all', async () => {
      const result = await service.parseChatOrder('biz-1', 'order for Neel 9876543210');

      expect(ordersService.resolveOrCreateCustomerByContact).toHaveBeenCalledWith('biz-1', {
        customerName: 'Neel',
        phone: '9876543210',
      });
      expect(result.order).toBeNull();
      expect(result.pendingCustomer).toEqual({ customerName: 'Neel', phone: '9876543210' });
    });

    // "widget a"/"widget b" both prefix-match the normalized name "widget",
    // so matchCatalogProduct returns 'ambiguous' and tryDeterministicParse
    // bails out to Gemini — the deliberate way to reach the Gemini path here.
    const ambiguousCatalog = () => [
      { ...widget, id: 'p1', name: 'Widget A' },
      { ...widget, id: 'p2', name: 'Widget B' },
    ];

    it('uses local fallback parsing when deterministic parsing is ambiguous and Gemini is not configured', async () => {
      productsService.findAll.mockResolvedValue(ambiguousCatalog());
      geminiKeyPool.isConfigured = false;
      ordersService.create.mockResolvedValue({ id: 'order-fallback-1', order_number: 'ORD-FB1', token_number: 1, customer_name: 'Chat Order' });

      const res = await service.parseChatOrder('biz-1', '2 widget');
      expect(res.reply).toContain('Order placed');
    });

    it('falls through to Gemini for an ambiguous message and places the resulting order', async () => {
      productsService.findAll.mockResolvedValue(ambiguousCatalog());
      geminiKeyPool.isConfigured = true;
      geminiKeyPool.generateContent.mockResolvedValue(
        JSON.stringify({ matched: [{ menuName: 'Widget A', quantity: 4, unit: null }], unmatched: [], orderType: 'take_away', tableName: null }),
      );
      ordersService.create.mockResolvedValue({ id: 'order-2', order_number: 'ORD-2', token_number: 7, customer_name: 'Chat Order' });

      const result = await service.parseChatOrder('biz-1', '2 widget');

      expect(ordersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ items: [expect.objectContaining({ productId: 'p1', quantity: 4 })] }),
      );
      expect(result.order).toEqual(expect.objectContaining({ id: 'order-2' }));
    });

    it('falls back to local parsing when the Gemini response has no parsable JSON', async () => {
      productsService.findAll.mockResolvedValue(ambiguousCatalog());
      geminiKeyPool.isConfigured = true;
      geminiKeyPool.generateContent.mockResolvedValue('sorry I cannot help');
      ordersService.create.mockResolvedValue({ id: 'order-fallback-2', order_number: 'ORD-FB2', token_number: 2, customer_name: 'Chat Order' });

      const res = await service.parseChatOrder('biz-1', '2 widget');
      expect(res.reply).toContain('Order placed');
    });

    it('reports an unknown table for a dine-in request', async () => {
      restaurantService.findAllTables.mockResolvedValue([{ id: 'table-1', name: 'T1' }]);
      geminiKeyPool.isConfigured = true;
      geminiKeyPool.generateContent.mockResolvedValue(
        JSON.stringify({ matched: [], unmatched: [{ name: 'widget', quantity: 2, unit: null, price: null }], orderType: 'dine_in', tableName: 'Table 99' }),
      );

      const result = await service.parseChatOrder('biz-1', 'for table 99, 2 widget');

      expect(result.order).toBeNull();
      expect(result.reply).toMatch(/couldn't find table/i);
    });

    it('places a dine-in order against a matched table', async () => {
      restaurantService.findAllTables.mockResolvedValue([{ id: 'table-1', name: 'T1' }]);
      ordersService.create.mockResolvedValue({ id: 'order-3', order_number: 'ORD-3', token_number: null, customer_name: 'Table T1' });

      const result = await service.parseChatOrder('biz-1', 'for table 1, 2 widget');

      expect(ordersService.create).toHaveBeenCalledWith(expect.objectContaining({ orderType: 'dine_in', tableId: 'table-1' }));
      expect(result.reply).toMatch(/for Table T1/);
    });
  });

  describe('parseChatOrder (editing an existing order)', () => {
    const existingOrder = {
      id: 'order-1',
      order_number: 'ORD-1',
      customer_name: 'Chat Order',
      items: [{ id: 'item-1', quantity: 1, unit_price: 20, product: widget, custom_product_name: null }],
    };

    it('adds an item to an existing order via replaceItems', async () => {
      ordersService.findOne.mockResolvedValue(existingOrder);
      ordersService.replaceItems.mockResolvedValue({ id: 'order-1', order_number: 'ORD-1', customer_name: 'Chat Order' });

      const result = await service.parseChatOrder('biz-1', 'add 1 widget', 'order-1');

      expect(ordersService.replaceItems).toHaveBeenCalledWith(
        'order-1',
        'biz-1',
        expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({ productId: 'p1' })]) }),
      );
      expect(result.reply).toMatch(/updated/i);
    });

    it('clears the whole order when a clear intent is detected', async () => {
      ordersService.findOne.mockResolvedValue(existingOrder);
      ordersService.replaceItems.mockResolvedValue({ id: 'order-1', order_number: 'ORD-1', customer_name: 'Chat Order' });

      await service.parseChatOrder('biz-1', 'clear order', 'order-1');

      expect(ordersService.replaceItems).toHaveBeenCalledWith('order-1', 'biz-1', expect.objectContaining({ items: [] }));
    });

    it('leaves the order unchanged when nothing understandable was said', async () => {
      ordersService.findOne.mockResolvedValue(existingOrder);
      // The word "customer" with no recognizable change-customer shape is
      // deliberately ambiguous in tryDeterministicEditParse, forcing the
      // Gemini fallback below.
      geminiKeyPool.isConfigured = true;
      geminiKeyPool.generateContent.mockResolvedValue(
        JSON.stringify({ matched: [], unmatched: [], customerName: null, phone: null }),
      );

      const result = await service.parseChatOrder('biz-1', 'what about the customer', 'order-1');

      expect(ordersService.replaceItems).not.toHaveBeenCalled();
      expect(result.reply).toMatch(/couldn't understand/i);
      expect(result.order).toBe(existingOrder);
    });
  });

  describe('parseVoiceTranscript', () => {
    it('throws BadRequestException for an empty transcript', async () => {
      await expect(service.parseVoiceTranscript('  ', 'biz-1', 'cust-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when Gemini is not configured', async () => {
      geminiKeyPool.isConfigured = false;

      await expect(service.parseVoiceTranscript('2kg rice for Neel', 'biz-1', 'cust-1')).rejects.toThrow(BadRequestException);
    });

    it('returns a draft order parsed from the transcript', async () => {
      geminiKeyPool.isConfigured = true;
      geminiKeyPool.generateContent.mockResolvedValue(
        JSON.stringify({ customer_name: 'Neel', items: [{ name: 'Rice', quantity: 2, unit: 'kg' }] }),
      );

      const result = await service.parseVoiceTranscript('2kg rice for Neel', 'biz-1', 'cust-1');

      expect(result).toEqual({
        customerName: 'Neel',
        customerId: 'cust-1',
        items: [{ name: 'Rice', quantity: 2, unit: 'kg' }],
        status: 'draft',
        totalAmount: 0,
      });
    });

    it('defaults customerName to "Unknown Customer" when Gemini omits it', async () => {
      geminiKeyPool.isConfigured = true;
      geminiKeyPool.generateContent.mockResolvedValue(JSON.stringify({ items: [] }));

      const result = await service.parseVoiceTranscript('rice', 'biz-1', 'cust-1');

      expect(result.customerName).toBe('Unknown Customer');
    });

    it('throws BadRequestException when the Gemini call fails', async () => {
      geminiKeyPool.isConfigured = true;
      geminiKeyPool.generateContent.mockRejectedValue(new Error('quota exceeded'));

      await expect(service.parseVoiceTranscript('rice', 'biz-1', 'cust-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the response has no parsable JSON', async () => {
      geminiKeyPool.isConfigured = true;
      geminiKeyPool.generateContent.mockResolvedValue('not json at all');

      await expect(service.parseVoiceTranscript('rice', 'biz-1', 'cust-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('Report & Business intelligence queries', () => {
    it('returns remaining payment / dues of all suppliers', async () => {
      suppliersService.findAll.mockResolvedValue([
        { id: 's1', name: 'Metro Cash & Carry', outstanding_amount: 14500, phone: '9876543210' },
        { id: 's2', name: 'Fresh Farms Ltd', outstanding_amount: 6200, phone: '9876543211' },
      ]);

      const res = await service.parseChatOrder('biz-1', 'remaining payment of supplier');
      expect(res.order).toBeNull();
      expect(res.reply).toContain('Supplier Outstanding Payables Report');
      expect(res.reply).toContain('Metro Cash & Carry');
      expect(res.reply).toContain('14500.00');
      expect(res.reply).toContain('Fresh Farms Ltd');
      expect(res.reply).toContain('6200.00');
      expect(res.reply).toContain('20700.00');
    });

    it('returns specific supplier balance when requested', async () => {
      suppliersService.findAll.mockResolvedValue([
        { id: 's1', name: 'Metro Cash & Carry', outstanding_amount: 14500, phone: '9876543210' },
      ]);

      const res = await service.parseChatOrder('biz-1', 'supplier Metro balance');
      expect(res.order).toBeNull();
      expect(res.reply).toContain('Metro Cash & Carry');
      expect(res.reply).toContain('14500.00');
    });

    it('returns customer outstanding dues report', async () => {
      customersService.findAll.mockResolvedValue([
        { id: 'c1', name: 'Ramesh Sharma', outstanding_amount: 3500, phone: '9812345678' },
        { id: 'c2', name: 'Pooja Verma', outstanding_amount: 1200, phone: '9812345679' },
      ]);

      const res = await service.parseChatOrder('biz-1', 'customer dues report');
      expect(res.order).toBeNull();
      expect(res.reply).toContain('Customer Outstanding Receivables Report');
      expect(res.reply).toContain('Ramesh Sharma');
      expect(res.reply).toContain('3500.00');
      expect(res.reply).toContain('4700.00');
    });

    it("returns today's sales report", async () => {
      const res = await service.parseChatOrder('biz-1', "today's sales");
      expect(res.order).toBeNull();
      expect(res.reply).toContain("Today's Sales Report");
      expect(res.reply).toContain('15400.00');
      expect(res.reply).toContain('18');
      expect(reportsService.dashboard).toHaveBeenCalled();
    });

    it('returns low stock / inventory alert report', async () => {
      const res = await service.parseChatOrder('biz-1', 'low stock report');
      expect(res.order).toBeNull();
      expect(res.reply).toContain('Low Stock Alert');
      expect(res.reply).toContain('Sugar');
      expect(reportsService.dashboard).toHaveBeenCalled();
    });

    it('returns financial summary / expense overview', async () => {
      const res = await service.parseChatOrder('biz-1', 'financial summary');
      expect(res.order).toBeNull();
      expect(res.reply).toContain('Expense & Financial Summary');
      expect(res.reply).toContain('32000.00');
      expect(res.reply).toContain('108000.00');
    });

    it('returns all reports catalog / menu', async () => {
      const res = await service.parseChatOrder('biz-1', 'all reports');
      expect(res.order).toBeNull();
      expect(res.reply).toContain('Available Obix Business & Financial Reports');
      expect(res.reply).toContain('Suppliers:');
      expect(res.reply).toContain('GST & Tax:');
      expect(res.reply).toContain('Inventory:');
    });

    it('returns profit and loss report', async () => {
      const res = await service.parseChatOrder('biz-1', 'profit report');
      expect(res.order).toBeNull();
      expect(res.reply).toContain('Profit & Loss / Margin Report');
      expect(res.reply).toContain('140000.00');
      expect(res.reply).toContain('31.1%');
      expect(reportsService.profitReport).toHaveBeenCalledWith('biz-1');
    });

    it('returns GST & Tax filing report', async () => {
      const res = await service.parseChatOrder('biz-1', 'gst report');
      expect(res.order).toBeNull();
      expect(res.reply).toContain('GSTR-1 & Tax Summary Report');
      expect(res.reply).toContain('54000.00');
      expect(res.reply).toContain('27000.00');
      expect(reportsService.gstSummaryReport).toHaveBeenCalledWith('biz-1');
    });

    it('returns inventory & stock valuation report', async () => {
      const res = await service.parseChatOrder('biz-1', 'stock valuation report');
      expect(res.order).toBeNull();
      expect(res.reply).toContain('Inventory Valuation & Stock Summary');
      expect(res.reply).toContain('180000.00');
      expect(res.reply).toContain('240000.00');
      expect(reportsService.analyticsDashboard).toHaveBeenCalledWith('biz-1', 30);
    });

    it('returns top products report', async () => {
      const res = await service.parseChatOrder('biz-1', 'top selling products');
      expect(res.order).toBeNull();
      expect(res.reply).toContain('Top Selling Products');
      expect(res.reply).toContain('Widget');
      expect(reportsService.analyticsDashboard).toHaveBeenCalledWith('biz-1', 30);
    });

    it('returns payment mode breakdown report', async () => {
      const res = await service.parseChatOrder('biz-1', 'sales by payment mode');
      expect(res.order).toBeNull();
      expect(res.reply).toContain('Sales by Payment Method');
      expect(res.reply).toContain('CASH');
      expect(res.reply).toContain('200000.00');
      expect(reportsService.analyticsDashboard).toHaveBeenCalledWith('biz-1', 30);
    });

    it('returns category and brand breakdown report', async () => {
      const res = await service.parseChatOrder('biz-1', 'category sales report');
      expect(res.order).toBeNull();
      expect(res.reply).toContain('Sales by Category');
      expect(res.reply).toContain('Groceries');
    });

    it('returns salesman performance report', async () => {
      const res = await service.parseChatOrder('biz-1', 'salesman performance');
      expect(res.order).toBeNull();
      expect(res.reply).toContain('Salesman Field Performance');
      expect(res.reply).toContain('Rajesh Kumar');
    });
  });

  describe('private pure helpers', () => {
    it('levenshteinDistance computes edit distance correctly', () => {
      expect((service as any).levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect((service as any).levenshteinDistance('same', 'same')).toBe(0);
    });

    it('matchCatalogProduct finds an exact case-insensitive match', () => {
      expect((service as any).matchCatalogProduct('widget', [widget])).toBe('Widget');
    });

    it('matchCatalogProduct returns null when nothing matches', () => {
      expect((service as any).matchCatalogProduct('nonexistent thing', [widget])).toBeNull();
    });

    it('matchCatalogProduct returns "ambiguous" when multiple products share the same name prefix', () => {
      const a = { ...widget, id: 'p1', name: 'Widget A' };
      const b = { ...widget, id: 'p2', name: 'Widget B' };
      expect((service as any).matchCatalogProduct('widget', [a, b])).toBe('ambiguous');
    });

    it('isWholeOrderClearIntent recognizes common clear phrasings', () => {
      expect((service as any).isWholeOrderClearIntent('clear')).toBe(true);
      expect((service as any).isWholeOrderClearIntent('please clear the order')).toBe(true);
      expect((service as any).isWholeOrderClearIntent('remove all items')).toBe(true);
      expect((service as any).isWholeOrderClearIntent('cancel the order')).toBe(true);
      expect((service as any).isWholeOrderClearIntent('add 2 rice')).toBe(false);
    });
  });
});

