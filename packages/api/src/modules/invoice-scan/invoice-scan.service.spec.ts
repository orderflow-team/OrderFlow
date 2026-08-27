import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceScanService } from './invoice-scan.service';
import { InvoiceScan } from '../../database/entities/invoice-scan.entity';
import { InvoiceScanItem } from '../../database/entities/invoice-scan-item.entity';
import { InvoiceScanFile } from '../../database/entities/invoice-scan-file.entity';
import { Product } from '../../database/entities/product.entity';
import { InvoiceVisionParserService } from './services/invoice-vision-parser.service';
import { InventoryService } from '../inventory/inventory.service';

const getSignedUrlMock = jest.fn().mockResolvedValue('https://signed.example.com/x');
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: (...args: any[]) => getSignedUrlMock(...args) }));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  CopyObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

describe('InvoiceScanService', () => {
  let service: InvoiceScanService;
  let scansRepo: Record<string, jest.Mock>;
  let itemsRepo: Record<string, jest.Mock>;
  let filesRepo: Record<string, jest.Mock>;
  let productsRepo: Record<string, jest.Mock>;
  let visionParser: { parseInvoiceFile: jest.Mock };
  let inventoryService: Record<string, jest.Mock>;

  beforeEach(async () => {
    scansRepo = {
      create: jest.fn((entity) => ({ id: 'scan-new', status: 'processing', ...entity })),
      save: jest.fn(async (entity) => entity),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    itemsRepo = {
      create: jest.fn((entity) => ({ id: 'item-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      find: jest.fn(),
    };
    filesRepo = {
      create: jest.fn((entity) => ({ id: 'file-new', ...entity })),
      save: jest.fn(async (entity) => entity),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(),
    };
    productsRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn(async (entity) => ({ id: 'product-new', ...entity })),
      create: jest.fn((entity) => entity),
      update: jest.fn(),
    };
    visionParser = { parseInvoiceFile: jest.fn() };
    inventoryService = {
      createPurchaseOrder: jest.fn(),
      receivePurchaseOrder: jest.fn(),
      findOnePurchaseOrder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceScanService,
        { provide: getRepositoryToken(InvoiceScan), useValue: scansRepo },
        { provide: getRepositoryToken(InvoiceScanItem), useValue: itemsRepo },
        { provide: getRepositoryToken(InvoiceScanFile), useValue: filesRepo },
        { provide: getRepositoryToken(Product), useValue: productsRepo },
        { provide: InvoiceVisionParserService, useValue: visionParser },
        { provide: InventoryService, useValue: inventoryService },
      ],
    }).compile();

    service = module.get(InvoiceScanService);
  });

  describe('uploadAndParse', () => {
    const page = { fileUrl: 'https://x/invoice-scans-private/f1.png', fileBuffer: Buffer.from('x'), fileType: 'image', mimeType: 'image/png' };

    it('parses pages, matches existing products, and marks the scan ready', async () => {
      visionParser.parseInvoiceFile.mockResolvedValue([
        { productName: 'Widget', quantity: 5, schemeQuantity: null, unitPrice: 10, mrp: 15, batchNumber: null, expiryMonthYear: null },
      ]);
      productsRepo.find.mockResolvedValue([]);
      scansRepo.findOne.mockResolvedValue({ id: 'scan-new', business_id: 'biz-1', status: 'ready', file_url: page.fileUrl });
      itemsRepo.find.mockResolvedValue([]);

      const result = await service.uploadAndParse('biz-1', 'sup-1', [page]);

      expect(itemsRepo.save).toHaveBeenCalled();
      expect(scansRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }));
      expect(result).toBeDefined();
    });

    it('defaults included=true and is_duplicate=false when no matching product exists', async () => {
      visionParser.parseInvoiceFile.mockResolvedValue([
        { productName: 'Brand New Item', quantity: 1, schemeQuantity: null, unitPrice: 10, mrp: null, batchNumber: null, expiryMonthYear: null },
      ]);
      productsRepo.find.mockResolvedValue([]);
      scansRepo.findOne.mockResolvedValue({ id: 'scan-new', business_id: 'biz-1', file_url: page.fileUrl });
      itemsRepo.find.mockResolvedValue([]);

      await service.uploadAndParse('biz-1', undefined, [page]);

      expect(itemsRepo.create).toHaveBeenCalledWith(expect.objectContaining({ is_duplicate: false, included: true }));
    });

    it('excludes a duplicate-matched item that still has stock, but includes one that is out of stock', async () => {
      visionParser.parseInvoiceFile.mockResolvedValue([
        { productName: 'In Stock Item', quantity: 1, schemeQuantity: null, unitPrice: 10, mrp: null, batchNumber: null, expiryMonthYear: null },
        { productName: 'Out Of Stock Item', quantity: 1, schemeQuantity: null, unitPrice: 10, mrp: null, batchNumber: null, expiryMonthYear: null },
      ]);
      productsRepo.find.mockResolvedValue([
        { id: 'p1', name: 'In Stock Item', stock_quantity: 5 },
        { id: 'p2', name: 'Out Of Stock Item', stock_quantity: 0 },
      ]);
      scansRepo.findOne.mockResolvedValue({ id: 'scan-new', business_id: 'biz-1', file_url: page.fileUrl });
      itemsRepo.find.mockResolvedValue([]);

      await service.uploadAndParse('biz-1', undefined, [page]);

      expect(itemsRepo.create).toHaveBeenCalledWith(expect.objectContaining({ raw_product_name: 'In Stock Item', included: false }));
      expect(itemsRepo.create).toHaveBeenCalledWith(expect.objectContaining({ raw_product_name: 'Out Of Stock Item', included: true }));
    });

    it('throws BadRequestException and marks the scan failed when no line items are found', async () => {
      visionParser.parseInvoiceFile.mockResolvedValue([]);

      await expect(service.uploadAndParse('biz-1', undefined, [page])).rejects.toThrow(BadRequestException);
      expect(scansRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    });

    it('marks the scan failed and rethrows when the vision parser itself throws', async () => {
      visionParser.parseInvoiceFile.mockRejectedValue(new Error('vision failed'));

      await expect(service.uploadAndParse('biz-1', undefined, [page])).rejects.toThrow('vision failed');
      expect(scansRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error_message: 'vision failed' }));
    });
  });

  describe('findOne', () => {
    it('presigns the scan file and every page file url', async () => {
      scansRepo.findOne.mockResolvedValue({ id: 'scan-1', business_id: 'biz-1', file_url: 'https://x/invoice-scans-private/main.png' });
      itemsRepo.find.mockResolvedValue([{ id: 'item-1', is_duplicate: false, matched_product: null }]);
      filesRepo.find.mockResolvedValue([{ id: 'file-1', file_url: 'https://x/invoice-scans-private/p1.png' }]);

      const result = await service.findOne('scan-1', 'biz-1');

      expect(result.file_url).toBe('https://signed.example.com/x');
      expect(result.files[0].file_url).toBe('https://signed.example.com/x');
    });

    it('overrides included=true for a duplicate-matched item now out of stock', async () => {
      scansRepo.findOne.mockResolvedValue({ id: 'scan-1', business_id: 'biz-1', file_url: 'https://x/y.png' });
      itemsRepo.find.mockResolvedValue([
        { id: 'item-1', is_duplicate: true, included: false, matched_product: { stock_quantity: 0 } },
      ]);

      const result = await service.findOne('scan-1', 'biz-1');

      expect(result.items[0].included).toBe(true);
    });

    it('throws NotFoundException when the scan does not exist', async () => {
      scansRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('presigns every scan file url', async () => {
      scansRepo.find.mockResolvedValue([{ id: 'scan-1', file_url: 'https://x/invoice-scans-private/y.png' }]);

      const result = await service.findAll('biz-1');

      expect(result[0].file_url).toBe('https://signed.example.com/x');
    });
  });

  describe('confirm', () => {
    const baseDto = () => ({
      businessId: 'biz-1',
      supplierId: undefined,
      items: [{ id: 'row-1', included: true, productName: 'Widget', quantity: 5, unitPrice: 10, mrp: 15 }],
    });

    it('throws NotFoundException when the scan does not exist', async () => {
      scansRepo.findOne.mockResolvedValue(null);

      await expect(service.confirm('missing', baseDto() as any)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the scan is already confirmed', async () => {
      scansRepo.findOne.mockResolvedValue({ id: 'scan-1', business_id: 'biz-1', status: 'confirmed' });

      await expect(service.confirm('scan-1', baseDto() as any)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no items are included', async () => {
      scansRepo.findOne.mockResolvedValue({ id: 'scan-1', business_id: 'biz-1', status: 'ready' });

      await expect(
        service.confirm('scan-1', { ...baseDto(), items: [{ ...baseDto().items[0], included: false }] } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a new product when no matchedProductId is given, and confirms via the inventory flow', async () => {
      scansRepo.findOne.mockResolvedValue({ id: 'scan-1', business_id: 'biz-1', status: 'ready', supplier_id: null });
      inventoryService.createPurchaseOrder.mockResolvedValue({ id: 'po-1' });
      inventoryService.findOnePurchaseOrder.mockResolvedValue({ id: 'po-1', items: [] });

      const result = await service.confirm('scan-1', baseDto() as any);

      expect(productsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Widget', purchase_price: 10, selling_price: 15 }));
      expect(inventoryService.createPurchaseOrder).toHaveBeenCalledWith(
        expect.objectContaining({ businessId: 'biz-1', items: [expect.objectContaining({ productId: 'product-new', quantity: 5 })] }),
      );
      expect(inventoryService.receivePurchaseOrder).toHaveBeenCalledWith('po-1', 'biz-1');
      expect(scansRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'confirmed', purchase_order_id: 'po-1' }));
      expect(result).toEqual({ id: 'po-1', items: [] });
    });

    it('updates an existing matched product when its details changed', async () => {
      scansRepo.findOne.mockResolvedValue({ id: 'scan-1', business_id: 'biz-1', status: 'ready' });
      productsRepo.findOne.mockResolvedValue({ id: 'existing-p1', name: 'Old Name', purchase_price: 5, selling_price: 6, batch_number: null, expiry_date: null });
      inventoryService.createPurchaseOrder.mockResolvedValue({ id: 'po-1' });
      inventoryService.findOnePurchaseOrder.mockResolvedValue({ id: 'po-1' });

      const dto = {
        businessId: 'biz-1',
        items: [{ id: 'row-1', included: true, productName: 'New Name', matchedProductId: 'existing-p1', quantity: 3, unitPrice: 10, mrp: 15 }],
      };

      await service.confirm('scan-1', dto as any);

      expect(productsRepo.update).toHaveBeenCalledWith(
        { id: 'existing-p1' },
        expect.objectContaining({ name: 'New Name', purchase_price: 10, selling_price: 15 }),
      );
    });

    it('does not call update when the matched product has no actual changes', async () => {
      scansRepo.findOne.mockResolvedValue({ id: 'scan-1', business_id: 'biz-1', status: 'ready' });
      productsRepo.findOne.mockResolvedValue({ id: 'existing-p1', name: 'Widget', purchase_price: 10, selling_price: 15, batch_number: null, expiry_date: null });
      inventoryService.createPurchaseOrder.mockResolvedValue({ id: 'po-1' });
      inventoryService.findOnePurchaseOrder.mockResolvedValue({ id: 'po-1' });

      const dto = {
        businessId: 'biz-1',
        items: [{ id: 'row-1', included: true, productName: 'Widget', matchedProductId: 'existing-p1', quantity: 3, unitPrice: 10, mrp: 15 }],
      };

      await service.confirm('scan-1', dto as any);

      expect(productsRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('migrateLegacyBucket', () => {
    it('migrates scans and files still pointing at the legacy bucket', async () => {
      const legacyScan = { id: 'scan-1', file_url: 'https://x/invoice-scans/old.png' };
      const legacyFile = { id: 'file-1', file_url: 'https://x/invoice-scans/old2.png' };
      scansRepo.createQueryBuilder.mockReturnValue({ where: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([legacyScan]) });
      filesRepo.createQueryBuilder.mockReturnValue({ where: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([legacyFile]) });

      const result = await service.migrateLegacyBucket();

      expect(result).toEqual({ migrated: 2, failed: 0 });
      expect(scansRepo.save).toHaveBeenCalledWith(expect.objectContaining({ file_url: expect.stringContaining('invoice-scans-private') }));
    });

    it('is a no-op when nothing references the legacy bucket', async () => {
      scansRepo.createQueryBuilder.mockReturnValue({ where: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) });
      filesRepo.createQueryBuilder.mockReturnValue({ where: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) });

      const result = await service.migrateLegacyBucket();

      expect(result).toEqual({ migrated: 0, failed: 0 });
    });
  });
});
