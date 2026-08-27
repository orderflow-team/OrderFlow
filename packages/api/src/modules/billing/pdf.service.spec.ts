import * as path from 'path';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));
jest.mock('./templates/invoice.template', () => ({
  renderInvoiceHtml: jest.fn(() => '<html>gst-invoice</html>'),
  renderPharmacyCashMemoHtml: jest.fn(() => '<html>cash-memo</html>'),
  renderA4ReceiptHtml: jest.fn(() => '<html>receipt</html>'),
}));
jest.mock('../../common/utils/image-data-uri.util', () => ({ loadImageDataUri: jest.fn(() => null) }));

import * as fs from 'fs';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PdfService, invoiceFilenameStem } from './pdf.service';
import { Invoice } from '../../database/entities/invoice.entity';
import { InvoiceItem } from '../../database/entities/invoice-item.entity';
import { Business } from '../../database/entities/business.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Order } from '../../database/entities/order.entity';
import { Payment } from '../../database/entities/payment.entity';
import { InvoicesService } from './invoices.service';
import { renderInvoiceHtml, renderPharmacyCashMemoHtml, renderA4ReceiptHtml } from './templates/invoice.template';

describe('invoiceFilenameStem', () => {
  it('replaces the slashes in a GST-format invoice number with a filename-safe separator', () => {
    expect(invoiceFilenameStem('INV/2026-27/00001')).toBe('INV-2026-27-00001');
  });

  it('replaces backslashes too', () => {
    expect(invoiceFilenameStem('INV\\2026-27\\00001')).toBe('INV-2026-27-00001');
  });

  it('leaves an already-safe legacy-format invoice number unchanged', () => {
    expect(invoiceFilenameStem('INV-1786527603959')).toBe('INV-1786527603959');
  });

  it('never lets a slash-containing invoice number turn path.join into a nested directory (regression guard for the original bug)', () => {
    // The exact failure mode that shipped: pdf.service.ts built filePath via
    // path.join(UPLOADS_DIR, `${invoice.invoice_number}.pdf`) directly — since
    // every GST-format invoice number contains "/", path.join treated it as a
    // directory separator and tried to write into a folder that's never
    // created, throwing ENOENT uncaught for every single invoice.
    const uploadsDir = path.join('/app', 'uploads', 'invoices');
    const filePath = path.join(uploadsDir, `${invoiceFilenameStem('INV/2026-27/00001')}.pdf`);

    expect(path.dirname(filePath)).toBe(uploadsDir);
    expect(path.basename(filePath)).toBe('INV-2026-27-00001.pdf');
  });
});

