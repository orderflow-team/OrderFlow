import { Business } from '../../../database/entities/business.entity';
import { Customer } from '../../../database/entities/customer.entity';
import { Invoice } from '../../../database/entities/invoice.entity';
import { InvoiceItem } from '../../../database/entities/invoice-item.entity';

function money(n: number | string) {
  return Number(n).toFixed(2);
}

/** Batch/expiry/Rx are pharmacy-specific product fields — only rendered when actually set. */
function itemDetails(item: InvoiceItem): string[] {
  const p = item.product;
  const details: string[] = [];
  if (p?.batch_number) details.push(`Batch: ${p.batch_number}`);
  if (p?.expiry_date) details.push(`Exp: ${new Date(p.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`);
  if (p?.prescription_required) details.push('Rx');
  return details;
}

/** A4 GST invoice layout for puppeteer print-to-PDF (also reused, in spirit, by the thermal template). */
export function renderInvoiceHtml(
  invoice: Invoice,
  items: InvoiceItem[],
  business: Business | null,
  customer: Customer | null,
  order: any | null,
) {
  const rows = items
    .map((item) => {
      const details = itemDetails(item);
      const detailsHtml = details.length
        ? `<div class="muted" style="font-size:11px;margin-top:2px;">${details.join('&nbsp;&nbsp;•&nbsp;&nbsp;')}</div>`
        : '';
      return `
        <tr>
          <td>${item.product?.name ?? item.custom_product_name ?? '-'}${detailsHtml}</td>
          <td class="num">${money(item.quantity)}</td>
          <td class="num">₹${money(item.unit_price)}</td>
          <td class="num">${money(item.tax_percentage)}%</td>
          <td class="num">₹${money(item.subtotal)}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; color: #1e293b; padding: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #64748b; font-size: 12px; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
  th { background: #f1f5f9; }
  .num { text-align: right; }
  .totals { margin-top: 16px; width: 280px; margin-left: auto; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
  .totals .grand { font-weight: bold; font-size: 16px; border-top: 1px solid #0f172a; padding-top: 8px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${business?.name ?? 'OrderFlow'}</h1>
      <div class="muted">${business?.address ?? ''}</div>
      <div class="muted">${business?.gst_number ? `GSTIN: ${business.gst_number}` : ''}</div>
    </div>
    <div>
      <div class="muted">Invoice No.</div>
      <div><strong>${invoice.invoice_number}</strong></div>
      <div class="muted">${new Date(invoice.created_at).toLocaleDateString('en-IN')} ${new Date(invoice.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
      ${order?.status ? `<div class="muted" style="margin-top: 4px; color: #059669; font-weight: bold; text-transform: uppercase;">STATUS: ${order.status}</div>` : ''}
    </div>
  </div>

  <div class="muted">Billed To</div>
  <div><strong>${customer?.name ?? order?.customer_name ?? 'Walk-in Customer'}</strong></div>
  <div class="muted">${customer?.phone ?? ''}</div>
  <div class="muted">${customer?.gst_number ? `GSTIN: ${customer.gst_number}` : ''}</div>

  <table>
    <thead>
      <tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">GST</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Tax</span><span>₹${money(invoice.tax_amount)}</span></div>
    <div class="grand"><span>Total</span><span>₹${money(invoice.total_amount)}</span></div>
  </div>
</body>
</html>`;
}

/** Narrow 58/80mm receipt layout for thermal printers, rendered via the browser's print dialog. */
export function renderThermalReceiptHtml(
  invoice: Invoice,
  items: InvoiceItem[],
  business: Business | null,
  customer: Customer | null,
  order: any | null,
) {
  const line = '-'.repeat(32);
  const rows = items
    .map((item) => {
      const name = (item.product?.name ?? item.custom_product_name ?? '-').slice(0, 20);
      const row = `${name.padEnd(20)}${String(money(item.quantity)).padStart(4)} ${`₹${money(item.subtotal)}`.padStart(8)}`;
      const details = itemDetails(item);
      return details.length ? `${row}\n  ${details.join('  ')}` : row;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: 80mm auto; margin: 0; }
  body { width: 76mm; margin: 0 auto; font-family: 'Courier New', monospace; font-size: 12px; white-space: pre; padding: 8px; }
  @media print { body { width: 76mm; } }
</style>
</head>
<body>${business?.name ?? 'OrderFlow'}
${business?.address ?? ''}
${business?.gst_number ? `GSTIN: ${business.gst_number}` : ''}
${line}
Invoice: ${invoice.invoice_number}
Date: ${new Date(invoice.created_at).toLocaleString('en-IN')}
${order?.status ? `Status: ${String(order.status).toUpperCase()}\n` : ''}
Customer: ${customer?.name ?? order?.customer_name ?? 'Walk-in'}
${line}
${rows}
${line}
Tax:    ₹${money(invoice.tax_amount)}
TOTAL:  ₹${money(invoice.total_amount)}
${line}
Thank you!
<script>window.onload = () => window.print();</script>
</body>
</html>`;
}
