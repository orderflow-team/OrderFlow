import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

const sendMock = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: jest.Mocked<ProductsService>;

  beforeEach(async () => {
    sendMock.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: {
            create: jest.fn(),
            createWithVariants: jest.fn(),
            findAll: jest.fn(),
            findAllPaginated: jest.fn(),
            getBarcodeSuggestion: jest.fn(),
            getStats: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            mergeProducts: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ProductsController);
    service = module.get(ProductsService);
  });

  describe('uploadFile', () => {
    it('uploads to S3 and returns the public url', async () => {
      const file = { originalname: 'photo.png', mimetype: 'image/png', buffer: Buffer.from('x') };

      const result = await controller.uploadFile(file);

      expect(sendMock).toHaveBeenCalled();
      expect(result.url).toContain('product-images/');
    });

    it('throws BadRequestException when no file is provided', async () => {
      await expect(controller.uploadFile(undefined as any)).rejects.toThrow(BadRequestException);
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  it('createWithVariants delegates to the service', () => {
    const dto = { businessId: 'biz-1', name: 'Oil', variants: [] } as any;
    controller.createWithVariants(dto);
    expect(service.createWithVariants).toHaveBeenCalledWith(dto);
  });

  it('create delegates to the service', () => {
    const dto = { businessId: 'biz-1', name: 'Widget', sellingPrice: 10 } as any;
    controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  describe('findAll', () => {
    it('calls the unbounded findAll when limit/offset are omitted', async () => {
      (service.findAll as jest.Mock).mockResolvedValue([{ id: 'p1' }]);

      const result = await controller.findAll('biz-1', 'search', 'false', undefined, undefined, undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith('biz-1', 'search', 'false');
      expect(result).toEqual([{ id: 'p1' }]);
    });

    it('calls findAllPaginated and sets X-Total-Count when limit/offset are provided', async () => {
      (service.findAllPaginated as jest.Mock).mockResolvedValue({ products: [{ id: 'p1' }], total: 7 });
      const res = { setHeader: jest.fn() } as any;

      const result = await controller.findAll('biz-1', undefined, undefined, '5', '0', 'Snacks', res);

      expect(service.findAllPaginated).toHaveBeenCalledWith('biz-1', undefined, undefined, 5, 0, 'Snacks');
      expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', '7');
      expect(result).toEqual([{ id: 'p1' }]);
    });
  });

  it('getBarcodeSuggestion delegates to the service', () => {
    controller.getBarcodeSuggestion('12345');
    expect(service.getBarcodeSuggestion).toHaveBeenCalledWith('12345');
  });

  it('getStats delegates to the service', () => {
    controller.getStats('biz-1', 'search', 'false');
    expect(service.getStats).toHaveBeenCalledWith('biz-1', 'search', 'false');
  });

  it('findOne delegates to the service', () => {
    controller.findOne('p1', 'biz-1');
    expect(service.findOne).toHaveBeenCalledWith('p1', 'biz-1');
  });

  it('update delegates to the service', () => {
    const dto = { name: 'New' } as any;
    controller.update('p1', 'biz-1', dto);
    expect(service.update).toHaveBeenCalledWith('p1', 'biz-1', dto);
  });

  it('remove delegates to the service', () => {
    controller.remove('p1', 'biz-1');
    expect(service.remove).toHaveBeenCalledWith('p1', 'biz-1');
  });

  it('merge delegates to the service with the dto fields spread positionally', () => {
    const dto = { businessId: 'biz-1', keepProductId: 'keep-1', removeProductId: 'remove-1' };
    controller.merge(dto as any);
    expect(service.mergeProducts).toHaveBeenCalledWith('biz-1', 'keep-1', 'remove-1');
  });
});
