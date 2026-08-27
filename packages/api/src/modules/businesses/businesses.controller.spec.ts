import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { AuthService } from '../auth/auth.service';

const sendMock = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

describe('BusinessesController', () => {
  let controller: BusinessesController;
  let service: jest.Mocked<BusinessesService>;
  let authService: jest.Mocked<AuthService>;

  const req = { user: { userId: 'user-1', businessId: 'biz-1' } };

  beforeEach(async () => {
    sendMock.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessesController],
      providers: [
        {
          provide: BusinessesService,
          useValue: {
            onboard: jest.fn(),
            findMine: jest.fn(),
            selectActive: jest.fn(),
            create: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            updateLogo: jest.fn(),
            removeLogo: jest.fn(),
            updateUpiQr: jest.fn(),
            removeUpiQr: jest.fn(),
            deleteAccount: jest.fn(),
          },
        },
        { provide: AuthService, useValue: { reissueTokensForUser: jest.fn() } },
      ],
    }).compile();

    controller = module.get(BusinessesController);
    service = module.get(BusinessesService);
    authService = module.get(AuthService);
  });

  it('onboard creates the business and reissues tokens', async () => {
    (service.onboard as jest.Mock).mockResolvedValue({ id: 'biz-1' });
    (authService.reissueTokensForUser as jest.Mock).mockResolvedValue({ access_token: 't' });

    const result = await controller.onboard(req, { name: 'Acme' } as any);

    expect(service.onboard).toHaveBeenCalledWith('user-1', { name: 'Acme' });
    expect(authService.reissueTokensForUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ business: { id: 'biz-1' }, access_token: 't' });
  });

  it('findMine delegates to the service with the caller id', () => {
    controller.findMine(req);
    expect(service.findMine).toHaveBeenCalledWith('user-1');
  });

  it('select switches the active business and reissues tokens', async () => {
    (service.selectActive as jest.Mock).mockResolvedValue({ id: 'biz-2' });
    (authService.reissueTokensForUser as jest.Mock).mockResolvedValue({ access_token: 't2' });

    const result = await controller.select(req, 'biz-2');

    expect(service.selectActive).toHaveBeenCalledWith('user-1', 'biz-2');
    expect(result).toEqual({ business: { id: 'biz-2' }, access_token: 't2' });
  });

  it('create delegates to the service with the caller as owner', () => {
    controller.create(req, { name: 'Acme' } as any);
    expect(service.create).toHaveBeenCalledWith({ name: 'Acme' }, 'user-1');
  });

  it('findOne delegates with the caller id and business scope', () => {
    controller.findOne(req, 'biz-1');
    expect(service.findOne).toHaveBeenCalledWith('biz-1', 'user-1', 'biz-1');
  });

  it('update delegates to the service', () => {
    controller.update(req, 'biz-1', { name: 'New' } as any);
    expect(service.update).toHaveBeenCalledWith('biz-1', { name: 'New' }, 'user-1');
  });

  it('removeLogo delegates to the service', () => {
    controller.removeLogo(req, 'biz-1');
    expect(service.removeLogo).toHaveBeenCalledWith('biz-1', 'user-1');
  });

  it('removeUpiQr delegates to the service', () => {
    controller.removeUpiQr(req, 'biz-1');
    expect(service.removeUpiQr).toHaveBeenCalledWith('biz-1', 'user-1');
  });

  it('deleteAccount delegates with the confirmation name from the body', () => {
    controller.deleteAccount(req, 'biz-1', 'Acme Shop');
    expect(service.deleteAccount).toHaveBeenCalledWith('biz-1', 'user-1', 'Acme Shop');
  });

  describe('uploadLogo', () => {
    const file = { originalname: 'logo.png', mimetype: 'image/png', buffer: Buffer.from('data') };

    it('uploads to S3 and updates the business logo url', async () => {
      (service.updateLogo as jest.Mock).mockResolvedValue({ id: 'biz-1', logo_url: 'https://x/logos/foo.png' });

      const result = await controller.uploadLogo(req, 'biz-1', file);

      expect(sendMock).toHaveBeenCalled();
      expect(service.updateLogo).toHaveBeenCalledWith(
        'biz-1',
        expect.stringContaining('business-branding/logos/'),
        'user-1',
      );
      expect(result).toEqual({ id: 'biz-1', logo_url: 'https://x/logos/foo.png' });
    });

    it('throws BadRequestException when no file is provided', async () => {
      await expect(controller.uploadLogo(req, 'biz-1', undefined as any)).rejects.toThrow(BadRequestException);
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  describe('uploadUpiQr', () => {
    const file = { originalname: 'qr.png', mimetype: 'image/png', buffer: Buffer.from('data') };

    it('uploads to S3 and updates the business UPI QR url', async () => {
      (service.updateUpiQr as jest.Mock).mockResolvedValue({ id: 'biz-1', upi_qr_url: 'https://x/upi-qr/foo.png' });

      const result = await controller.uploadUpiQr(req, 'biz-1', file);

      expect(sendMock).toHaveBeenCalled();
      expect(service.updateUpiQr).toHaveBeenCalledWith(
        'biz-1',
        expect.stringContaining('business-branding/upi-qr/'),
        'user-1',
      );
      expect(result).toEqual({ id: 'biz-1', upi_qr_url: 'https://x/upi-qr/foo.png' });
    });

    it('throws BadRequestException when no file is provided', async () => {
      await expect(controller.uploadUpiQr(req, 'biz-1', undefined as any)).rejects.toThrow(BadRequestException);
      expect(sendMock).not.toHaveBeenCalled();
    });
  });
});
