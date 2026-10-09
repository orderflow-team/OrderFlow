import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

const sendMock = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));
const getSignedUrlMock = jest.fn().mockResolvedValue('https://signed.example.com/x');
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: (...args: any[]) => getSignedUrlMock(...args) }));

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: jest.Mocked<OrdersService>;

  beforeEach(async () => {
    sendMock.mockClear();
    getSignedUrlMock.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            customerPrices: jest.fn(),
            customerFavorites: jest.fn(),
            suggestPrice: jest.fn(),
            getOrderReceiptHtml: jest.fn(),
            findOne: jest.fn(),
            updateStatus: jest.fn(),
            returnOrder: jest.fn(),
            addItems: jest.fn(),
            replaceItems: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(OrdersController);
    service = module.get(OrdersService);
  });

  describe('uploadPrescription', () => {
    it('uploads to S3 and returns the object key', async () => {
      const file = { originalname: 'rx.png', mimetype: 'image/png', buffer: Buffer.from('x') };

      const result = await controller.uploadPrescription(file);

      expect(sendMock).toHaveBeenCalled();
      expect(result.key).toBeDefined();
    });

    it('throws BadRequestException when no file is provided', async () => {
      await expect(controller.uploadPrescription(undefined as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPrescriptionUrl', () => {
    it('returns a signed url when a prescription image key is present', async () => {
      (service.findOne as jest.Mock).mockResolvedValue({ prescription_image_key: 'key-1' });

      const result = await controller.getPrescriptionUrl('order-1', 'biz-1');

      expect(getSignedUrlMock).toHaveBeenCalled();
      expect(result).toEqual({ url: 'https://signed.example.com/x' });
    });

    it('throws NotFoundException when the order has no prescription photo', async () => {
      (service.findOne as jest.Mock).mockResolvedValue({ prescription_image_key: null });

      await expect(controller.getPrescriptionUrl('order-1', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  it('create delegates to the service with the caller userId', async () => {
    const dto = { businessId: 'biz-1', items: [] } as any;
    const req = { user: { userId: 'user-1' } } as any;

    await controller.create(dto, req);

    expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
  });

  describe('findAll', () => {
    it('sets the total-count header and returns orders', async () => {
      (service.findAll as jest.Mock).mockResolvedValue({ orders: [{ id: 'o1' }], total: 3 });
      const res = { setHeader: jest.fn() } as any;

      const result = await controller.findAll({} as any, 'biz-1', 'draft', 'cust-1', '10', '0', 'search', res);

      expect(service.findAll).toHaveBeenCalledWith('biz-1', 'draft', 'cust-1', 10, 0, 'search');
      expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', '3');
      expect(result).toEqual([{ id: 'o1' }]);
    });

    it('normalizes an empty search string to undefined', async () => {
      (service.findAll as jest.Mock).mockResolvedValue({ orders: [], total: 0 });
      const res = { setHeader: jest.fn() } as any;

      await controller.findAll({} as any, 'biz-1', undefined, undefined, undefined, undefined, '', res);

      expect(service.findAll).toHaveBeenCalledWith('biz-1', undefined, undefined, undefined, undefined, undefined);
    });
  });

  it('customerPrices delegates to the service', () => {
    controller.customerPrices('biz-1', 'cust-1');
    expect(service.customerPrices).toHaveBeenCalledWith('biz-1', 'cust-1');
  });

  it('customerFavorites delegates to the service', () => {
    controller.customerFavorites('biz-1', 'cust-1');
    expect(service.customerFavorites).toHaveBeenCalledWith('biz-1', 'cust-1');
  });

  it('suggestPrice delegates to the service', () => {
    const item = { quantity: 1, productId: 'p1' } as any;
    controller.suggestPrice('biz-1', 'cust-1', item);
    expect(service.suggestPrice).toHaveBeenCalledWith('biz-1', 'cust-1', item);
  });

  it('getReceipt writes the rendered html to the response', async () => {
    (service.getOrderReceiptHtml as jest.Mock).mockResolvedValue('<html>Receipt</html>');
    const res = { setHeader: jest.fn(), send: jest.fn() } as any;

    await controller.getReceipt('order-1', 'biz-1', res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
    expect(res.send).toHaveBeenCalledWith('<html>Receipt</html>');
  });

  it('findOne delegates to the service', () => {
    controller.findOne('order-1', 'biz-1');
    expect(service.findOne).toHaveBeenCalledWith('order-1', 'biz-1');
  });

  it('updateStatus delegates to the service', () => {
    const dto = { status: 'confirmed' } as any;
    controller.updateStatus('order-1', 'biz-1', dto);
    expect(service.updateStatus).toHaveBeenCalledWith('order-1', 'biz-1', dto);
  });

  it('returnOrder delegates to the service with the items from the dto', () => {
    const dto = { items: [{ id: 'item-1', quantity: 1 }] };
    controller.returnOrder('order-1', 'biz-1', dto as any);
    expect(service.returnOrder).toHaveBeenCalledWith('order-1', 'biz-1', dto.items);
  });

  it('returnOrder tolerates an undefined dto body', () => {
    controller.returnOrder('order-1', 'biz-1', undefined as any);
    expect(service.returnOrder).toHaveBeenCalledWith('order-1', 'biz-1', undefined);
  });

  it('addItems delegates to the service', () => {
    const dto = { items: [] } as any;
    controller.addItems('order-1', 'biz-1', dto, { user: { role: 'cashier' } } as any);
    expect(service.addItems).toHaveBeenCalledWith('order-1', 'biz-1', dto);
  });

  describe('guest (table QR / takeaway) scoping', () => {
    const tableGuest = { user: { role: 'guest', userId: 'guest-table-1', businessId: 'biz-1' } } as any;
    const takeawayGuest = { user: { role: 'guest', userId: 'guest-takeaway-biz-1', businessId: 'biz-1' } } as any;

    it('strips client-supplied unitPrice on addItems so guests pay catalog price', async () => {
      (service.findOne as jest.Mock).mockResolvedValue({ table_id: 'table-1', order_type: 'dine_in' });
      const dto = { items: [{ productId: 'p1', quantity: 1, unitPrice: 0 }] } as any;
      await controller.addItems('order-1', 'biz-1', dto, tableGuest);
      expect(dto.items[0].unitPrice).toBeUndefined();
      expect(service.addItems).toHaveBeenCalled();
    });

    it("refuses addItems on another table's order", async () => {
      (service.findOne as jest.Mock).mockResolvedValue({ table_id: 'table-2', order_type: 'dine_in' });
      await expect(
        controller.addItems('order-1', 'biz-1', { items: [] } as any, tableGuest),
      ).rejects.toThrow('Order not found');
    });

    it('refuses findOne on a dine-in order for a takeaway guest', async () => {
      (service.findOne as jest.Mock).mockResolvedValue({ table_id: 'table-1', order_type: 'dine_in' });
      await expect(controller.findOne('order-1', 'biz-1', takeawayGuest)).rejects.toThrow('Order not found');
    });

    it('lets a takeaway guest read its own takeaway order', async () => {
      const order = { table_id: null, order_type: 'take_away' };
      (service.findOne as jest.Mock).mockResolvedValue(order);
      await expect(controller.findOne('order-1', 'biz-1', takeawayGuest)).resolves.toBe(order);
    });

    it('list returns only the open orders on the guest table, never the full history', async () => {
      (service as any).findOpenOrdersForTable = jest.fn().mockResolvedValue([{ id: 'o1' }]);
      const result = await controller.findAll(tableGuest, 'biz-1');
      expect((service as any).findOpenOrdersForTable).toHaveBeenCalledWith('biz-1', 'table-1');
      expect(service.findAll).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: 'o1' }]);
    });

    it('create forces table/type from the token and drops customerId + prescription key', async () => {
      const dto = {
        businessId: 'biz-1',
        customerName: 'x',
        customerId: 'someone-elses-credit-account',
        tableId: 'other-table',
        orderType: 'delivery',
        prescriptionImageKey: 'k',
        items: [{ productId: 'p1', quantity: 1, unitPrice: 0 }],
      } as any;
      await controller.create(dto, tableGuest);
      expect(dto).toMatchObject({ tableId: 'table-1', orderType: 'dine_in', customerId: undefined, prescriptionImageKey: undefined });
      expect(dto.items[0].unitPrice).toBeUndefined();
      expect(service.create).toHaveBeenCalledWith(dto, undefined);
    });
  });

  it('keeps staff unitPrice overrides', () => {
    const dto = { items: [{ productId: 'p1', quantity: 1, unitPrice: 5 }] } as any;
    controller.addItems('order-1', 'biz-1', dto, { user: { role: 'cashier' } } as any);
    expect(dto.items[0].unitPrice).toBe(5);
  });

  it('replaceItems delegates to the service', () => {
    const dto = { items: [] } as any;
    controller.replaceItems('order-1', 'biz-1', dto);
    expect(service.replaceItems).toHaveBeenCalledWith('order-1', 'biz-1', dto);
  });

  it('remove delegates to the service', () => {
    controller.remove('order-1', 'biz-1');
    expect(service.remove).toHaveBeenCalledWith('order-1', 'biz-1');
  });
});
