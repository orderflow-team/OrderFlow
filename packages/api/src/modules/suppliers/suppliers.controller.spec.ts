import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

describe('SuppliersController', () => {
  let controller: SuppliersController;
  let service: jest.Mocked<SuppliersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuppliersController],
      providers: [
        {
          provide: SuppliersService,
          useValue: { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), remove: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(SuppliersController);
    service = module.get(SuppliersService);
  });

  it('create delegates to the service', () => {
    const dto = { businessId: 'biz-1', name: 'Acme' } as any;
    controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delegates with the businessId query param', () => {
    controller.findAll('biz-1');
    expect(service.findAll).toHaveBeenCalledWith('biz-1');
  });

  it('findOne delegates with id and businessId', () => {
    controller.findOne('s1', 'biz-1');
    expect(service.findOne).toHaveBeenCalledWith('s1', 'biz-1');
  });

  it('update delegates with id, businessId and dto', () => {
    const dto = { name: 'New' } as any;
    controller.update('s1', 'biz-1', dto);
    expect(service.update).toHaveBeenCalledWith('s1', 'biz-1', dto);
  });

  it('remove delegates with id and businessId', () => {
    controller.remove('s1', 'biz-1');
    expect(service.remove).toHaveBeenCalledWith('s1', 'biz-1');
  });
});
