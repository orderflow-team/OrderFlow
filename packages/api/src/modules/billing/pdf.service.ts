import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';
import { Invoice } from '../../database/entities/invoice.entity';
import { InvoiceItem } from '../../database/entities/invoice-item.entity';
import { Business } from '../../database/entities/business.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Order } from '../../database/entities/order.entity';
import { renderInvoiceHtml, renderThermalReceiptHtml } from './templates/invoice.template';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'invoices');

@Injectable()
export class PdfService {
  constructor(
    @InjectRepository(Invoice) private invoicesRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem) private invoiceItemsRepository: Repository<InvoiceItem>,
    @InjectRepository(Business) private businessesRepository: Repository<Business>,
    @InjectRepository(Customer) private customersRepository: Repository<Customer>,
    @InjectRepository(Order) private ordersRepository: Repository<Order>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private async loadInvoiceContext(invoiceId: string, businessId: string) {
    const invoice = await this.invoicesRepository.findOne({ where: { id: invoiceId, business_id: businessId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const items = await this.invoiceItemsRepository.find({
      where: { invoice_id: invoiceId },
      relations: { product: true },
    });
    const business = await this.businessesRepository.findOne({ where: { id: businessId } });
    const order = invoice.order_id ? await this.ordersRepository.findOne({ where: { id: invoice.order_id } }) : null;
    const customer = order?.customer_id
      ? await this.customersRepository.findOne({ where: { id: order.customer_id } })
      : null;

    return { invoice, items, business, customer, order };
  }

  /** Generates (or returns the cached) PDF for an invoice and updates invoice.pdf_url. */
  async getOrGeneratePdf(invoiceId: string, businessId: string): Promise<string> {
    const invoice = await this.invoicesRepository.findOne({ where: { id: invoiceId, business_id: businessId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const filePath = path.join(UPLOADS_DIR, `${invoice.invoice_number}.pdf`);
    if (invoice.pdf_url && fs.existsSync(filePath)) {
      return filePath;
    }

    const { items, business, customer, order } = await this.loadInvoiceContext(invoiceId, businessId);
    const html = renderInvoiceHtml(invoice, items, business, customer, order);

    fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfBuffer = await page.pdf({ format: 'a4', printBackground: true });
      fs.writeFileSync(filePath, pdfBuffer);
    } finally {
      await browser.close();
    }

    invoice.pdf_url = `/uploads/invoices/${invoice.invoice_number}.pdf`;
    await this.invoicesRepository.save(invoice);

    return filePath;
  }

  async getThermalReceiptHtml(invoiceId: string, businessId: string): Promise<string> {
    const { invoice, items, business, customer, order } = await this.loadInvoiceContext(invoiceId, businessId);
    return renderThermalReceiptHtml(invoice, items, business, customer, order);
  }

  /** Short-lived signed token so WhatsApp (opened in its own client) can fetch the PDF without an auth header. */
  createShareToken(invoiceId: string, businessId: string): string {
    return this.jwtService.sign(
      { invoiceId, businessId, purpose: 'invoice-pdf-share' },
      {
        secret: this.configService.get<string>('JWT_SECRET') || 'test-secret',
        expiresIn: '15m',
      },
    );
  }

  verifyShareToken(token: string): { invoiceId: string; businessId: string } {
    let payload: { invoiceId: string; businessId: string; purpose: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET') || 'test-secret',
      });
    } catch {
      throw new NotFoundException('Invalid or expired share link');
    }
    if (payload.purpose !== 'invoice-pdf-share') {
      throw new NotFoundException('Invalid share link');
    }
    return { invoiceId: payload.invoiceId, businessId: payload.businessId };
  }
}
