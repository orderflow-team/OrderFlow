import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

const order = { id: 'ord-1', customer_id: 'cust-1', total_amount: 250 };

function build(opts: {
  customerPhone?: string | null;
  business?: any;
  sendImpl?: () => Promise<any>;
  invoice?: any;
}) {
  const pdfPath = path.join(os.tmpdir(), `wa-test-${process.pid}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(pdfPath, '%PDF-1.4 test');

  const repos = new Map<any, any>();
  const service: any = Object.create(OrdersService.prototype);
  service.logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };
  service.dataSource = {
    getRepository: (entity: any) => {
      const name = entity.name;
      if (name === 'Customer') return { findOne: jest.fn().mockResolvedValue(opts.customerPhone === null ? { phone: null } : { phone: opts.customerPhone ?? '9876543210' }) };
      if (name === 'Business') {
        return {
          findOne: jest.fn().mockResolvedValue(
            opts.business === undefined ? { name: 'Shop', whatsapp_connected: true, whatsapp_instance_name: 'inst-1' } : opts.business,
          ),
        };
      }
      if (name === 'Invoice') return { findOne: jest.fn().mockResolvedValue(opts.invoice ?? { id: 'inv-1', invoice_number: 'INV-1', total_amount: 250 }) };
      return repos.get(entity);
    },
  };
  service.invoicesService = { generateFromOrder: jest.fn() };
  service.pdfService = { getOrGeneratePdf: jest.fn().mockResolvedValue(pdfPath) };
  service.evolutionApiService = { sendMediaDocument: jest.fn(opts.sendImpl ?? (async () => ({ key: { id: 'x' } }))) };
  return { service: service as OrdersService & Record<string, any>, pdfPath };
}

describe('OrdersService.sendWhatsappInvoice (manual "send on WhatsApp")', () => {
  it('sends to the customer phone and reports success only after the gateway accepted it', async () => {
    const { service } = build({});
    await expect(service.sendWhatsappInvoice(order, 'biz-1')).resolves.toEqual({ invoiceNumber: 'INV-1' });
    expect((service as any).evolutionApiService.sendMediaDocument).toHaveBeenCalledWith('inst-1', '9876543210', expect.any(String), expect.stringContaining('.pdf'), expect.stringContaining('INV-1'));
  });

  it('FAILS (does not pretend success) when the WhatsApp gateway rejects the message', async () => {
    const { service } = build({ sendImpl: async () => { throw new Error('400: number not on WhatsApp'); } });
    const err = await service.sendWhatsappInvoice(order, 'biz-1').catch((e: any) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.message).toContain('number not on WhatsApp');
  });

  it('tells the user when the order has no usable customer phone, and sends nothing', async () => {
    const { service } = build({ customerPhone: null });
    await expect(service.sendWhatsappInvoice(order, 'biz-1')).rejects.toThrow(/no valid customer phone/i);
    await expect(service.sendWhatsappInvoice({ id: 'o2' }, 'biz-1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.sendWhatsappInvoice(order, 'biz-1', '12345')).rejects.toBeInstanceOf(BadRequestException);
    expect((service as any).evolutionApiService.sendMediaDocument).not.toHaveBeenCalled();
  });

  it('tells the user when WhatsApp is not connected for the shop', async () => {
    for (const business of [null, { name: 'S', whatsapp_connected: false, whatsapp_instance_name: 'i' }, { name: 'S', whatsapp_connected: true, whatsapp_instance_name: null }]) {
      const { service } = build({ business });
      await expect(service.sendWhatsappInvoice(order, 'biz-1')).rejects.toThrow(/not connected/i);
      expect((service as any).evolutionApiService.sendMediaDocument).not.toHaveBeenCalled();
    }
  });

  it('fails clearly when the PDF cannot be produced', async () => {
    const { service } = build({});
    (service as any).pdfService.getOrGeneratePdf.mockResolvedValue('/definitely/not/here.pdf');
    await expect(service.sendWhatsappInvoice(order, 'biz-1')).rejects.toThrow(/PDF could not be generated/i);
    expect((service as any).evolutionApiService.sendMediaDocument).not.toHaveBeenCalled();
  });
});

describe('OrdersService.dispatchWhatsappInvoice (automatic, after an order is placed)', () => {
  it('never throws — a WhatsApp failure must not break the sale — but logs why', async () => {
    const { service } = build({ sendImpl: async () => { throw new Error('gateway down'); } });
    await expect(service.dispatchWhatsappInvoice(order, 'biz-1')).resolves.toBeUndefined();
    expect((service as any).logger.warn).toHaveBeenCalledWith(expect.stringContaining('gateway down'));
  });
});

describe('OrdersController.sendWhatsappInvoice', () => {
  it('propagates the failure to the client instead of answering success', async () => {
    const ordersService = {
      findOne: jest.fn().mockResolvedValue(order),
      sendWhatsappInvoice: jest.fn().mockRejectedValue(new BadRequestException('WhatsApp is not connected.')),
    };
    const controller = new (OrdersController as any)(ordersService);
    await expect(controller.sendWhatsappInvoice('ord-1', 'biz-1')).rejects.toThrow('WhatsApp is not connected.');
  });

  it('answers success only when the service succeeded', async () => {
    const ordersService = { findOne: jest.fn().mockResolvedValue(order), sendWhatsappInvoice: jest.fn().mockResolvedValue({ invoiceNumber: 'INV-1' }) };
    const controller = new (OrdersController as any)(ordersService);
    await expect(controller.sendWhatsappInvoice('ord-1', 'biz-1')).resolves.toMatchObject({ success: true });
  });
});
