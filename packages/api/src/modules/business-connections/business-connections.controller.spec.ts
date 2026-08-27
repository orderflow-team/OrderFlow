import { Test, TestingModule } from '@nestjs/testing';
import { BusinessConnectionsController } from './business-connections.controller';
import { BusinessConnectionsService } from './business-connections.service';

describe('BusinessConnectionsController', () => {
  let controller: BusinessConnectionsController;
  let service: jest.Mocked<BusinessConnectionsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessConnectionsController],
      providers: [
        {
          provide: BusinessConnectionsService,
          useValue: {
            request: jest.fn(),
            listForBusiness: jest.fn(),
            checkPhone: jest.fn(),
            accept: jest.fn(),
            resync: jest.fn(),
            reject: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(BusinessConnectionsController);
    service = module.get(BusinessConnectionsService);
  });

  it('request delegates to the service', () => {
    const dto = { businessId: 'biz-1', targetPhone: '123', role: 'retailer' } as any;
    controller.request(dto);
    expect(service.request).toHaveBeenCalledWith(dto);
  });

  it('list delegates to the service', () => {
    controller.list('biz-1');
    expect(service.listForBusiness).toHaveBeenCalledWith('biz-1');
  });

  it('checkPhone delegates to the service', () => {
    controller.checkPhone('biz-1', '9876543210');
    expect(service.checkPhone).toHaveBeenCalledWith('biz-1', '9876543210');
  });

  it('accept delegates to the service with the businessId from the dto', () => {
    controller.accept('conn-1', { businessId: 'biz-1' } as any);
    expect(service.accept).toHaveBeenCalledWith('conn-1', 'biz-1');
  });

  it('resync delegates to the service with the businessId from the dto', () => {
    controller.resync('conn-1', { businessId: 'biz-1' } as any);
    expect(service.resync).toHaveBeenCalledWith('conn-1', 'biz-1');
  });

  it('reject delegates to the service with the businessId from the dto', () => {
    controller.reject('conn-1', { businessId: 'biz-1' } as any);
    expect(service.reject).toHaveBeenCalledWith('conn-1', 'biz-1');
  });

  it('remove delegates to the service', () => {
    controller.remove('conn-1', 'biz-1');
    expect(service.remove).toHaveBeenCalledWith('conn-1', 'biz-1');
  });
});
