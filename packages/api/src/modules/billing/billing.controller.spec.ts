import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from './billing.controller';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { PdfService } from './pdf.service';

describe('BillingController', () => {
  let controller: BillingController;
  let invoicesService: jest.Mocked<InvoicesService>;
  let paymentsService: jest.Mocked<PaymentsService>;
  let pdfService: jest.Mocked<PdfService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        {
          provide: InvoicesService,
          useValue: { generateFromOrder: jest.fn(), findAll: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: PaymentsService,
          useValue: { create: jest.fn(), payAllOutstanding: jest.fn(), applyAdvanceToOutstanding: jest.fn(), undo: jest.fn(), findAll: jest.fn() },
        },
        {
          provide: PdfService,
          useValue: {
            verifyShareToken: jest.fn(),
            getOrGeneratePdf: jest.fn(),
            getThermalReceiptHtml: jest.fn(),
            createShareToken: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(BillingController);
    invoicesService = module.get(InvoicesService);
    paymentsService = module.get(PaymentsService);
    pdfService = module.get(PdfService);
  });

  it('publicPdf verifies the share token then streams the pdf file', async () => {
    (pdfService.verifyShareToken as jest.Mock).mockResolvedValue({ invoiceId: 'inv-1', businessId: 'biz-1' });
    (pdfService.getOrGeneratePdf as jest.Mock).mockResolvedValue('/tmp/inv-1.pdf');
    const res = { sendFile: jest.fn() } as any;

    await controller.publicPdf('token-1', res);

    expect(pdfService.verifyShareToken).toHaveBeenCalledWith('token-1');
    expect(pdfService.getOrGeneratePdf).toHaveBeenCalledWith('inv-1', 'biz-1');
    expect(res.sendFile).toHaveBeenCalledWith('/tmp/inv-1.pdf');
  });

  it('generateInvoice delegates to the service', () => {
    controller.generateInvoice('order-1', 'biz-1');
    expect(invoicesService.generateFromOrder).toHaveBeenCalledWith('order-1', 'biz-1');
  });

  it('findAllInvoices delegates to the service', () => {
    controller.findAllInvoices('biz-1', 'order-1', 'invoice');
    expect(invoicesService.findAll).toHaveBeenCalledWith('biz-1', 'order-1', 'invoice');
  });

  it('findOneInvoice delegates to the service', () => {
    controller.findOneInvoice('inv-1', 'biz-1');
    expect(invoicesService.findOne).toHaveBeenCalledWith('inv-1', 'biz-1');
  });

  it('downloadPdf streams the generated pdf file', async () => {
    (pdfService.getOrGeneratePdf as jest.Mock).mockResolvedValue('/tmp/inv-1.pdf');
    const res = { sendFile: jest.fn() } as any;

    await controller.downloadPdf('inv-1', 'biz-1', res);

    expect(res.sendFile).toHaveBeenCalledWith('/tmp/inv-1.pdf');
  });

  it('thermalReceipt writes the rendered receipt html as html content type', async () => {
    (pdfService.getThermalReceiptHtml as jest.Mock).mockResolvedValue('<html>receipt</html>');
    const res = { type: jest.fn().mockReturnThis(), send: jest.fn() } as any;

    await controller.thermalReceipt('inv-1', 'biz-1', res);

    expect(res.type).toHaveBeenCalledWith('html');
    expect(res.send).toHaveBeenCalledWith('<html>receipt</html>');
  });

  it('shareLink returns a fetchable public pdf url embedding the token', async () => {
    (pdfService.createShareToken as jest.Mock).mockResolvedValue('abc123');

    const result = await controller.shareLink('inv-1', 'biz-1');

    expect(result).toEqual({ url: '/api/billing/invoices/public/pdf?token=abc123' });
  });

  it('createPayment delegates to the service', () => {
    const dto = { businessId: 'biz-1', amount: 10, paymentMethod: 'Cash' } as any;
    controller.createPayment(dto);
    expect(paymentsService.create).toHaveBeenCalledWith(dto);
  });

  it('payTotal delegates to the service', () => {
    const dto = { businessId: 'biz-1', customerId: 'cust-1', amount: 10, paymentMethod: 'Cash' } as any;
    controller.payTotal(dto);
    expect(paymentsService.payAllOutstanding).toHaveBeenCalledWith(dto);
  });

  it('applyAdvance delegates to the service', () => {
    const dto = { businessId: 'biz-1', customerId: 'cust-1' } as any;
    controller.applyAdvance(dto);
    expect(paymentsService.applyAdvanceToOutstanding).toHaveBeenCalledWith(dto);
  });

  it('undoPayment delegates to the service', () => {
    controller.undoPayment('pay-1', 'biz-1');
    expect(paymentsService.undo).toHaveBeenCalledWith('pay-1', 'biz-1');
  });

  it('findAllPayments delegates to the service', () => {
    controller.findAllPayments('biz-1', 'order-1', 'cust-1');
    expect(paymentsService.findAll).toHaveBeenCalledWith('biz-1', 'order-1', 'cust-1');
  });
});
