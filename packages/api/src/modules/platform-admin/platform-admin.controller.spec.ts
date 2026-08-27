import { Test, TestingModule } from '@nestjs/testing';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';

describe('PlatformAdminController', () => {
  let controller: PlatformAdminController;
  let service: jest.Mocked<PlatformAdminService>;

  const req = { user: { userId: 'admin-1' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformAdminController],
      providers: [
        {
          provide: PlatformAdminService,
          useValue: {
            getOverviewStats: jest.fn(),
            getAllUsers: jest.fn(),
            getStoresForUser: jest.fn(),
            updateUser: jest.fn(),
            toggleUserStatus: jest.fn(),
            getAllStores: jest.fn(),
            updateStore: jest.fn(),
            sendTestPush: jest.fn(),
            sendCustomPush: jest.fn(),
            deleteStore: jest.fn(),
            getActivityLogs: jest.fn(),
            getProductsOverview: jest.fn(),
            getGlobalOrders: jest.fn(),
            getBusinessConnections: jest.fn(),
            getSystemHealth: jest.fn(),
            getLiveUsers: jest.fn(),
            getAnnouncement: jest.fn(),
            setAnnouncement: jest.fn(),
            getMaintenanceStatus: jest.fn(),
            setMaintenanceMode: jest.fn(),
            impersonateStore: jest.fn(),
            exportSystemSnapshot: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PlatformAdminController);
    service = module.get(PlatformAdminService);
  });

  it('getOverview delegates to the service', () => {
    controller.getOverview();
    expect(service.getOverviewStats).toHaveBeenCalled();
  });

  it('getAllUsers delegates with every query param', () => {
    controller.getAllUsers('neel', 'admin', 'biz-1', 'true', 2, 10);
    expect(service.getAllUsers).toHaveBeenCalledWith({ search: 'neel', role: 'admin', business_id: 'biz-1', is_active: 'true', page: 2, limit: 10 });
  });

  it('getStoresForUser delegates to the service', () => {
    controller.getStoresForUser('user-1');
    expect(service.getStoresForUser).toHaveBeenCalledWith('user-1');
  });

  it('updateUser delegates with the caller admin id', () => {
    const dto = { full_name: 'New' };
    controller.updateUser('user-1', dto, req);
    expect(service.updateUser).toHaveBeenCalledWith('user-1', dto, 'admin-1');
  });

  it('toggleUserStatus delegates with the caller admin id', () => {
    controller.toggleUserStatus('user-1', false, req);
    expect(service.toggleUserStatus).toHaveBeenCalledWith('user-1', false, 'admin-1');
  });

  it('getAllStores delegates to the service', () => {
    controller.getAllStores('acme', 'pharmacy', 1, 20);
    expect(service.getAllStores).toHaveBeenCalledWith({ search: 'acme', category: 'pharmacy', page: 1, limit: 20 });
  });

  it('updateStore delegates with the caller admin id', () => {
    const dto = { name: 'New Store' };
    controller.updateStore('biz-1', dto, req);
    expect(service.updateStore).toHaveBeenCalledWith('biz-1', dto, 'admin-1');
  });

  it('sendTestPush delegates with the caller admin id', () => {
    controller.sendTestPush('biz-1', req);
    expect(service.sendTestPush).toHaveBeenCalledWith('biz-1', 'admin-1');
  });

  it('sendCustomPush defaults a missing businessId to null (broadcast)', () => {
    controller.sendCustomPush({ title: 'Hi', message: 'Hello' }, req);
    expect(service.sendCustomPush).toHaveBeenCalledWith(null, 'Hi', 'Hello', 'admin-1');
  });

  it('sendCustomPush passes through an explicit businessId', () => {
    controller.sendCustomPush({ businessId: 'biz-1', title: 'Hi', message: 'Hello' }, req);
    expect(service.sendCustomPush).toHaveBeenCalledWith('biz-1', 'Hi', 'Hello', 'admin-1');
  });

  it('deleteStore delegates with the caller admin id', () => {
    controller.deleteStore('biz-1', req);
    expect(service.deleteStore).toHaveBeenCalledWith('biz-1', 'admin-1');
  });

  it('getActivityLogs delegates to the service', () => {
    controller.getActivityLogs('UPDATE_USER', 'neel', 1, 20);
    expect(service.getActivityLogs).toHaveBeenCalledWith({ action: 'UPDATE_USER', search: 'neel', page: 1, limit: 20 });
  });

  it('getProductsOverview delegates to the service', () => {
    controller.getProductsOverview('widget', 'pharmacy', 'biz-1', 1, 12);
    expect(service.getProductsOverview).toHaveBeenCalledWith({ search: 'widget', category: 'pharmacy', business_id: 'biz-1', page: 1, limit: 12 });
  });

  it('getGlobalOrders delegates to the service', () => {
    controller.getGlobalOrders('neel', 'paid', 'biz-1', 'manual', 1, 15);
    expect(service.getGlobalOrders).toHaveBeenCalledWith({ search: 'neel', status: 'paid', business_id: 'biz-1', origin: 'manual', page: 1, limit: 15 });
  });

  it('getBusinessConnections delegates to the service', () => {
    controller.getBusinessConnections('acme', 'accepted', 1, 20);
    expect(service.getBusinessConnections).toHaveBeenCalledWith({ search: 'acme', status: 'accepted', page: 1, limit: 20 });
  });

  it('getSystemHealth delegates to the service', () => {
    controller.getSystemHealth();
    expect(service.getSystemHealth).toHaveBeenCalled();
  });

  it('getLiveUsers delegates to the service', () => {
    controller.getLiveUsers();
    expect(service.getLiveUsers).toHaveBeenCalled();
  });

  it('getAnnouncement delegates to the service', () => {
    controller.getAnnouncement();
    expect(service.getAnnouncement).toHaveBeenCalled();
  });

  it('setAnnouncement delegates to the service', () => {
    const dto = { active: true, message: 'Hi' };
    controller.setAnnouncement(dto);
    expect(service.setAnnouncement).toHaveBeenCalledWith(dto);
  });

  it('getMaintenanceStatus delegates to the service', () => {
    controller.getMaintenanceStatus();
    expect(service.getMaintenanceStatus).toHaveBeenCalled();
  });

  it('setMaintenanceMode delegates to the service', () => {
    const dto = { active: true, message: 'Down' };
    controller.setMaintenanceMode(dto);
    expect(service.setMaintenanceMode).toHaveBeenCalledWith(dto);
  });

  it('impersonateStore delegates to the service', () => {
    controller.impersonateStore('biz-1');
    expect(service.impersonateStore).toHaveBeenCalledWith('biz-1');
  });

  it('exportSystemSnapshot delegates to the service', () => {
    controller.exportSystemSnapshot();
    expect(service.exportSystemSnapshot).toHaveBeenCalled();
  });
});
