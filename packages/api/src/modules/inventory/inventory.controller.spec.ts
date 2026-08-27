import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: jest.Mocked<InventoryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        {
          provide: InventoryService,
          useValue: {
            createPurchaseOrder: jest.fn(),
            findAllPurchaseOrders: jest.fn(),
            findOnePurchaseOrder: jest.fn(),
            updatePurchaseOrder: jest.fn(),
            receivePurchaseOrder: jest.fn(),
            confirmPurchaseOrder: jest.fn(),
            markPurchaseOrderPaid: jest.fn(),
            cancelPurchaseOrder: jest.fn(),
            adjustStock: jest.fn(),
            returnToSupplier: jest.fn(),
            listSupplierReturns: jest.fn(),
            updateSupplierReturnStatus: jest.fn(),
            findProductBatches: jest.fn(),
            findOrdersForBatch: jest.fn(),
            findStockHistory: jest.fn(),
            lowStock: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(InventoryController);
    service = module.get(InventoryService);
  });

  it('createPurchaseOrder delegates to the service', () => {
    const dto = { businessId: 'biz-1', items: [] } as any;
    controller.createPurchaseOrder(dto);
    expect(service.createPurchaseOrder).toHaveBeenCalledWith(dto);
  });

  describe('findAllPurchaseOrders', () => {
    it('sets the total-count header and returns the orders', async () => {
      (service.findAllPurchaseOrders as jest.Mock).mockResolvedValue({ orders: [{ id: 'po-1' }], total: 9 });
      const res = { setHeader: jest.fn() } as any;

      const result = await controller.findAllPurchaseOrders('biz-1', 'draft', '10', '0', res);

      expect(service.findAllPurchaseOrders).toHaveBeenCalledWith('biz-1', 'draft', 10, 0);
      expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', '9');
      expect(result).toEqual([{ id: 'po-1' }]);
    });
  });

  it('findOnePurchaseOrder delegates to the service', () => {
    controller.findOnePurchaseOrder('po-1', 'biz-1');
    expect(service.findOnePurchaseOrder).toHaveBeenCalledWith('po-1', 'biz-1');
  });

  it('updatePurchaseOrder delegates to the service', () => {
    const dto = { items: [] } as any;
    controller.updatePurchaseOrder('po-1', 'biz-1', dto);
    expect(service.updatePurchaseOrder).toHaveBeenCalledWith('po-1', 'biz-1', dto);
  });

  it('receivePurchaseOrder delegates to the service', () => {
    controller.receivePurchaseOrder('po-1', 'biz-1');
    expect(service.receivePurchaseOrder).toHaveBeenCalledWith('po-1', 'biz-1');
  });

  it('confirmPurchaseOrder delegates to the service', () => {
    controller.confirmPurchaseOrder('po-1', 'biz-1');
    expect(service.confirmPurchaseOrder).toHaveBeenCalledWith('po-1', 'biz-1');
  });

  it('markPurchaseOrderPaid delegates to the service', () => {
    controller.markPurchaseOrderPaid('po-1', 'biz-1');
    expect(service.markPurchaseOrderPaid).toHaveBeenCalledWith('po-1', 'biz-1');
  });

  it('cancelPurchaseOrder delegates to the service', () => {
    controller.cancelPurchaseOrder('po-1', 'biz-1');
    expect(service.cancelPurchaseOrder).toHaveBeenCalledWith('po-1', 'biz-1');
  });

  it('adjustStock delegates to the service', () => {
    const dto = { businessId: 'biz-1', productId: 'p1', type: 'IN', quantity: 1 } as any;
    controller.adjustStock(dto);
    expect(service.adjustStock).toHaveBeenCalledWith(dto);
  });

  it('returnToSupplier delegates to the service', () => {
    const dto = { businessId: 'biz-1' } as any;
    controller.returnToSupplier(dto);
    expect(service.returnToSupplier).toHaveBeenCalledWith(dto);
  });

  it('listSupplierReturns delegates to the service', () => {
    controller.listSupplierReturns('biz-1', 'sup-1', '2026-01-01', '2026-01-31');
    expect(service.listSupplierReturns).toHaveBeenCalledWith('biz-1', 'sup-1', '2026-01-01', '2026-01-31');
  });

  it('updateSupplierReturnStatus delegates to the service', () => {
    controller.updateSupplierReturnStatus('sr-1', 'biz-1', 'credited');
    expect(service.updateSupplierReturnStatus).toHaveBeenCalledWith('sr-1', 'biz-1', 'credited');
  });

  it('findProductBatches delegates to the service', () => {
    controller.findProductBatches('p1', 'biz-1');
    expect(service.findProductBatches).toHaveBeenCalledWith('p1', 'biz-1');
  });

  it('findOrdersForBatch delegates to the service', () => {
    controller.findOrdersForBatch('batch-1', 'biz-1');
    expect(service.findOrdersForBatch).toHaveBeenCalledWith('batch-1', 'biz-1');
  });

  it('findStockHistory delegates to the service', () => {
    controller.findStockHistory('biz-1', 'p1');
    expect(service.findStockHistory).toHaveBeenCalledWith('biz-1', 'p1');
  });

  describe('lowStock', () => {
    it('passes a numeric threshold when provided', () => {
      controller.lowStock('biz-1', '25');
      expect(service.lowStock).toHaveBeenCalledWith('biz-1', 25);
    });

    it('passes undefined when no threshold is provided', () => {
      controller.lowStock('biz-1');
      expect(service.lowStock).toHaveBeenCalledWith('biz-1', undefined);
    });
  });
});
