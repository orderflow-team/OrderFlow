import { Injectable, InternalServerErrorException, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import type { Browser } from 'puppeteer';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Invoice } from '../../database/entities/invoice.entity';
import { InvoiceItem } from '../../database/entities/invoice-item.entity';
import { Business } from '../../database/entities/business.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Order } from '../../database/entities/order.entity';
import { Payment } from '../../database/entities/payment.entity';
import { InvoicesService } from './invoices.service';
import {
  renderInvoiceHtml,
  renderPharmacyCashMemoHtml,
  renderA4ReceiptHtml,
  type GstInvoiceColumns,
  type CashMemoColumns,
  type A4ReceiptColumns,
} from './templates/invoice.template';
import { loadImageDataUri } from '../../common/utils/image-data-uri.util';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'invoices');
const SHARE_TOKEN_TTL_MINUTES = 15;

// invoice_number is "INV/{FY}/{seq}" (e.g. "INV/2026-27/00001") — the GST
// Rule 46 format requires those slashes. path.join treats an embedded "/" as
// a directory separator, so using invoice_number as a filename verbatim
// silently tried to write into "uploads/invoices/INV/2026-27/00001.pdf",
// a nested directory that's never created — fs.writeFileSync then threw
// ENOENT, uncaught, for every single invoice (old and new alike). Swap
// slashes for a filename-safe separator instead.
export function invoiceFilenameStem(invoiceNumber: string): string {
  return invoiceNumber.replace(/[\\/]/g, '-');
}

function loadLogoDataUri(business: Business | null): string | null {
  return loadImageDataUri(business?.logo_url);
}

