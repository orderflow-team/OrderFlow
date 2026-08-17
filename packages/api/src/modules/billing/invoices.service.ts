import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Invoice } from '../../database/entities/invoice.entity';
import { InvoiceItem } from '../../database/entities/invoice-item.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Business } from '../../database/entities/business.entity';
import { isInterStateSale, splitGst } from '../../common/utils/gst.util';

/** India's financial year runs Apr 1 - Mar 31; e.g. Jan 2026 falls in FY "2025-26". */
function financialYearLabel(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric' }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')!.value);
  const month = Number(parts.find((p) => p.type === 'month')!.value);
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice) private invoicesRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem) private invoiceItemsRepository: Repository<InvoiceItem>,
    @InjectRepository(Order) private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Customer) private customersRepository: Repository<Customer>,
    @InjectRepository(Payment) private paymentsRepository: Repository<Payment>,
    @InjectRepository(Business) private businessesRepository: Repository<Business>,
    private dataSource: DataSource,
  ) {}

  /**
   * How much this customer still owes across their OTHER orders (any not
   * cancelled/returned — draft included, matching what the Customers page's
   * order-history view already shows as "Remaining"), so a fresh invoice can
   * roll that balance forward instead of only reflecting this one sale.
   */
  async getPreviousBalanceDue(businessId: string, customerId: string, excludeOrderId: string): Promise<number> {
    const orders = await this.ordersRepository.find({
      where: { business_id: businessId, customer_id: customerId },
    });
    const relevantOrders = orders.filter(
      (o) => o.id !== excludeOrderId && o.status !== 'cancelled' && o.status !== 'returned',
    );
    if (relevantOrders.length === 0) return 0;

    const orderIds = relevantOrders.map((o) => o.id);
    const paymentsRaw = await this.paymentsRepository
      .createQueryBuilder('p')
      .select('p.order_id', 'orderId')
      .addSelect('SUM(p.amount)', 'total')
      .where('p.order_id IN (:...orderIds)', { orderIds })
      .groupBy('p.order_id')
      .getRawMany<{ orderId: string; total: string }>();
    const paidByOrder = new Map(paymentsRaw.map((r) => [r.orderId, Number(r.total)]));

    return relevantOrders.reduce((sum, o) => {
      const paid = paidByOrder.get(o.id) || 0;
      return sum + Math.max(0, Number(o.total_amount) - paid);
    }, 0);
  }

  /**
   * GST Rule 46 requires a tax invoice/credit note number to be a
   * consecutive serial, unique for a financial year — not just any unique
   * string. Atomically bumps the business's per-series counter (resetting
   * to 1 when the FY rolls over) via a single UPDATE...RETURNING, so
   * concurrent sales on the same business never collide even without an
   * explicit row lock. `series` is an internal enum, never user input, so
   * it's safe to splice its derived column/prefix names into the query.
   */
  private async nextDocumentNumber(manager: EntityManager, businessId: string, series: 'invoice' | 'credit_note'): Promise<string> {
    const fy = financialYearLabel(new Date());
    const fyColumn = series === 'invoice' ? 'invoice_sequence_fy' : 'credit_note_sequence_fy';
    const valueColumn = series === 'invoice' ? 'invoice_sequence_value' : 'credit_note_sequence_value';
    const prefix = series === 'invoice' ? 'INV' : 'CN';
    const result = await manager.query(
      `UPDATE businesses
       SET ${valueColumn} = CASE WHEN ${fyColumn} = $2 THEN ${valueColumn} + 1 ELSE 1 END,
           ${fyColumn} = $2
       WHERE id = $1
       RETURNING ${valueColumn}`,
      [businessId, fy],
    );
    const seq = result[0][valueColumn];
    return `${prefix}/${fy}/${String(seq).padStart(5, '0')}`;
  }

  /** Snapshots a confirmed order's items into an immutable invoice, per the Order -> Invoice flow. */
  async generateFromOrder(orderId: string, businessId: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id: orderId, business_id: businessId } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Filtered to type: 'invoice' — an order that's already had a credit
      // note generated against it (see generateCreditNoteForReturn below)
      // still shares this order_id, and must not be mistaken for an
      // already-generated sale invoice.
      const existing = await manager.findOne(Invoice, { where: { order_id: orderId, type: 'invoice' } });
      if (existing) {
        throw new ConflictException('Invoice already generated for this order');
      }

      const items = await manager.find(OrderItem, { where: { order_id: orderId } });

      const invoice = manager.create(Invoice, {
        business_id: businessId,
        order_id: orderId,
        type: 'invoice',
        invoice_number: await this.nextDocumentNumber(manager, businessId, 'invoice'),
        total_amount: order.total_amount,
        tax_amount: order.tax_amount,
      });
      const savedInvoice = await manager.save(invoice);

      const invoiceItems = items.map((item) =>
        manager.create(InvoiceItem, {
          invoice_id: savedInvoice.id,
          product_id: item.product_id,
          custom_product_name: item.custom_product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          tax_percentage: item.tax_percentage,
          tax_amount: item.tax_amount,
        }),
      );
      await manager.save(InvoiceItem, invoiceItems);

      return { ...savedInvoice, items: invoiceItems };
    });
  }

  /**
   * Re-syncs an already-generated invoice (totals + line items) from its
   * order's current state. Order edits after invoicing — added/replaced
   * items, or a Quick-Parchi ₹0 price getting backfilled once the product's
   * real price is set — must call this so the invoice (and the PDF/thermal
   * print, which just render the invoice row) don't go stale. No-op if the
   * order has no invoice yet.
   */
  async syncFromOrder(orderId: string, manager: EntityManager) {
    // type: 'invoice' — never re-sync a credit note's snapshot from the
    // order's current (post-return) totals; a credit note is an immutable
    // record of what was returned, not a live view of the order.
    const invoice = await manager.findOne(Invoice, { where: { order_id: orderId, type: 'invoice' } });
    if (!invoice) return;

    const order = await manager.findOne(Order, { where: { id: orderId } });
    if (!order) return;

    invoice.total_amount = order.total_amount;
    invoice.tax_amount = order.tax_amount;
    // The A4 PDF is rendered once and cached to disk (see PdfService.getOrGeneratePdf) —
    // clearing pdf_url forces it to regenerate from the now-current totals/items on next
    // request. The thermal receipt has no such cache and always renders fresh.
    invoice.pdf_url = null;
    await manager.save(invoice);

    await manager.delete(InvoiceItem, { invoice_id: invoice.id });
    const items = await manager.find(OrderItem, { where: { order_id: orderId } });
    const invoiceItems = items.map((item) =>
      manager.create(InvoiceItem, {
        invoice_id: invoice.id,
        product_id: item.product_id,
        custom_product_name: item.custom_product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        tax_percentage: item.tax_percentage,
        tax_amount: item.tax_amount,
      }),
    );
    if (invoiceItems.length) {
      await manager.save(InvoiceItem, invoiceItems);
    }
  }

  findAll(businessId: string, orderId?: string, type?: 'invoice' | 'credit_note') {
    const where: any = { business_id: businessId };
    if (orderId) where.order_id = orderId;
    if (type) where.type = type;
    return this.invoicesRepository.find({ where, order: { created_at: 'DESC' } });
  }

  async findOne(id: string, businessId: string) {
    const invoice = await this.invoicesRepository.findOne({ where: { id, business_id: businessId } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const items = await this.invoiceItemsRepository.find({
      where: { invoice_id: id },
      relations: { product: true },
    });
    const order = invoice.order_id ? await this.ordersRepository.findOne({ where: { id: invoice.order_id } }) : null;
    const customer = order?.customer_id
      ? await this.customersRepository.findOne({ where: { id: order.customer_id } })
      : null;
    const previousBalanceDue = order?.customer_id
      ? await this.getPreviousBalanceDue(businessId, order.customer_id, order.id)
      : 0;
    const referenceInvoice = invoice.reference_invoice_id
      ? await this.invoicesRepository.findOne({ where: { id: invoice.reference_invoice_id } })
      : null;
    const business = await this.businessesRepository.findOne({ where: { id: businessId } });
    const interState = isInterStateSale(business, customer);
    const gstSplit = splitGst(Number(invoice.tax_amount), interState);
    return {
      ...invoice,
      items,
      order_status: order?.status,
      customer,
      order_customer_name: order?.customer_name,
      patient_name: order?.patient_name,
      doctor_name: order?.doctor_name,
      previous_balance_due: previousBalanceDue,
      reference_invoice_number: referenceInvoice?.invoice_number ?? null,
      is_interstate: interState,
      cgst_amount: gstSplit.cgst,
      sgst_amount: gstSplit.sgst,
      igst_amount: gstSplit.igst,
    };
  }

  /**
   * Snapshots the units just returned by OrdersService.returnOrder into an
   * immutable credit note — the GST-correct paper trail for a return,
   * mirroring generateFromOrder's Order -> Invoice snapshot but reversed.
   * Called from *inside* returnOrder's own transaction (hence taking a
   * manager, not opening its own) using that exact call's returned
   * quantities, so multiple partial returns over time each get their own
   * credit note instead of one note racing to cover cumulative state.
   * No-op (returns null) if the order was never formally invoiced — nothing
   * to issue a credit note against.
   */
  async generateCreditNoteForReturn(
    manager: EntityManager,
    orderId: string,
    businessId: string,
    returnedLines: {
      product_id: string | null;
      custom_product_name: string | null;
      quantity: number;
      unit_price: number;
      subtotal: number;
      tax_percentage: number;
      tax_amount: number;
    }[],
  ): Promise<Invoice | null> {
    if (returnedLines.length === 0) return null;

    const originalInvoice = await manager.findOne(Invoice, { where: { order_id: orderId, type: 'invoice' } });
    if (!originalInvoice) return null;

    const totalAmount = returnedLines.reduce((sum, l) => sum + l.subtotal + l.tax_amount, 0);
    const totalTax = returnedLines.reduce((sum, l) => sum + l.tax_amount, 0);

    const creditNote = manager.create(Invoice, {
      business_id: businessId,
      order_id: orderId,
      type: 'credit_note',
      reference_invoice_id: originalInvoice.id,
      invoice_number: await this.nextDocumentNumber(manager, businessId, 'credit_note'),
      total_amount: totalAmount,
      tax_amount: totalTax,
    });
    const savedNote = await manager.save(creditNote);

    const creditNoteItems = returnedLines.map((line) =>
      manager.create(InvoiceItem, { invoice_id: savedNote.id, ...line }),
    );
    await manager.save(InvoiceItem, creditNoteItems);

    return savedNote;
  }
}
