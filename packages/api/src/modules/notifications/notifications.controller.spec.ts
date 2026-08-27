import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: {
            findAll: jest.fn(),
            markRead: jest.fn(),
            registerDeviceToken: jest.fn(),
            unregisterDeviceToken: jest.fn(),
            sendTestPush: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(NotificationsController);
    service = module.get(NotificationsService);
  });

  describe('findAll', () => {
    it('converts the unreadOnly query string to a boolean true', () => {
      controller.findAll('biz-1', 'true');
      expect(service.findAll).toHaveBeenCalledWith('biz-1', true);
    });

    it('converts any other unreadOnly value to false', () => {
      controller.findAll('biz-1', 'false');
      expect(service.findAll).toHaveBeenCalledWith('biz-1', false);
    });

    it('defaults to false when unreadOnly is omitted', () => {
      controller.findAll('biz-1');
      expect(service.findAll).toHaveBeenCalledWith('biz-1', false);
    });
  });

  it('markRead delegates to the service', () => {
    controller.markRead('n1', 'biz-1');
    expect(service.markRead).toHaveBeenCalledWith('n1', 'biz-1');
  });

  it('registerDeviceToken delegates with the caller userId and defaults platform to android', () => {
    const req = { user: { userId: 'user-1' } };
    controller.registerDeviceToken(req, { businessId: 'biz-1', token: 'tok-1' } as any);
    expect(service.registerDeviceToken).toHaveBeenCalledWith('biz-1', 'user-1', 'tok-1', 'android');
  });

  it('registerDeviceToken respects an explicit platform', () => {
    const req = { user: { userId: 'user-1' } };
    controller.registerDeviceToken(req, { businessId: 'biz-1', token: 'tok-1', platform: 'ios' } as any);
    expect(service.registerDeviceToken).toHaveBeenCalledWith('biz-1', 'user-1', 'tok-1', 'ios');
  });

  it('unregisterDeviceToken delegates to the service', () => {
    controller.unregisterDeviceToken({ businessId: 'biz-1', token: 'tok-1' });
    expect(service.unregisterDeviceToken).toHaveBeenCalledWith('biz-1', 'tok-1');
  });

  it('sendTestPush delegates to the service', () => {
    controller.sendTestPush({ businessId: 'biz-1' });
    expect(service.sendTestPush).toHaveBeenCalledWith('biz-1');
  });
});