describe('PdfService (full DI)', () => {
  let service: PdfService;
  let invoicesRepo: Record<string, jest.Mock>;
  let invoiceItemsRepo: Record<string, jest.Mock>;
  let businessesRepo: Record<string, jest.Mock>;
  let customersRepo: Record<string, jest.Mock>;
  let ordersRepo: Record<string, jest.Mock>;
  let paymentsRepo: Record<string, jest.Mock>;
  let invoicesService: { getPreviousBalanceDue: jest.Mock };

  beforeEach(async () => {
    invoicesRepo = { findOne: jest.fn(), save: jest.fn(async (i) => i) };
    invoiceItemsRepo = { find: jest.fn() };
    businessesRepo = { findOne: jest.fn() };
    customersRepo = { findOne: jest.fn() };
    ordersRepo = { findOne: jest.fn() };
    paymentsRepo = { find: jest.fn() };
    invoicesService = { getPreviousBalanceDue: jest.fn().mockResolvedValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        { provide: getRepositoryToken(Invoice), useValue: invoicesRepo },
        { provide: getRepositoryToken(InvoiceItem), useValue: invoiceItemsRepo },
        { provide: getRepositoryToken(Business), useValue: businessesRepo },
        { provide: getRepositoryToken(Customer), useValue: customersRepo },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: InvoicesService, useValue: invoicesService },
      ],
    }).compile();

    service = module.get(PdfService);
    jest.clearAllMocks();
  });

  describe('getThermalReceiptHtml', () => {
    it('renders the A4 receipt with the received payment total', async () => {
      invoicesRepo.findOne.mockResolvedValue({ id: 'inv-1', order_id: 'order-1', reference_invoice_id: null });
      invoiceItemsRepo.find.mockResolvedValue([{ id: 'item-1' }]);
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1' });
      ordersRepo.findOne.mockResolvedValue({ id: 'order-1', customer_id: 'cust-1' });
      customersRepo.findOne.mockResolvedValue({ id: 'cust-1' });
      paymentsRepo.find.mockResolvedValue([{ amount: 40 }, { amount: 20 }]);

      const result = await service.getThermalReceiptHtml('inv-1', 'biz-1');

      expect(renderA4ReceiptHtml).toHaveBeenCalledWith(
        expect.anything(),
        [{ id: 'item-1' }],
        expect.anything(),
        expect.anything(),
        expect.anything(),
        60,
        null,
        null,
        undefined,
      );
      expect(result).toBe('<html>receipt</html>');
    });

    it('throws NotFoundException when the invoice does not exist', async () => {
      invoicesRepo.findOne.mockResolvedValue(null);

      await expect(service.getThermalReceiptHtml('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createShareToken / verifyShareToken', () => {
    it('creates and persists a share token with an expiry', async () => {
      invoicesRepo.findOne.mockResolvedValue({ id: 'inv-1' });

      const token = await service.createShareToken('inv-1', 'biz-1');

      expect(token).toHaveLength(48);
      expect(invoicesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ share_token: token, share_token_expires_at: expect.any(Date) }),
      );
    });

    it('throws NotFoundException creating a token for a non-existent invoice', async () => {
      invoicesRepo.findOne.mockResolvedValue(null);

      await expect(service.createShareToken('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('verifies a valid, unexpired token', async () => {
      invoicesRepo.findOne.mockResolvedValue({
        id: 'inv-1',
        business_id: 'biz-1',
        share_token_expires_at: new Date(Date.now() + 60_000),
      });

      const result = await service.verifyShareToken('a-valid-token');

      expect(result).toEqual({ invoiceId: 'inv-1', businessId: 'biz-1' });
    });

    it('throws NotFoundException for an unknown token', async () => {
      invoicesRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyShareToken('unknown')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for an expired token', async () => {
      invoicesRepo.findOne.mockResolvedValue({
        id: 'inv-1',
        business_id: 'biz-1',
        share_token_expires_at: new Date(Date.now() - 1000),
      });

      await expect(service.verifyShareToken('expired-token')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrGeneratePdf', () => {
    it('returns the cached file path without re-rendering when a pdf already exists on disk', async () => {
      invoicesRepo.findOne.mockResolvedValue({ id: 'inv-1', invoice_number: 'INV/2026-27/00001', pdf_url: '/uploads/invoices/x.pdf' });
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await service.getOrGeneratePdf('inv-1', 'biz-1');

      expect(result).toContain('INV-2026-27-00001.pdf');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the invoice does not exist', async () => {
      invoicesRepo.findOne.mockResolvedValue(null);

      await expect(service.getOrGeneratePdf('missing', 'biz-1')).rejects.toThrow(NotFoundException);
    });

    it('renders and writes a new PDF, using the pharmacy cash-memo template for pharmacy businesses', async () => {
      invoicesRepo.findOne.mockResolvedValue({ id: 'inv-1', invoice_number: 'INV/2026-27/00002', pdf_url: null, order_id: null, reference_invoice_id: null });
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      invoiceItemsRepo.find.mockResolvedValue([]);
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', category: 'pharmacy' });

      const fakePage = { setContent: jest.fn().mockResolvedValue(undefined), pdf: jest.fn().mockResolvedValue(Buffer.from('pdf')), close: jest.fn() };
      const fakeBrowser = { newPage: jest.fn().mockResolvedValue(fakePage), on: jest.fn() };
      jest.spyOn(service as any, 'getBrowser').mockResolvedValue(fakeBrowser);

      const result = await service.getOrGeneratePdf('inv-1', 'biz-1');

      expect(renderPharmacyCashMemoHtml).toHaveBeenCalled();
      expect(renderInvoiceHtml).not.toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(invoicesRepo.save).toHaveBeenCalledWith(expect.objectContaining({ pdf_url: expect.stringContaining('INV-2026-27-00002.pdf') }));
      expect(result).toContain('INV-2026-27-00002.pdf');
    });

    it('uses the standard GST invoice template for a non-pharmacy business', async () => {
      invoicesRepo.findOne.mockResolvedValue({ id: 'inv-1', invoice_number: 'INV/2026-27/00003', pdf_url: null, order_id: null, reference_invoice_id: null });
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      invoiceItemsRepo.find.mockResolvedValue([]);
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', category: 'retail' });

      const fakePage = { setContent: jest.fn().mockResolvedValue(undefined), pdf: jest.fn().mockResolvedValue(Buffer.from('pdf')), close: jest.fn() };
      const fakeBrowser = { newPage: jest.fn().mockResolvedValue(fakePage), on: jest.fn() };
      jest.spyOn(service as any, 'getBrowser').mockResolvedValue(fakeBrowser);

      await service.getOrGeneratePdf('inv-1', 'biz-1');

      expect(renderInvoiceHtml).toHaveBeenCalled();
      expect(renderPharmacyCashMemoHtml).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when the browser fails to launch', async () => {
      invoicesRepo.findOne.mockResolvedValue({ id: 'inv-1', invoice_number: 'INV/2026-27/00004', pdf_url: null, order_id: null, reference_invoice_id: null });
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      invoiceItemsRepo.find.mockResolvedValue([]);
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', category: 'retail' });
      jest.spyOn(service as any, 'getBrowser').mockRejectedValue(new Error('no chromium'));

      await expect(service.getOrGeneratePdf('inv-1', 'biz-1')).rejects.toThrow('Could not generate the invoice PDF (PDF renderer unavailable).');
    });

    it('throws InternalServerErrorException and closes the page when rendering fails', async () => {
      invoicesRepo.findOne.mockResolvedValue({ id: 'inv-1', invoice_number: 'INV/2026-27/00005', pdf_url: null, order_id: null, reference_invoice_id: null });
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      invoiceItemsRepo.find.mockResolvedValue([]);
      businessesRepo.findOne.mockResolvedValue({ id: 'biz-1', category: 'retail' });

      const fakePage = { setContent: jest.fn().mockRejectedValue(new Error('render failed')), pdf: jest.fn(), close: jest.fn() };
      const fakeBrowser = { newPage: jest.fn().mockResolvedValue(fakePage), on: jest.fn() };
      jest.spyOn(service as any, 'getBrowser').mockResolvedValue(fakeBrowser);

      await expect(service.getOrGeneratePdf('inv-1', 'biz-1')).rejects.toThrow('Could not generate the invoice PDF.');
      expect(fakePage.close).toHaveBeenCalled();
    });
  });
});
