import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { PurchaseItem } from '../../database/entities/purchase-item.entity';
import { Stock } from '../../database/entities/stock.entity';
import { Product } from '../../database/entities/product.entity';
import { ProductBatch } from '../../database/entities/product-batch.entity';
import { SupplierReturn } from '../../database/entities/supplier-return.entity';

jest.mock('../../common/utils/find-or-create-product.util', () => ({
  findOrCreateProductByName: jest.fn(),
}));
import { findOrCreateProductByName } from '../../common/utils/find-or-create-product.util';

describe('InventoryService', () => {
  let service: InventoryService;
  let purchaseOrdersRepo: Record<string, jest.Mock>;
  let purchaseItemsRepo: Record<string, jest.Mock>;
  let stocksRepo: Record<string, jest.Mock>;
  let productsRepo: Record<string, jest.Mock>;
  let productBatchesRepo: Record<string, jest.Mock>;
  let supplierReturnsRepo: Record<string, jest.Mock>;
  let dataSource: { transaction: jest.Mock; createQueryBuilder: jest.Mock };

  const buildUpdateChainQb = (affected = 1) => {
    const qb: any = {};
    qb.update = jest.fn().mockReturnValue(qb);
    qb.set = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.execute = jest.fn().mockResolvedValue({ affected });
    return qb;
  };

  const buildBatchSelectQb = (soonest: any = null) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(soonest),
  });

  /** Generic fake EntityManager keyed by entity class name; good enough for the single-record-per-entity scenarios exercised below. */
  const buildManager = (entityData: Record<string, any> = {}, opts: { updateAffected?: number; soonestBatch?: any } = {}) => {
    const updateQb = buildUpdateChainQb(opts.updateAffected ?? 1);
    const batchSelectQb = buildBatchSelectQb(opts.soonestBatch ?? null);

    const manager: any = {
      findOne: jest.fn((Entity: any) => Promise.resolve(entityData[Entity.name] ?? null)),
      find: jest.fn((Entity: any) => Promise.resolve(entityData[`${Entity.name}List`] ?? [])),
      create: jest.fn((Entity: any, data: any) => ({ id: `${Entity.name}-new-id`, ...data })),
      save: jest.fn(async (a: any, b?: any) => (b !== undefined ? b : a)),
      update: jest.fn(),
      increment: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn((...args: any[]) => (args.length === 0 ? updateQb : batchSelectQb)),
      __updateQb: updateQb,
      __batchSelectQb: batchSelectQb,
    };
    return manager;
  };

  beforeEach(async () => {
    purchaseOrdersRepo = { findOne: jest.fn(), findAndCount: jest.fn() };
    purchaseItemsRepo = { find: jest.fn() };
    stocksRepo = { find: jest.fn() };
    productsRepo = { createQueryBuilder: jest.fn() };
    productBatchesRepo = { createQueryBuilder: jest.fn(), findOne: jest.fn() };
    supplierReturnsRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (entity) => entity),
    };
    dataSource = {
      transaction: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(PurchaseOrder), useValue: purchaseOrdersRepo },
        { provide: getRepositoryToken(PurchaseItem), useValue: purchaseItemsRepo },
        { provide: getRepositoryToken(Stock), useValue: stocksRepo },
        { provide: getRepositoryToken(Product), useValue: productsRepo },
        { provide: getRepositoryToken(ProductBatch), useValue: productBatchesRepo },
        { provide: getRepositoryToken(SupplierReturn), useValue: supplierReturnsRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(InventoryService);
    jest.clearAllMocks();
    (findOrCreateProductByName as jest.Mock).mockReset();
  });

  describe('createPurchaseOrder', () => {
    it('creates the PO and priced items, computing totals, without mirroring when there is no supplier', async () => {
      const manager = buildManager();
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const dto = {
        businessId: 'biz-1',
        items: [{ productId: 'p1', quantity: 2, unitPrice: 50, taxPercentage: 10 }],
      };

      const result = await service.createPurchaseOrder(dto as any);

      expect(manager.save).toHaveBeenCalled();
      expect(result.total_amount).toBe(110);
      expect(result.tax_amount).toBe(10);
      expect(result.items).toHaveLength(1);
    });

    it('does not mirror when the supplier exists but has no linked business', async () => {
      const manager = buildManager({ Supplier: { id: 'sup-1', linked_business_id: null } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const dto = {
        businessId: 'biz-1',
        supplierId: 'sup-1',
        items: [{ productId: 'p1', quantity: 1, unitPrice: 20 }],
      };

      await service.createPurchaseOrder(dto as any);

      expect(findOrCreateProductByName).not.toHaveBeenCalled();
    });

    it('mirrors the order to the linked wholesaler when the supplier is linked and a reciprocal customer exists', async () => {
      const manager = buildManager({
        Supplier: { id: 'sup-1', linked_business_id: 'wholesaler-biz', name: 'Acme Supply' },
        Customer: { id: 'cust-1', linked_business_id: 'biz-1' },
        Business: { id: 'biz-1', name: 'Retailer Shop' },
        Product: { id: 'p1', name: 'Widget', unit: 'piece', stock_quantity: 10 },
      });
      (findOrCreateProductByName as jest.Mock).mockResolvedValue({
        id: 'mirror-p1',
        unit: 'piece',
        stock_quantity: 10,
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const dto = {
        businessId: 'biz-1',
        supplierId: 'sup-1',
        items: [{ productId: 'p1', quantity: 3, unitPrice: 20, taxPercentage: 0 }],
      };

      await service.createPurchaseOrder(dto as any);

      expect(findOrCreateProductByName).toHaveBeenCalled();
    });

    it('no-ops the mirror when no reciprocal customer link exists', async () => {
      const manager = buildManager({
        Supplier: { id: 'sup-1', linked_business_id: 'wholesaler-biz' },
        Customer: null,
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const dto = {
        businessId: 'biz-1',
        supplierId: 'sup-1',
        items: [{ productId: 'p1', quantity: 1, unitPrice: 10 }],
      };

      await service.createPurchaseOrder(dto as any);

      expect(findOrCreateProductByName).not.toHaveBeenCalled();
    });
  });

  describe('findAllPurchaseOrders', () => {
    it('filters by status when provided and returns orders with a total', async () => {
      purchaseOrdersRepo.findAndCount.mockResolvedValue([[{ id: 'po-1' }], 1]);

      const result = await service.findAllPurchaseOrders('biz-1', 'draft', 10, 0);

      expect(purchaseOrdersRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { business_id: 'biz-1', status: 'draft' } }),
      );
      expect(result).toEqual({ orders: [{ id: 'po-1' }], total: 1 });
    });
  });

  describe('findOnePurchaseOrder', () => {
    it('returns the order merged with its items', async () => {
      purchaseOrdersRepo.findOne.mockResolvedValue({ id: 'po-1', business_id: 'biz-1' });
      purchaseItemsRepo.find.mockResolvedValue([{ id: 'item-1' }]);

      const result = await service.findOnePurchaseOrder('po-1', 'biz-1');

      expect(result.items).toEqual([{ id: 'item-1' }]);
    });

    it('throws NotFoundException when the order does not exist', async () => {
      purchaseOrdersRepo.findOne.mockResolvedValue(null);

      await expect(service.findOnePurchaseOrder('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('receivePurchaseOrder', () => {
    it('marks the order received, credits product stock, and writes a stock ledger row', async () => {
      const manager = buildManager({
        PurchaseOrder: { id: 'po-1', business_id: 'biz-1', order_number: 'PO-1', supplier_id: 'sup-1' },
        PurchaseItemList: [{ product_id: 'p1', quantity: 5, unit_price: 10, supplier_id: 'sup-1', batch_number: null, expiry_date: null }],
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.receivePurchaseOrder('po-1', 'biz-1');

      expect(manager.increment).toHaveBeenCalledWith(Product, { id: 'p1' }, 'stock_quantity', 5);
      expect(manager.update).toHaveBeenCalledWith(Product, { id: 'p1' }, expect.objectContaining({ is_available: true }));
      expect(result.id).toBe('po-1');
    });

    it('credits a batched item and re-derives the product batch summary', async () => {
      const manager = buildManager(
        {
          PurchaseOrder: { id: 'po-1', business_id: 'biz-1', order_number: 'PO-1' },
          PurchaseItemList: [
            { product_id: 'p1', quantity: 5, unit_price: 10, batch_number: 'B100', expiry_date: new Date('2027-01-01') },
          ],
          ProductBatch: null,
        },
        { soonestBatch: { batch_number: 'B100', expiry_date: new Date('2027-01-01') } },
      );
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.receivePurchaseOrder('po-1', 'biz-1');

      expect(manager.create).toHaveBeenCalledWith(ProductBatch, expect.objectContaining({ batch_number: 'B100' }));
      expect(manager.update).toHaveBeenCalledWith(
        Product,
        { id: 'p1' },
        expect.objectContaining({ batch_number: 'B100' }),
      );
    });

    it('throws BadRequestException when the order is already received/paid/cancelled', async () => {
      const manager = buildManager({}, { updateAffected: 0 });
      manager.findOne.mockResolvedValueOnce({ id: 'po-1', business_id: 'biz-1', status: 'received' });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.receivePurchaseOrder('po-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the order does not exist', async () => {
      const manager = buildManager({}, { updateAffected: 0 });
      manager.findOne.mockResolvedValueOnce(null);
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(service.receivePurchaseOrder('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('status transitions (confirm / markPaid / cancel)', () => {
    it('confirmPurchaseOrder transitions draft -> confirmed', async () => {
      const qb = buildUpdateChainQb(1);
      dataSource.createQueryBuilder.mockReturnValue(qb);
      purchaseOrdersRepo.findOne.mockResolvedValue({ id: 'po-1', status: 'confirmed' });

      const result = await service.confirmPurchaseOrder('po-1', 'biz-1');

      expect(qb.set).toHaveBeenCalledWith({ status: 'confirmed' });
      expect(result).toEqual({ id: 'po-1', status: 'confirmed' });
    });

    it('markPurchaseOrderPaid transitions received -> paid', async () => {
      const qb = buildUpdateChainQb(1);
      dataSource.createQueryBuilder.mockReturnValue(qb);
      purchaseOrdersRepo.findOne.mockResolvedValue({ id: 'po-1', status: 'paid' });

      const result = await service.markPurchaseOrderPaid('po-1', 'biz-1');

      expect(qb.set).toHaveBeenCalledWith({ status: 'paid' });
      expect(result).toEqual({ id: 'po-1', status: 'paid' });
    });

    it('cancelPurchaseOrder transitions draft/confirmed -> cancelled', async () => {
      const qb = buildUpdateChainQb(1);
      dataSource.createQueryBuilder.mockReturnValue(qb);
      purchaseOrdersRepo.findOne.mockResolvedValue({ id: 'po-1', status: 'cancelled' });

      const result = await service.cancelPurchaseOrder('po-1', 'biz-1');

      expect(result).toEqual({ id: 'po-1', status: 'cancelled' });
    });

    it('throws BadRequestException on an invalid transition', async () => {
      const qb = buildUpdateChainQb(0);
      dataSource.createQueryBuilder.mockReturnValue(qb);
      purchaseOrdersRepo.findOne.mockResolvedValue({ id: 'po-1', status: 'paid' });

      await expect(service.confirmPurchaseOrder('po-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the order does not exist', async () => {
      const qb = buildUpdateChainQb(0);
      dataSource.createQueryBuilder.mockReturnValue(qb);
      purchaseOrdersRepo.findOne.mockResolvedValue(null);

      await expect(service.confirmPurchaseOrder('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePurchaseOrder', () => {
    it('throws BadRequestException when the order is cancelled', async () => {
      const manager = buildManager({ PurchaseOrder: { id: 'po-1', business_id: 'biz-1', status: 'cancelled' } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.updatePurchaseOrder('po-1', 'biz-1', { items: [{ productId: 'p1', quantity: 1, unitPrice: 10 }] } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the order does not exist', async () => {
      const manager = buildManager({ PurchaseOrder: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.updatePurchaseOrder('missing', 'biz-1', { items: [] } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('edits a draft order without touching stock (nothing was credited yet)', async () => {
      const manager = buildManager({
        PurchaseOrder: { id: 'po-1', business_id: 'biz-1', status: 'draft', order_number: 'PO-1', supplier_id: 'sup-1' },
        PurchaseItemList: [],
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.updatePurchaseOrder('po-1', 'biz-1', {
        items: [{ productId: 'p1', quantity: 4, unitPrice: 25 }],
      } as any);

      expect(manager.increment).not.toHaveBeenCalled();
      expect(manager.update).toHaveBeenCalledWith(
        PurchaseOrder,
        { id: 'po-1' },
        expect.objectContaining({ total_amount: 100 }),
      );
    });

    it('reconciles stock upward for a received order when a line quantity increases', async () => {
      const manager = buildManager({
        PurchaseOrder: { id: 'po-1', business_id: 'biz-1', status: 'received', order_number: 'PO-1', supplier_id: 'sup-1' },
        PurchaseItemList: [{ id: 'item-1', product_id: 'p1', quantity: 5, unit_price: 10, batch_number: null, expiry_date: null }],
        Product: { id: 'p1', name: 'Widget', stock_quantity: 20 },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.updatePurchaseOrder('po-1', 'biz-1', {
        items: [{ id: 'item-1', productId: 'p1', quantity: 8, unitPrice: 10 }],
      } as any);

      expect(manager.increment).toHaveBeenCalledWith(Product, { id: 'p1' }, 'stock_quantity', 3);
    });

    it('reconciles stock downward and blocks going negative for a received order', async () => {
      const manager = buildManager({
        PurchaseOrder: { id: 'po-1', business_id: 'biz-1', status: 'received', order_number: 'PO-1', supplier_id: 'sup-1' },
        PurchaseItemList: [{ id: 'item-1', product_id: 'p1', quantity: 5, unit_price: 10, batch_number: null, expiry_date: null }],
        Product: { id: 'p1', name: 'Widget', stock_quantity: 2 },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.updatePurchaseOrder('po-1', 'biz-1', {
          items: [{ id: 'item-1', productId: 'p1', quantity: 0.5, unitPrice: 10 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('applies a full-negative delta for a removed line on an already-received order', async () => {
      const manager = buildManager({
        PurchaseOrder: { id: 'po-1', business_id: 'biz-1', status: 'received', order_number: 'PO-1', supplier_id: 'sup-1' },
        PurchaseItemList: [{ id: 'item-1', product_id: 'p1', quantity: 5, unit_price: 10, batch_number: null, expiry_date: null }],
        Product: { id: 'p1', name: 'Widget', stock_quantity: 20 },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.updatePurchaseOrder('po-1', 'biz-1', { items: [] } as any);

      expect(manager.increment).toHaveBeenCalledWith(Product, { id: 'p1' }, 'stock_quantity', -5);
      expect(manager.remove).toHaveBeenCalled();
    });
  });

  describe('adjustStock', () => {
    it('increments stock and marks available for an IN adjustment', async () => {
      const manager = buildManager({ Product: { id: 'p1', business_id: 'biz-1', stock_quantity: 10 } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.adjustStock({ businessId: 'biz-1', productId: 'p1', type: 'IN', quantity: 5 } as any);

      expect(manager.increment).toHaveBeenCalledWith(Product, { id: 'p1' }, 'stock_quantity', 5);
      expect(manager.update).toHaveBeenCalledWith(Product, { id: 'p1' }, { is_available: true });
    });

    it('decrements stock for an OUT adjustment and marks unavailable at zero', async () => {
      const manager = buildManager({ Product: { id: 'p1', business_id: 'biz-1', stock_quantity: 5 } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.adjustStock({ businessId: 'biz-1', productId: 'p1', type: 'OUT', quantity: 5 } as any);

      expect(manager.increment).toHaveBeenCalledWith(Product, { id: 'p1' }, 'stock_quantity', -5);
      expect(manager.update).toHaveBeenCalledWith(Product, { id: 'p1' }, { is_available: false });
    });

    it('throws BadRequestException for an OUT adjustment exceeding available stock', async () => {
      const manager = buildManager({ Product: { id: 'p1', business_id: 'biz-1', stock_quantity: 2 } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.adjustStock({ businessId: 'biz-1', productId: 'p1', type: 'OUT', quantity: 5 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the product does not exist', async () => {
      const manager = buildManager({ Product: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.adjustStock({ businessId: 'biz-1', productId: 'missing', type: 'IN', quantity: 5 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('also adjusts the specified batch quantity when batchId is provided', async () => {
      const manager = buildManager({
        Product: { id: 'p1', business_id: 'biz-1', stock_quantity: 10 },
        ProductBatch: { id: 'batch-1', business_id: 'biz-1', product_id: 'p1', quantity: 10 },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.adjustStock({
        businessId: 'biz-1',
        productId: 'p1',
        type: 'OUT',
        quantity: 4,
        batchId: 'batch-1',
      } as any);

      expect(manager.update).toHaveBeenCalledWith(ProductBatch, { id: 'batch-1' }, { quantity: 6 });
    });

    it('throws NotFoundException when the batch does not exist', async () => {
      const manager = buildManager({ Product: { id: 'p1', business_id: 'biz-1', stock_quantity: 10 }, ProductBatch: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.adjustStock({ businessId: 'biz-1', productId: 'p1', type: 'IN', quantity: 1, batchId: 'missing' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the batch has insufficient quantity for an OUT', async () => {
      const manager = buildManager({
        Product: { id: 'p1', business_id: 'biz-1', stock_quantity: 10 },
        ProductBatch: { id: 'batch-1', business_id: 'biz-1', product_id: 'p1', quantity: 2 },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.adjustStock({ businessId: 'biz-1', productId: 'p1', type: 'OUT', quantity: 5, batchId: 'batch-1' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('returnToSupplier', () => {
    it('records a supplier return, decrements stock, and marks unavailable at zero', async () => {
      const manager = buildManager({
        Supplier: { id: 'sup-1', business_id: 'biz-1', name: 'Acme Supply' },
        Product: { id: 'p1', business_id: 'biz-1', stock_quantity: 5 },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      const result = await service.returnToSupplier({
        businessId: 'biz-1',
        supplierId: 'sup-1',
        productId: 'p1',
        quantity: 5,
        unitPrice: 10,
        reason: 'expired',
      } as any);

      expect(manager.increment).toHaveBeenCalledWith(Product, { id: 'p1' }, 'stock_quantity', -5);
      expect((result as any).amount).toBe(50);
    });

    it('throws NotFoundException when the supplier does not exist', async () => {
      const manager = buildManager({ Supplier: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.returnToSupplier({ businessId: 'biz-1', supplierId: 'missing', productId: 'p1', quantity: 1, unitPrice: 1, reason: 'damaged' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the product does not exist', async () => {
      const manager = buildManager({ Supplier: { id: 'sup-1' }, Product: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.returnToSupplier({ businessId: 'biz-1', supplierId: 'sup-1', productId: 'missing', quantity: 1, unitPrice: 1, reason: 'damaged' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when stock is insufficient for the return', async () => {
      const manager = buildManager({ Supplier: { id: 'sup-1' }, Product: { id: 'p1', stock_quantity: 2 } });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.returnToSupplier({ businessId: 'biz-1', supplierId: 'sup-1', productId: 'p1', quantity: 5, unitPrice: 1, reason: 'damaged' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('debits the specific batch when batchId is provided', async () => {
      const manager = buildManager({
        Supplier: { id: 'sup-1', name: 'Acme' },
        Product: { id: 'p1', stock_quantity: 10 },
        ProductBatch: { id: 'batch-1', quantity: 8, batch_number: 'B1' },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await service.returnToSupplier({
        businessId: 'biz-1',
        supplierId: 'sup-1',
        productId: 'p1',
        batchId: 'batch-1',
        quantity: 3,
        unitPrice: 5,
        reason: 'damaged',
      } as any);

      expect(manager.update).toHaveBeenCalledWith(ProductBatch, { id: 'batch-1' }, { quantity: 5 });
    });

    it('throws NotFoundException when the specified batch does not exist', async () => {
      const manager = buildManager({ Supplier: { id: 'sup-1' }, Product: { id: 'p1', stock_quantity: 10 }, ProductBatch: null });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.returnToSupplier({ businessId: 'biz-1', supplierId: 'sup-1', productId: 'p1', batchId: 'missing', quantity: 1, unitPrice: 1, reason: 'other' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the batch has insufficient quantity', async () => {
      const manager = buildManager({
        Supplier: { id: 'sup-1' },
        Product: { id: 'p1', stock_quantity: 10 },
        ProductBatch: { id: 'batch-1', quantity: 1 },
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(manager));

      await expect(
        service.returnToSupplier({ businessId: 'biz-1', supplierId: 'sup-1', productId: 'p1', batchId: 'batch-1', quantity: 5, unitPrice: 1, reason: 'other' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listSupplierReturns', () => {
    it('applies supplier and date filters when provided', () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      supplierReturnsRepo.createQueryBuilder.mockReturnValue(qb);

      service.listSupplierReturns('biz-1', 'sup-1', '2026-01-01', '2026-01-31');

      expect(qb.andWhere).toHaveBeenCalledTimes(3);
    });

    it('omits optional filters when not provided', () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      supplierReturnsRepo.createQueryBuilder.mockReturnValue(qb);

      service.listSupplierReturns('biz-1');

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('updateSupplierReturnStatus', () => {
    it('updates the status of an existing supplier return', async () => {
      supplierReturnsRepo.findOne.mockResolvedValue({ id: 'sr-1', business_id: 'biz-1', status: 'pending' });

      const result = await service.updateSupplierReturnStatus('sr-1', 'biz-1', 'credited');

      expect(result.status).toBe('credited');
    });

    it('throws NotFoundException when the return does not exist', async () => {
      supplierReturnsRepo.findOne.mockResolvedValue(null);

      await expect(service.updateSupplierReturnStatus('missing', 'biz-1', 'credited')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findProductBatches', () => {
    it('returns batches ordered by soonest expiry', () => {
      const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([{ id: 'b1' }]) };
      productBatchesRepo.createQueryBuilder.mockReturnValue(qb);

      service.findProductBatches('p1', 'biz-1');

      expect(qb.orderBy).toHaveBeenCalledWith('batch.expiry_date', 'ASC', 'NULLS LAST');
    });
  });

  describe('findOrdersForBatch', () => {
    it('returns the batch summary and its allocated orders', async () => {
      productBatchesRepo.findOne.mockResolvedValue({ id: 'batch-1', batch_number: 'B1', expiry_date: new Date('2027-01-01') });
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ order_id: 'o1' }]),
      };
      dataSource.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findOrdersForBatch('batch-1', 'biz-1');

      expect(result.batch.batchNumber).toBe('B1');
      expect(result.orders).toEqual([{ order_id: 'o1' }]);
    });

    it('throws NotFoundException when the batch does not exist', async () => {
      productBatchesRepo.findOne.mockResolvedValue(null);

      await expect(service.findOrdersForBatch('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findStockHistory', () => {
    it('filters by productId when provided', () => {
      service.findStockHistory('biz-1', 'p1');

      expect(stocksRepo.find).toHaveBeenCalledWith({
        where: { business_id: 'biz-1', product_id: 'p1' },
        order: { created_at: 'DESC' },
      });
    });

    it('omits the productId filter when not provided', () => {
      service.findStockHistory('biz-1');

      expect(stocksRepo.find).toHaveBeenCalledWith({ where: { business_id: 'biz-1' }, order: { created_at: 'DESC' } });
    });
  });

  describe('lowStock', () => {
    it('queries with the default threshold when none is provided', () => {
      const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) };
      productsRepo.createQueryBuilder.mockReturnValue(qb);

      service.lowStock('biz-1');

      expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), { threshold: 10 });
    });

    it('uses a custom threshold when provided', () => {
      const qb = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) };
      productsRepo.createQueryBuilder.mockReturnValue(qb);

      service.lowStock('biz-1', 25);

      expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), { threshold: 25 });
    });
  });
});
