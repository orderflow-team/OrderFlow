import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: jest.Mocked<CategoriesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(CategoriesController);
    service = module.get(CategoriesService);
  });

  it('create delegates to the service', () => {
    const dto = { businessId: 'biz-1', name: 'Snacks' } as any;
    controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delegates with the businessId query param', () => {
    controller.findAll('biz-1');
    expect(service.findAll).toHaveBeenCalledWith('biz-1');
  });

  it('findOne delegates with id and businessId', () => {
    controller.findOne('cat-1', 'biz-1');
    expect(service.findOne).toHaveBeenCalledWith('cat-1', 'biz-1');
  });

  it('update delegates with id, businessId and dto', () => {
    const dto = { name: 'New' } as any;
    controller.update('cat-1', 'biz-1', dto);
    expect(service.update).toHaveBeenCalledWith('cat-1', 'biz-1', dto);
  });

  it('remove delegates with id and businessId', () => {
    controller.remove('cat-1', 'biz-1');
    expect(service.remove).toHaveBeenCalledWith('cat-1', 'biz-1');
  });
});
