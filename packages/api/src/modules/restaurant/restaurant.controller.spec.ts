import { Test, TestingModule } from '@nestjs/testing';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';

describe('RestaurantController', () => {
  let controller: RestaurantController;
  let service: jest.Mocked<RestaurantService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestaurantController],
      providers: [
        {
          provide: RestaurantService,
          useValue: {
            createTable: jest.fn(),
            findAllTables: jest.fn(),
            updateTableStatus: jest.fn(),
            releaseTable: jest.fn(),
            deleteTable: jest.fn(),
            createKot: jest.fn(),
            findAllKots: jest.fn(),
            updateKotStatus: jest.fn(),
            createKitchenStaffLogin: jest.fn(),
            listKitchenStaff: jest.fn(),
            getKitchenStaffCredentials: jest.fn(),
            updateKitchenStaffLogin: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(RestaurantController);
    service = module.get(RestaurantService);
  });

  it('createTable delegates to the service', () => {
    const dto = { businessId: 'biz-1', name: 'Table 1' } as any;
    controller.createTable(dto);
    expect(service.createTable).toHaveBeenCalledWith(dto);
  });

  it('findAllTables delegates to the service', () => {
    controller.findAllTables('biz-1', 'available');
    expect(service.findAllTables).toHaveBeenCalledWith('biz-1', 'available');
  });

  it('updateTableStatus delegates to the service', () => {
    const dto = { status: 'occupied' } as any;
    controller.updateTableStatus('table-1', 'biz-1', dto);
    expect(service.updateTableStatus).toHaveBeenCalledWith('table-1', 'biz-1', dto);
  });

  it('releaseTable delegates to the service', () => {
    controller.releaseTable('table-1', 'biz-1');
    expect(service.releaseTable).toHaveBeenCalledWith('table-1', 'biz-1');
  });

  it('deleteTable delegates to the service', () => {
    controller.deleteTable('table-1', 'biz-1');
    expect(service.deleteTable).toHaveBeenCalledWith('table-1', 'biz-1');
  });

  it('createKot delegates to the service', () => {
    const dto = { businessId: 'biz-1', orderId: 'order-1' } as any;
    controller.createKot(dto);
    expect(service.createKot).toHaveBeenCalledWith(dto);
  });

  it('findAllKots delegates to the service', () => {
    controller.findAllKots('biz-1', 'pending');
    expect(service.findAllKots).toHaveBeenCalledWith('biz-1', 'pending');
  });

  it('updateKotStatus delegates to the service', () => {
    const dto = { status: 'preparing' } as any;
    controller.updateKotStatus('kot-1', 'biz-1', dto);
    expect(service.updateKotStatus).toHaveBeenCalledWith('kot-1', 'biz-1', dto);
  });

  it('createKitchenStaffLogin delegates to the service', () => {
    const dto = { email: 'a@b.com', password: 'x', name: 'Cook' } as any;
    controller.createKitchenStaffLogin('biz-1', dto);
    expect(service.createKitchenStaffLogin).toHaveBeenCalledWith('biz-1', dto);
  });

  it('listKitchenStaff delegates to the service', () => {
    controller.listKitchenStaff('biz-1');
    expect(service.listKitchenStaff).toHaveBeenCalledWith('biz-1');
  });

  it('getKitchenStaffLogin delegates to the service', () => {
    controller.getKitchenStaffLogin('u1', 'biz-1');
    expect(service.getKitchenStaffCredentials).toHaveBeenCalledWith('u1', 'biz-1');
  });

  it('updateKitchenStaffLogin delegates to the service', () => {
    const dto = { name: 'New' } as any;
    controller.updateKitchenStaffLogin('u1', 'biz-1', dto);
    expect(service.updateKitchenStaffLogin).toHaveBeenCalledWith('u1', 'biz-1', dto);
  });
});
