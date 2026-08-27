import { Test, TestingModule } from '@nestjs/testing';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

describe('CustomersController', () => {
  let controller: CustomersController;
  let service: jest.Mocked<CustomersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        {
          provide: CustomersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findAllPaginated: jest.fn(),
            getStats: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(CustomersController);
    service = module.get(CustomersService);
  });

  it('create delegates to the service', () => {
    const dto = { businessId: 'biz-1', name: 'Acme' } as any;
    controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  describe('findAll', () => {
    it('calls the unbounded findAll when no pagination params are supplied', async () => {
      (service.findAll as jest.Mock).mockResolvedValue([{ id: 'c1' }]);

      const result = await controller.findAll('biz-1', undefined, undefined, undefined, undefined);

      expect(service.findAll).toHaveBeenCalledWith('biz-1');
      expect(service.findAllPaginated).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: 'c1' }]);
    });

    it('calls findAllPaginated and sets the total-count header when pagination params are supplied', async () => {
      (service.findAllPaginated as jest.Mock).mockResolvedValue({ customers: [{ id: 'c1' }], total: 42 });
      const res = { setHeader: jest.fn() } as any;

      const result = await controller.findAll('biz-1', '10', '0', 'acme', res);

      expect(service.findAllPaginated).toHaveBeenCalledWith('biz-1', 'acme', 10, 0);
      expect(res.setHeader).toHaveBeenCalledWith('X-Total-Count', '42');
      expect(result).toEqual([{ id: 'c1' }]);
    });

    it('triggers pagination when only search is supplied (limit/offset stay undefined)', async () => {
      (service.findAllPaginated as jest.Mock).mockResolvedValue({ customers: [], total: 0 });
      const res = { setHeader: jest.fn() } as any;

      await controller.findAll('biz-1', undefined, undefined, 'acme', res);

      expect(service.findAllPaginated).toHaveBeenCalledWith('biz-1', 'acme', undefined, undefined);
    });
  });

  it('getStats delegates to the service', () => {
    controller.getStats('biz-1');
    expect(service.getStats).toHaveBeenCalledWith('biz-1');
  });

  it('findOne delegates with id and businessId', () => {
    controller.findOne('c1', 'biz-1');
    expect(service.findOne).toHaveBeenCalledWith('c1', 'biz-1');
  });

  it('update delegates with id, businessId and dto', () => {
    const dto = { name: 'New' } as any;
    controller.update('c1', 'biz-1', dto);
    expect(service.update).toHaveBeenCalledWith('c1', 'biz-1', dto);
  });

  it('remove delegates with id and businessId', () => {
    controller.remove('c1', 'biz-1');
    expect(service.remove).toHaveBeenCalledWith('c1', 'biz-1');
  });
});
