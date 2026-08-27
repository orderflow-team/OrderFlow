import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AppApkReleasesController } from './app-apk-releases.controller';
import { AppApkReleasesService } from './app-apk-releases.service';

describe('AppApkReleasesController', () => {
  let controller: AppApkReleasesController;
  let service: jest.Mocked<AppApkReleasesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppApkReleasesController],
      providers: [
        {
          provide: AppApkReleasesService,
          useValue: { getLatest: jest.fn(), getDownloadUrl: jest.fn(), list: jest.fn(), create: jest.fn(), setActive: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(AppApkReleasesController);
    service = module.get(AppApkReleasesService);
  });

  it('getLatest defaults platform to android', () => {
    controller.getLatest(undefined as any);
    expect(service.getLatest).toHaveBeenCalledWith('android');
  });

  it('download redirects to the resolved download url', async () => {
    (service.getDownloadUrl as jest.Mock).mockResolvedValue('https://x/app.apk');

    const result = await controller.download('android');

    expect(result).toEqual({ url: 'https://x/app.apk', statusCode: 302 });
  });

  it('download defaults platform to android', async () => {
    (service.getDownloadUrl as jest.Mock).mockResolvedValue('https://x/app.apk');

    await controller.download(undefined as any);

    expect(service.getDownloadUrl).toHaveBeenCalledWith('android');
  });

  it('list delegates to the service', () => {
    controller.list('android');
    expect(service.list).toHaveBeenCalledWith('android');
  });

  describe('create', () => {
    const file = { buffer: Buffer.from('x'), originalname: 'app.apk', mimetype: 'application/vnd.android.package-archive' };

    it('delegates to the service with defaulted platform', () => {
      controller.create(file, { versionName: '1.0.0' });
      expect(service.create).toHaveBeenCalledWith(file, { platform: 'android', versionName: '1.0.0', notes: undefined });
    });

    it('throws BadRequestException when no file is provided', () => {
      expect(() => controller.create(undefined as any, { versionName: '1.0.0' })).toThrow(BadRequestException);
    });
  });

  it('setActive delegates to the service', () => {
    controller.setActive('apk-1', { isActive: false });
    expect(service.setActive).toHaveBeenCalledWith('apk-1', false);
  });
});