@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  // Launching headless Chromium is the expensive part of PDF generation
  // (multiple seconds on a resource-constrained host) — opening a page in an
  // already-running browser is cheap. Previously every single invoice PDF
  // paid the full launch cost because the browser was created and closed per
  // request; now one browser is kept alive for the process's lifetime and
  // reused across requests.
  private browserPromise: Promise<Browser> | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      const puppeteer = await import('puppeteer');
      this.browserPromise = puppeteer
        .launch({
          headless: true,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
          timeout: 20_000,
        })
        .then((browser) => {
          // If Chromium crashes (e.g. OOM on a constrained host), drop the
          // cached instance so the next request launches a fresh one instead
          // of retrying against a dead browser forever.
          browser.on('disconnected', () => {
            this.browserPromise = null;
          });
          return browser;
        })
        .catch((error) => {
          this.browserPromise = null;
          throw error;
        });
    }
    return this.browserPromise;
  }

  async onModuleDestroy() {
    if (this.browserPromise) {
      const browser = await this.browserPromise.catch(() => null);
      await browser?.close();
    }
  }

  constructor(
    @InjectRepository(Invoice) private invoicesRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem) private invoiceItemsRepository: Repository<InvoiceItem>,
    @InjectRepository(Business) private businessesRepository: Repository<Business>,
    @InjectRepository(Customer) private customersRepository: Repository<Customer>,
    @InjectRepository(Order) private ordersRepository: Repository<Order>,
    @InjectRepository(Payment) private paymentsRepository: Repository<Payment>,
    private invoicesService: InvoicesService,
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
    const previousBalanceDue = order?.customer_id
      ? await this.invoicesService.getPreviousBalanceDue(businessId, order.customer_id, order.id)
      : 0;
    const referenceInvoiceNumber = invoice.reference_invoice_id
      ? (await this.invoicesRepository.findOne({ where: { id: invoice.reference_invoice_id } }))?.invoice_number ?? null
      : null;

    return { invoice, items, business, customer, order, previousBalanceDue, referenceInvoiceNumber };
  }

  /** Generates (or returns the cached) PDF for an invoice and updates invoice.pdf_url. */
  async getOrGeneratePdf(invoiceId: string, businessId: string): Promise<string> {
    const invoice = await this.invoicesRepository.findOne({ where: { id: invoiceId, business_id: businessId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const filenameStem = invoiceFilenameStem(invoice.invoice_number);
    const filePath = path.join(UPLOADS_DIR, `${filenameStem}.pdf`);
    if (invoice.pdf_url && fs.existsSync(filePath)) {
      return filePath;
    }

    const { items, business, customer, order, previousBalanceDue, referenceInvoiceNumber } = await this.loadInvoiceContext(invoiceId, businessId);
    const invoiceColumns = business?.custom_settings?.invoiceColumns as
      | { gstInvoice?: GstInvoiceColumns; cashMemo?: CashMemoColumns; a4Receipt?: A4ReceiptColumns }
      | undefined;
    const html = business?.category === 'pharmacy'
      ? renderPharmacyCashMemoHtml(invoice, items, business, customer, order, loadLogoDataUri(business), previousBalanceDue, referenceInvoiceNumber, invoiceColumns?.cashMemo)
      : renderInvoiceHtml(invoice, items, business, customer, order, loadLogoDataUri(business), previousBalanceDue, referenceInvoiceNumber, invoiceColumns?.gstInvoice);

    fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    let browser: Browser;
    try {
      browser = await this.getBrowser();
    } catch (error: any) {
      // The one place this previously failed loudest and most often — Chromium
      // missing/mismatched on the host (see the Dockerfile's Alpine-native
      // chromium + PUPPETEER_EXECUTABLE_PATH setup). Logged with the real
      // error so this doesn't need a full investigation to diagnose again.
      this.logger.error(`Puppeteer failed to launch a browser: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not generate the invoice PDF (PDF renderer unavailable).');
    }

    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load', timeout: 20_000 });
      const pdfBuffer = await page.pdf({ format: 'a4', printBackground: true, timeout: 20_000 });
      fs.writeFileSync(filePath, pdfBuffer);
    } catch (error: any) {
      this.logger.error(`PDF render/write failed for invoice ${invoice.invoice_number}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Could not generate the invoice PDF.');
    } finally {
      // Only the page, not the browser — the browser is shared and stays
      // alive for the next request (see getBrowser()).
      await page.close();
    }

    invoice.pdf_url = `/uploads/invoices/${filenameStem}.pdf`;
    await this.invoicesRepository.save(invoice);

    return filePath;
  }

  async getThermalReceiptHtml(invoiceId: string, businessId: string): Promise<string> {
    const { invoice, items, business, customer, order } = await this.loadInvoiceContext(invoiceId, businessId);

    const payments = order ? await this.paymentsRepository.find({ where: { order_id: order.id } }) : [];
    const receivedAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const logoDataUri = loadImageDataUri(business?.logo_url);
    const upiQrDataUri = loadImageDataUri(business?.upi_qr_url);
    const a4Columns = (business?.custom_settings?.invoiceColumns as { a4Receipt?: A4ReceiptColumns } | undefined)?.a4Receipt;
    return renderA4ReceiptHtml(invoice, items, business, customer, order, receivedAmount, logoDataUri, upiQrDataUri, a4Columns);
  }

  /**
   * Short-lived opaque token so WhatsApp (opened in its own client) can fetch
   * the PDF without an auth header. Deliberately not a JWT: a JWT's payload is
   * only signed, not encrypted, so anyone the link is forwarded to could
   * base64-decode it and read the raw invoiceId/businessId. A random token
   * stored server-side reveals nothing on its own and can be invalidated by
   * re-generating it.
   */
  async createShareToken(invoiceId: string, businessId: string): Promise<string> {
    const invoice = await this.invoicesRepository.findOne({ where: { id: invoiceId, business_id: businessId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const token = crypto.randomBytes(24).toString('hex');
    invoice.share_token = token;
    invoice.share_token_expires_at = new Date(Date.now() + SHARE_TOKEN_TTL_MINUTES * 60 * 1000);
    await this.invoicesRepository.save(invoice);

    return token;
  }

  async verifyShareToken(token: string): Promise<{ invoiceId: string; businessId: string }> {
    const invoice = await this.invoicesRepository.findOne({ where: { share_token: token } });
    if (!invoice || !invoice.share_token_expires_at || invoice.share_token_expires_at < new Date()) {
      throw new NotFoundException('Invalid or expired share link');
    }
    return { invoiceId: invoice.id, businessId: invoice.business_id };
  }
}
