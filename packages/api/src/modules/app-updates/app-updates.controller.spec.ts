import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AppUpdatesController } from './app-updates.controller';
import { AppUpdatesService } from './app-updates.service';

describe('AppUpdatesController', () => {
  let controller: AppUpdatesController;
  let service: jest.Mocked<AppUpdatesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppUpdatesController],
      providers: [
        { provide: AppUpdatesService, useValue: { getLatest: jest.fn(), list: jest.fn(), create: jest.fn(), setActive: jest.fn() } },
      ],
    }).compile();

    controller = module.get(AppUpdatesController);
    service = module.get(AppUpdatesService);
  });

  it('getLatest defaults platform to android', () => {
    controller.getLatest(undefined as any);
    expect(service.getLatest).toHaveBeenCalledWith('android');
  });

  it('getLatest passes through an explicit platform', () => {
    controller.getLatest('android-playstore');
    expect(service.getLatest).toHaveBeenCalledWith('android-playstore');
  });

  it('list delegates to the service', () => {
    controller.list('android');
    expect(service.list).toHaveBeenCalledWith('android');
  });

  describe('create', () => {
    const file = { buffer: Buffer.from('x'), originalname: 'bundle.zip', mimetype: 'application/zip' };

    it('delegates to the service with defaulted platform', () => {
      controller.create(file, { version: '1.0.0' });
      expect(service.create).toHaveBeenCalledWith(file, { platform: 'android', version: '1.0.0', minNativeVersion: undefined, notes: undefined });
    });

    it('throws BadRequestException when no file is provided', () => {
      expect(() => controller.create(undefined as any, { version: '1.0.0' })).toThrow(BadRequestException);
    });
  });

  it('setActive delegates to the service', () => {
    controller.setActive('release-1', { isActive: false });
    expect(service.setActive).toHaveBeenCalledWith('release-1', false);
  });
});
