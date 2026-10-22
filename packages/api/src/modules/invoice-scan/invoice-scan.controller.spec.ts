import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InvoiceScanController } from './invoice-scan.controller';
import { InvoiceScanService } from './invoice-scan.service';

const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const HTML_BYTES = Buffer.from('<html><script>alert(1)</script></html>');

const sendMock = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

describe('InvoiceScanController', () => {
  let controller: InvoiceScanController;
  let service: jest.Mocked<InvoiceScanService>;

  beforeEach(async () => {
    sendMock.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceScanController],
      providers: [
        {
          provide: InvoiceScanService,
          useValue: { uploadAndParse: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), confirm: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(InvoiceScanController);
    service = module.get(InvoiceScanService);
  });

  describe('upload', () => {
    const PDF_BYTES = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(32)]);
    const file = (mimetype = 'image/png', buffer?: Buffer) => ({
      originalname: 'invoice.png',
      mimetype,
      buffer: buffer ?? (mimetype === 'application/pdf' ? PDF_BYTES : mimetype === 'image/png' ? PNG_BYTES : HTML_BYTES),
    });

    it('uploads each page to S3 and hands off to the service', async () => {
      (service.uploadAndParse as jest.Mock).mockResolvedValue({ id: 'scan-1' });

      const result = await controller.upload([file()], 'biz-1', 'sup-1');

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(service.uploadAndParse).toHaveBeenCalledWith(
        'biz-1',
        'sup-1',
        expect.arrayContaining([expect.objectContaining({ fileType: 'image', mimeType: 'image/png' })]),
      );
      expect(result).toEqual({ id: 'scan-1' });
    });

    it('marks a pdf upload with fileType "pdf"', async () => {
      (service.uploadAndParse as jest.Mock).mockResolvedValue({ id: 'scan-1' });

      await controller.upload([file('application/pdf')], 'biz-1', undefined);

      expect(service.uploadAndParse).toHaveBeenCalledWith(
        'biz-1',
        undefined,
        expect.arrayContaining([expect.objectContaining({ fileType: 'pdf' })]),
      );
    });

    it('throws BadRequestException when no files are provided', async () => {
      await expect(controller.upload([], 'biz-1')).rejects.toThrow(BadRequestException);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for a disallowed mime type', async () => {
      await expect(controller.upload([file('text/plain')], 'biz-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects content that is not an image or PDF even when labelled image/png', async () => {
      await expect(controller.upload([file('image/png', HTML_BYTES)], 'biz-1')).rejects.toThrow(BadRequestException);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when businessId is missing', async () => {
      await expect(controller.upload([file()], undefined as any)).rejects.toThrow(BadRequestException);
    });
  });

  it('findAll delegates to the service', () => {
    controller.findAll('biz-1');
    expect(service.findAll).toHaveBeenCalledWith('biz-1');
  });

  it('findOne delegates to the service', () => {
    controller.findOne('scan-1', 'biz-1');
    expect(service.findOne).toHaveBeenCalledWith('scan-1', 'biz-1');
  });

  it('confirm delegates to the service', () => {
    const dto = { businessId: 'biz-1', items: [] } as any;
    controller.confirm('scan-1', dto);
    expect(service.confirm).toHaveBeenCalledWith('scan-1', dto);
  });
});
