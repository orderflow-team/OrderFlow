import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from '../../database/entities/product.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { SharedBarcodeCatalog } from '../../database/entities/shared-barcode-catalog.entity';
import { InvoicesService } from '../billing/invoices.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let productsRepo: {
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
    update: jest.Mock;
  };
  let orderItemsRepo: Record<string, jest.Mock>;
  let sharedBarcodeRepo: { findOne: jest.Mock };
  let dataSource: { query: jest.Mock; transaction: jest.Mock };
  let invoicesService: { syncFromOrder: jest.Mock };

  const buildQb = (overrides: Record<string, any> = {}) => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getCount: jest.fn().mockResolvedValue(0),
    getRawMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  });

  beforeEach(async () => {
    productsRepo = {
      create: jest.fn((entity) => ({ id: 'product-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    };
    orderItemsRepo = {};
    sharedBarcodeRepo = { findOne: jest.fn() };
    dataSource = {
      query: jest.fn().mockResolvedValue(undefined),
      transaction: jest.fn(async (cb) =>
        cb({
          create: jest.fn((_entity, data) => ({ id: 'gen-id', ...data })),
          save: jest.fn(async (_entity, data) => data),
          createQueryBuilder: jest.fn(() => buildQb({ innerJoin: jest.fn().mockReturnThis() })),
          find: jest.fn().mockResolvedValue([]),
          update: jest.fn(),
          increment: jest.fn(),
          delete: jest.fn(),
        }),
      ),
    };
    invoicesService = { syncFromOrder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: productsRepo },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemsRepo },
        { provide: getRepositoryToken(SharedBarcodeCatalog), useValue: sharedBarcodeRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: InvoicesService, useValue: invoicesService },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  describe('create', () => {
    it('applies default values and clamps selling price to the mrp ceiling', async () => {
      const result = await service.create({
        businessId: 'biz-1',
        name: 'Widget',
        sellingPrice: 150,
        mrp: 100,
      } as any);

      expect(productsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ selling_price: 100, unit: 'piece', tax_percentage: 0, stock_quantity: 0, moq: 1 }),
      );
      expect(result).toBeDefined();
    });

    it('leaves selling price untouched when no mrp is set', async () => {
      await service.create({ businessId: 'biz-1', name: 'Widget', sellingPrice: 150 } as any);

      expect(productsRepo.create).toHaveBeenCalledWith(expect.objectContaining({ selling_price: 150 }));
    });

    it('contributes to the shared barcode catalog when a barcode is set', async () => {
      await service.create({ businessId: 'biz-1', name: 'Widget', sellingPrice: 50, barcode: '12345' } as any);

      expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('shared_barcode_catalog'), [
        '12345',
        'Widget',
        50,
      ]);
    });

    it('does not touch the shared barcode catalog without a barcode', async () => {
      await service.create({ businessId: 'biz-1', name: 'Widget', sellingPrice: 50 } as any);

      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('swallows shared-barcode-catalog contribution failures without failing product creation', async () => {
      dataSource.query.mockRejectedValue(new Error('insert failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await service.create({ businessId: 'biz-1', name: 'Widget', sellingPrice: 50, barcode: '999' } as any);

      expect(result).toBeDefined();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getBarcodeSuggestion', () => {
    it('returns null when no catalog entry exists', async () => {
      sharedBarcodeRepo.findOne.mockResolvedValue(null);

      expect(await service.getBarcodeSuggestion('000')).toBeNull();
    });

    it('returns the name and suggested price when found', async () => {
      sharedBarcodeRepo.findOne.mockResolvedValue({ name: 'Widget', suggested_price: 99 });

      expect(await service.getBarcodeSuggestion('123')).toEqual({ name: 'Widget', suggestedPrice: 99 });
    });
  });

  describe('createWithVariants', () => {
    it('creates the master product and its variants within a transaction, clamping each to its own mrp', async () => {
      const dto = {
        businessId: 'biz-1',
        name: 'Oil',
        variants: [
          { name: '1L', costPrice: 80, mrp: 100, sellingPrice: 150, stockQuantity: 5, barcode: 'v1' },
          { name: '5L', costPrice: 350, mrp: 500, sellingPrice: 480, stockQuantity: 2 },
        ],
      };

      const result = await service.createWithVariants(dto as any);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.variants).toHaveLength(2);
      expect(result.variants[0].selling_price).toBe(100);
      expect(result.stock_quantity).toBe(7);
    });
  });

  describe('findAll / findAllPaginated / getStats', () => {
    it('findAll returns the query result', async () => {
      const qb = buildQb({ getMany: jest.fn().mockResolvedValue([{ id: 'p1' }]) });
      productsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('biz-1');
      expect(result).toEqual([{ id: 'p1' }]);
    });

    it('findAllPaginated returns products and total', async () => {
      const qb = buildQb({ getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'p1' }], 1]) });
      productsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllPaginated('biz-1', undefined, undefined, 10, 0);
      expect(result).toEqual({ products: [{ id: 'p1' }], total: 1 });
    });

    it('getStats returns total and per-category counts, filtering out null categories', async () => {
      const qb = buildQb({
        getCount: jest.fn().mockResolvedValue(5),
        getRawMany: jest.fn().mockResolvedValue([
          { category: 'Snacks', count: '3' },
          { category: null, count: '2' },
        ]),
      });
      productsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getStats('biz-1');
      expect(result).toEqual({ total: 5, categories: [{ name: 'Snacks', count: 3 }] });
    });
  });

  describe('findOne', () => {
    it('returns the product scoped to the business', async () => {
      productsRepo.findOne.mockResolvedValue({ id: 'p1', business_id: 'biz-1' });

      expect((await service.findOne('p1', 'biz-1')).id).toBe('p1');
    });

    it('throws NotFoundException when not found', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const existingProduct = () => ({
      id: 'p1',
      business_id: 'biz-1',
      name: 'Widget',
      selling_price: 100,
      mrp: 150,
      tax_percentage: 5,
      stock_quantity: 10,
      is_available: true,
      is_draft: false,
    });

    it('merges provided fields and clamps to mrp when selling price is raised past it', async () => {
      productsRepo.findOne.mockResolvedValue(existingProduct());

      const result = await service.update('p1', 'biz-1', { sellingPrice: 200 } as any);

      expect(result.selling_price).toBe(150);
    });

    it('re-enables is_available when stock is restocked above zero without an explicit flag', async () => {
      productsRepo.findOne.mockResolvedValue({ ...existingProduct(), is_available: false, stock_quantity: 0 });

      const result = await service.update('p1', 'biz-1', { stockQuantity: 20 } as any);

      expect(result.is_available).toBe(true);
    });

    it('does not auto-disable is_available when stockQuantity is 0 and not explicitly set', async () => {
      productsRepo.findOne.mockResolvedValue({ ...existingProduct(), is_available: true });

      const result = await service.update('p1', 'biz-1', { stockQuantity: 0 } as any);

      expect(result.is_available).toBe(true);
    });

    it('respects an explicit isAvailable flag over the stock-based inference', async () => {
      productsRepo.findOne.mockResolvedValue({ ...existingProduct(), is_available: true });

      const result = await service.update('p1', 'biz-1', { isAvailable: false, stockQuantity: 20 } as any);

      expect(result.is_available).toBe(false);
    });

    it('syncs zero-priced draft order items when the price moves from zero to positive', async () => {
      productsRepo.findOne.mockResolvedValue({ ...existingProduct(), selling_price: 0 });

      await service.update('p1', 'biz-1', { sellingPrice: 50 } as any);

      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('does not sync draft order items when the price was already positive', async () => {
      productsRepo.findOne.mockResolvedValue(existingProduct());
      dataSource.transaction.mockClear();

      await service.update('p1', 'biz-1', { sellingPrice: 120 } as any);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the product does not exist', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.update('missing', 'biz-1', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('hard-deletes the product when possible', async () => {
      productsRepo.findOne.mockResolvedValue({ id: 'p1', business_id: 'biz-1' });
      productsRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove('p1', 'biz-1');

      expect(productsRepo.delete).toHaveBeenCalledWith('p1');
      expect(result).toEqual({ deleted: true });
    });

    it('falls back to a soft delete (archive) when the hard delete fails', async () => {
      productsRepo.findOne.mockResolvedValue({ id: 'p1', business_id: 'biz-1' });
      productsRepo.delete.mockRejectedValue(new Error('FK constraint'));

      const result = await service.remove('p1', 'biz-1');

      expect(productsRepo.update).toHaveBeenCalledWith('p1', { is_archived: true });
      expect(result).toEqual({ deleted: true, softDeleted: true });
    });

    it('throws NotFoundException when the product does not exist', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('mergeProducts', () => {
    it('throws BadRequestException when keepId equals removeId', async () => {
      await expect(service.mergeProducts('biz-1', 'p1', 'p1')).rejects.toThrow(BadRequestException);
    });

    it('reassigns references, folds in stock, deletes the removed product, and returns a summary', async () => {
      productsRepo.findOne
        .mockResolvedValueOnce({ id: 'keep-1', business_id: 'biz-1' })
        .mockResolvedValueOnce({ id: 'remove-1', business_id: 'biz-1', stock_quantity: 5 });

      const result = await service.mergeProducts('biz-1', 'keep-1', 'remove-1');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result).toEqual({ merged: true, keptProductId: 'keep-1', removedProductId: 'remove-1' });
    });

    it('throws NotFoundException when the product to keep does not exist', async () => {
      productsRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.mergeProducts('biz-1', 'missing', 'remove-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('adjustStock', () => {
    it('applies a positive delta to stock_quantity', async () => {
      productsRepo.findOne.mockResolvedValue({ id: 'p1', business_id: 'biz-1', stock_quantity: 10 });

      const result = await service.adjustStock('p1', 'biz-1', 5);

      expect(result.stock_quantity).toBe(15);
    });

    it('applies a negative delta to stock_quantity', async () => {
      productsRepo.findOne.mockResolvedValue({ id: 'p1', business_id: 'biz-1', stock_quantity: 10 });

      const result = await service.adjustStock('p1', 'biz-1', -3);

      expect(result.stock_quantity).toBe(7);
    });

    it('throws NotFoundException when the product does not exist', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.adjustStock('missing', 'biz-1', 1)).rejects.toThrow(NotFoundException);
    });
  });
});
