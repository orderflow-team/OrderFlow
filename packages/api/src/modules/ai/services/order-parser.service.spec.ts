import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrderParserService } from './order-parser.service';
import { OrdersService } from '../../orders/orders.service';
import { ProductsService } from '../../products/products.service';
import { RestaurantService } from '../../restaurant/restaurant.service';
import { CustomersService } from '../../customers/customers.service';
import { GeminiKeyPoolService } from '../../../common/services/gemini-key-pool.service';

describe('OrderParserService', () => {
  let service: OrderParserService;
  let geminiKeyPool: { isConfigured: boolean; generateContent: jest.Mock };
  let ordersService: Record<string, jest.Mock>;
  let productsService: { findAll: jest.Mock };
  let restaurantService: { findAllTables: jest.Mock };
  let customersService: { findAll: jest.Mock };

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderParserService,
        { provide: GeminiKeyPoolService, useValue: geminiKeyPool },
        { provide: OrdersService, useValue: ordersService },
        { provide: ProductsService, useValue: productsService },
        { provide: RestaurantService, useValue: restaurantService },
        { provide: CustomersService, useValue: customersService },
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
      expect(result.reply).toMatch(/tell me what you'd like to order/i);
      expect(ordersService.create).not.toHaveBeenCalled();
    });

    it('replies to a help request locally', async () => {
      const result = await service.parseChatOrder('biz-1', 'help');

      expect(result.reply).toMatch(/i can place an order/i);
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

    it('throws BadRequestException when deterministic parsing is ambiguous and Gemini is not configured', async () => {
      productsService.findAll.mockResolvedValue(ambiguousCatalog());
      geminiKeyPool.isConfigured = false;

      await expect(service.parseChatOrder('biz-1', '2 widget')).rejects.toThrow(BadRequestException);
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

    it('throws BadRequestException when the Gemini response has no parsable JSON', async () => {
      productsService.findAll.mockResolvedValue(ambiguousCatalog());
      geminiKeyPool.isConfigured = true;
      geminiKeyPool.generateContent.mockResolvedValue('sorry I cannot help');

      await expect(service.parseChatOrder('biz-1', '2 widget')).rejects.toThrow(BadRequestException);
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
