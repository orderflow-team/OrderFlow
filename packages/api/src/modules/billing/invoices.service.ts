import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Invoice } from '../../database/entities/invoice.entity';
import { InvoiceItem } from '../../database/entities/invoice-item.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Customer } from '../../database/entities/customer.entity';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice) private invoicesRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem) private invoiceItemsRepository: Repository<InvoiceItem>,
    @InjectRepository(Order) private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Customer) private customersRepository: Repository<Customer>,
    private dataSource: DataSource,
  ) {}

  /** Snapshots a confirmed order's items into an immutable invoice, per the Order -> Invoice flow. */
  async generateFromOrder(orderId: string, businessId: string) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, { where: { id: orderId, business_id: businessId } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }

      const existing = await manager.findOne(Invoice, { where: { order_id: orderId } });
      if (existing) {
        throw new ConflictException('Invoice already generated for this order');
      }

      const items = await manager.find(OrderItem, { where: { order_id: orderId } });

      const invoice = manager.create(Invoice, {
        business_id: businessId,
        order_id: orderId,
        invoice_number: `INV-${Date.now()}`,
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
    const invoice = await manager.findOne(Invoice, { where: { order_id: orderId } });
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

  findAll(businessId: string, orderId?: string) {
    const where: any = { business_id: businessId };
    if (orderId) where.order_id = orderId;
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
    return { ...invoice, items, order_status: order?.status, customer, order_customer_name: order?.customer_name };
  }
}
