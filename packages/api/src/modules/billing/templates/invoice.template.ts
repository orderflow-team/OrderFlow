import { Business } from '../../../database/entities/business.entity';
import { Customer } from '../../../database/entities/customer.entity';
import { Invoice } from '../../../database/entities/invoice.entity';
import { InvoiceItem } from '../../../database/entities/invoice-item.entity';

function money(n: number | string) {
  return Number(n).toFixed(2);
}

/**
 * Product/customer/business names are free text entered by staff — escape
 * before interpolating into HTML. These templates are rendered both via
 * Puppeteer (PDF) and, for the thermal receipt, directly in the cashier's
 * browser via document.write(), where an unescaped "<script>" in e.g. a
 * custom item name would execute with access to the authenticated app.
 */
function escapeHtml(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Classic Indian ledger convention: rupees and paise as two separate table columns. */
function splitRupeesPaise(n: number | string): { rupees: string; paise: string } {
  const [rupees, paise] = money(n).split('.');
  return { rupees, paise };
}

/**
 * `toLocaleString`/`toLocaleDateString` without an explicit `timeZone` fall
 * back to whatever timezone the rendering environment happens to be in
 * (e.g. a UTC server) — not the business's actual timezone. Pin it
 * explicitly so the invoice always shows the business's local time,
 * regardless of where it's rendered.
 */
function tz(business: Business | null): string {
  return business?.timezone || 'Asia/Kolkata';
}

/** Batch/expiry/Rx are pharmacy-specific product fields — only rendered when actually set. */
function itemDetails(item: InvoiceItem, timeZone: string): string[] {
  const p = item.product;
  const details: string[] = [];
  if (p?.batch_number) details.push(`Batch: ${escapeHtml(p.batch_number)}`);
  if (p?.expiry_date) details.push(`Exp: ${new Date(p.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone })}`);
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
  logoDataUri: string | null = null,
  previousBalanceDue = 0,
) {
  const timeZone = tz(business);
  const hasMrp = items.some((item) => item.product?.mrp != null);
  const rows = items
    .map((item) => {
      const details = itemDetails(item, timeZone);
      const detailsHtml = details.length
        ? `<div class="muted" style="font-size:11px;margin-top:2px;">${details.join('&nbsp;&nbsp;•&nbsp;&nbsp;')}</div>`
        : '';
      const mrpCell = hasMrp ? `<td class="num">${item.product?.mrp != null ? `₹${money(item.product.mrp)}` : '-'}</td>` : '';
      return `
        <tr>
          <td>${escapeHtml(item.product?.name ?? item.custom_product_name ?? '-')}${detailsHtml}</td>
          <td class="num">${money(item.quantity)}</td>
          ${mrpCell}
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
  h1 { font-size: 26px; margin: 0 0 4px; }
  .muted { color: #64748b; font-size: 12px; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
  th { background: #f1f5f9; }
  .num { text-align: right; }
  .totals { margin-top: 16px; width: 280px; margin-left: auto; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
  .totals .grand { font-weight: bold; font-size: 16px; border-top: 1px solid #0f172a; padding-top: 8px; }
  .logo { height: 72px; max-width: 220px; object-fit: contain; }
  .brand { display: flex; align-items: center; gap: 16px; margin-bottom: 6px; }
  .brand h1 { margin: 0; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">
        ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="${escapeHtml(business?.name ?? 'Logo')}" />` : ''}
        <h1>${escapeHtml(business?.name ?? 'OrderFlow')}</h1>
      </div>
      <div class="muted">${escapeHtml(business?.address ?? '')}</div>
      <div class="muted">${business?.gst_number ? `GSTIN: ${escapeHtml(business.gst_number)}` : ''}</div>
    </div>
    <div>
      <div class="muted">Invoice No.</div>
      <div><strong>${escapeHtml(invoice.invoice_number)}</strong></div>
      <div class="muted">${new Date(invoice.created_at).toLocaleDateString('en-IN', { timeZone })} ${new Date(invoice.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone })}</div>
      ${order?.status ? `<div class="muted" style="margin-top: 4px; color: #059669; font-weight: bold; text-transform: uppercase;">STATUS: ${escapeHtml(String(order.status))}</div>` : ''}
    </div>
  </div>

  <div class="muted">Billed To</div>
  <div><strong>${escapeHtml(customer?.name ?? order?.customer_name ?? 'Walk-in Customer')}</strong></div>
  <div class="muted">${escapeHtml(customer?.phone ?? '')}</div>
  <div class="muted">${customer?.gst_number ? `GSTIN: ${escapeHtml(customer.gst_number)}` : ''}</div>

  <table>
    <thead>
      <tr><th>Item</th><th class="num">Qty</th>${hasMrp ? '<th class="num">MRP</th>' : ''}<th class="num">Price</th><th class="num">GST</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Tax</span><span>₹${money(invoice.tax_amount)}</span></div>
    <div class="${previousBalanceDue > 0.01 ? '' : 'grand'}"><span>${previousBalanceDue > 0.01 ? 'This Invoice' : 'Total'}</span><span>₹${money(invoice.total_amount)}</span></div>
    ${previousBalanceDue > 0.01 ? `
    <div><span>Previous Balance Due</span><span>₹${money(previousBalanceDue)}</span></div>
    <div class="grand"><span>Total Amount Due</span><span>₹${money(Number(invoice.total_amount) + previousBalanceDue)}</span></div>
    ` : ''}
  </div>
</body>
</html>`;
}

/**
 * Pharmacy-only A4 layout, matching the traditional Indian chemist "Cash
 * Memo" pad: license numbers, shop name/tagline/address, memo No./date,
 * blank-unless-captured Patient Name / Dr. Name lines, and a minimal
 * Qty/Particulars/Batch/Exp. Dt/Amount table with rupees and paise as
 * separate columns — no per-unit price or GST breakdown, since the
 * reference pad has none.
 */
export function renderPharmacyCashMemoHtml(
  invoice: Invoice,
  items: InvoiceItem[],
  business: Business | null,
  customer: Customer | null,
  order: any | null,
  logoDataUri: string | null = null,
  previousBalanceDue = 0,
) {
  const timeZone = tz(business);
  const rows = items
    .map((item) => {
      const p = item.product;
      const expiry = p?.expiry_date
        ? new Date(p.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone })
        : '';
      const { rupees, paise } = splitRupeesPaise(item.subtotal);
      return `
        <tr>
          <td class="num">${money(item.quantity)}</td>
          <td>${escapeHtml(item.product?.name ?? item.custom_product_name ?? '-')}</td>
          <td>${escapeHtml(p?.batch_number ?? '')}</td>
          <td>${expiry}</td>
          <td class="num rs">${rupees}</td>
          <td class="num ps">${paise}</td>
        </tr>`;
    })
    .join('');

  const subtotalAmount = Number(invoice.total_amount) - Number(invoice.tax_amount);
  const { rupees: subtotalRupees, paise: subtotalPaise } = splitRupeesPaise(subtotalAmount);
  const { rupees: taxRupees, paise: taxPaise } = splitRupeesPaise(invoice.tax_amount);
  const { rupees: totalRupees, paise: totalPaise } = splitRupeesPaise(invoice.total_amount);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; color: #1e293b; padding: 28px; }
  .frame { border: 1.5px solid #0f172a; padding: 20px 24px; }
  .top-row { display: flex; justify-content: space-between; align-items: flex-start; font-size: 12px; }
  .top-row .lic div { margin-bottom: 2px; }
  .memo-label { font-weight: bold; text-decoration: underline; letter-spacing: 1px; align-self: center; }
  .brand { text-align: center; margin: 6px 0 2px; }
  .brand .logo { height: 56px; max-width: 200px; object-fit: contain; margin-bottom: 4px; }
  .brand h1 { margin: 0; font-size: 26px; letter-spacing: 0.5px; }
  .tagline { text-align: center; font-size: 13px; font-weight: bold; text-decoration: underline; margin-top: 2px; }
  .address { text-align: center; font-size: 12px; color: #334155; margin-top: 4px; }
  .memo-meta { display: flex; justify-content: space-between; margin-top: 16px; padding-top: 10px; border-top: 1px solid #0f172a; font-size: 13px; }
  .patient-row { display: flex; margin-top: 14px; font-size: 13px; }
  .patient-row .label { white-space: nowrap; margin-right: 6px; }
  .patient-row .dots { flex: 1; border-bottom: 1px dotted #64748b; padding-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  th, td { padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 12px; text-align: left; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
  .num { text-align: right; }
  .rs { border-right: none; }
  .ps { border-left: none; text-align: left; }
  .summary-row td { border: none; padding: 2px 8px; color: #475569; }
  .summary-row:first-of-type td { padding-top: 10px; }
  .total-row td { border: none; border-top: 1px solid #0f172a; padding-top: 6px; margin-top: 4px; font-weight: bold; }
  .footer { display: flex; justify-content: space-between; margin-top: 40px; font-size: 12px; }
</style>
</head>
<body>
  <div class="frame">
    <div class="top-row">
      <div class="lic">
        ${business?.drug_license_number_1 ? `<div>Lic. No. ${escapeHtml(business.drug_license_number_1)}</div>` : ''}
        ${business?.drug_license_number_2 ? `<div>Lic. No. ${escapeHtml(business.drug_license_number_2)}</div>` : ''}
      </div>
      <div class="memo-label">CASH MEMO</div>
      <div>${business?.phone ? `Mob. ${escapeHtml(business.phone)}` : ''}</div>
    </div>

    <div class="brand">
      ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="${escapeHtml(business?.name ?? 'Logo')}" />` : ''}
      <h1>${escapeHtml((business?.name ?? 'OrderFlow').toUpperCase())}</h1>
    </div>
    <div class="tagline">RETAIL CHEMIST COSMETICS &amp; DRUGGIST</div>
    ${business?.address ? `<div class="address">${escapeHtml(business.address)}</div>` : ''}

    <div class="memo-meta">
      <div>No. <strong>${escapeHtml(invoice.invoice_number)}</strong></div>
      <div>Dated ${new Date(invoice.created_at).toLocaleDateString('en-IN', { timeZone })}</div>
    </div>

    ${customer?.name || order?.customer_name ? `
    <div class="patient-row">
      <span class="label">Customer Name</span>
      <span class="dots">${escapeHtml(customer?.name ?? order?.customer_name ?? '')}</span>
    </div>
    ` : ''}
    ${customer?.phone ? `
    <div class="patient-row">
      <span class="label">Mobile No.</span>
      <span class="dots">${escapeHtml(customer.phone)}</span>
    </div>
    ` : ''}
    ${order?.patient_name ? `
    <div class="patient-row">
      <span class="label">Patient Name</span>
      <span class="dots">${escapeHtml(order.patient_name)}</span>
    </div>
    ` : ''}
    ${order?.doctor_name ? `
    <div class="patient-row">
      <span class="label">Dr. Name</span>
      <span class="dots">${escapeHtml(order.doctor_name)}</span>
    </div>
    ` : ''}

    <table>
      <thead>
        <tr>
          <th class="num">Qty</th>
          <th>Particulars</th>
          <th>Batch</th>
          <th>Exp. Dt</th>
          <th class="num" colspan="2">Amount</th>
        </tr>
        <tr>
          <th colspan="4"></th>
          <th class="num rs">Rs.</th>
          <th class="ps">P.</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="summary-row">
          <td colspan="4"></td>
          <td class="num rs">Subtotal ₹${subtotalRupees}</td>
          <td class="ps">${subtotalPaise}</td>
        </tr>
        <tr class="summary-row">
          <td colspan="4"></td>
          <td class="num rs">Tax (GST) ₹${taxRupees}</td>
          <td class="ps">${taxPaise}</td>
        </tr>
        <tr class="${previousBalanceDue > 0.01 ? 'summary-row' : 'total-row'}">
          <td colspan="4"></td>
          <td class="num rs">${previousBalanceDue > 0.01 ? 'This Memo' : 'Total'} ₹${totalRupees}</td>
          <td class="ps">${totalPaise}</td>
        </tr>
        ${previousBalanceDue > 0.01 ? (() => {
          const { rupees: prevRupees, paise: prevPaise } = splitRupeesPaise(previousBalanceDue);
          const { rupees: dueRupees, paise: duePaise } = splitRupeesPaise(Number(invoice.total_amount) + previousBalanceDue);
          return `
        <tr class="summary-row">
          <td colspan="4"></td>
          <td class="num rs">Previous Balance ₹${prevRupees}</td>
          <td class="ps">${prevPaise}</td>
        </tr>
        <tr class="total-row">
          <td colspan="4"></td>
          <td class="num rs">Total Due ₹${dueRupees}</td>
          <td class="ps">${duePaise}</td>
        </tr>`;
        })() : ''}
      </tbody>
    </table>

    <div class="footer">
      <div>E. &amp; O.E.</div>
      <div>For ${escapeHtml(business?.name ?? 'OrderFlow')}</div>
    </div>
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
  previousBalanceDue = 0,
) {
  const timeZone = tz(business);
  const line = '-'.repeat(32);
  const rows = items
    .map((item) => {
      const name = escapeHtml(item.product?.name ?? item.custom_product_name ?? '-').slice(0, 20);
      const row = `${name.padEnd(20)}${String(money(item.quantity)).padStart(4)} ${`₹${money(item.subtotal)}`.padStart(8)}`;
      const details = itemDetails(item, timeZone);
      return details.length ? `${row}\n  ${details.join('  ')}` : row;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: 80mm; margin: 0; }
  body { width: 76mm; margin: 0 auto; font-family: 'Courier New', monospace; font-size: 12px; white-space: pre; padding: 8px; }
  @media print { body { width: 76mm; } }
</style>
</head>
<body>${escapeHtml(business?.name ?? 'OrderFlow')}
${escapeHtml(business?.address ?? '')}
${business?.gst_number ? `GSTIN: ${escapeHtml(business.gst_number)}` : ''}
${line}
Invoice: ${escapeHtml(invoice.invoice_number)}
Date: ${new Date(invoice.created_at).toLocaleString('en-IN', { timeZone })}
${order?.status ? `Status: ${escapeHtml(String(order.status).toUpperCase())}\n` : ''}
Customer: ${escapeHtml(customer?.name ?? order?.customer_name ?? 'Walk-in')}
${line}
${rows}
${line}
Tax:    ₹${money(invoice.tax_amount)}
${previousBalanceDue > 0.01 ? `THIS BILL: ₹${money(invoice.total_amount)}
Prev. Due: ₹${money(previousBalanceDue)}
TOTAL DUE: ₹${money(Number(invoice.total_amount) + previousBalanceDue)}` : `TOTAL:  ₹${money(invoice.total_amount)}`}
${line}
Thank you!
<script>
  window.onload = () => {
    // "@page { size: 80mm auto; }" (a length paired with the auto keyword)
    // isn't valid per the CSS Paged Media spec — only a bare "auto", one or
    // two lengths, or a named page-size keyword are allowed. Browsers
    // silently drop the whole malformed declaration and fall back to the
    // system/locale default page size (A4), instead of the intended narrow
    // thermal roll. Compute the real content height and set an explicit
    // "width height" pair so the receipt paper size is honored.
    const heightMm = Math.ceil((document.body.scrollHeight * 25.4) / 96) + 2;
    const pageSize = document.createElement('style');
    pageSize.textContent = \`@page { size: 80mm \${heightMm}mm; margin: 0; }\`;
    document.head.appendChild(pageSize);
    window.print();
  };
</script>
</body>
</html>`;
}
