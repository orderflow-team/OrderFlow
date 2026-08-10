/**
 * Client-side thermal receipt renderer — used at checkout time so printing
 * never depends on a network round trip (the existing GET /api/orders/:id/receipt
 * route requires a synced order and stays in use for reprinting past invoices
 * from apps/web/app/billing/invoices/[id]/page.tsx). Mirrors the layout of
 * packages/api/src/modules/billing/templates/invoice.template.ts's
 * renderThermalReceiptHtml so a printed receipt looks the same whether it
 * came from the server or was queued offline.
 *
 * Tax isn't shown here — the cart only knows selling_price client-side; the
 * per-item tax_percentage used by the server isn't sent to this screen, and
 * offline queued orders don't know their tax breakdown until they sync.
 */

import { toAbsoluteFileUrl } from './api-client';

export interface ReceiptBusiness {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  gst_number?: string | null;
  logo_url?: string | null;
  upi_qr_url?: string | null;
  custom_settings?: { receipt?: { showUpiQrCode?: boolean; termsAndConditions?: string } } | null;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  subtotal: number;
}

export interface ReceiptData {
  business: ReceiptBusiness | null;
  orderNumber: string;
  createdAt: string | Date;
  customerName: string;
  customerPhone?: string;
  items: ReceiptItem[];
  totalAmount: number;
  // Not fetched here — this builder is deliberately network-free so checkout
  // printing never depends on a round trip (see file doc comment above).
  // Defaults to 0; the server-rendered A4 receipt (orders.service.ts) fills
  // in the real figure since it already has DB access.
  receivedAmount?: number;
  queued?: boolean;
}

const money = (n: number) => n.toFixed(2);

// Item/customer/business names are free text a cashier can type — escape
// before interpolating into HTML so a name like "<script>..." can't execute
// in the print window (which, as a same-origin popup, can reach back into
// window.opener otherwise).
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigitWords = (n: number): string =>
  n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');

const threeDigitWords = (n: number): string => {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (!hundreds) return twoDigitWords(rest);
  return `${ONES[hundreds]} Hundred${rest ? ' and ' + twoDigitWords(rest) : ''}`;
};

/** Indian numbering system (lakh/crore) — mirrors the server-side helper in invoice.template.ts. */
function numberToWordsIndian(n: number): string {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitWords(hundred));
  return parts.join(' ');
}

const amountInWords = (n: number) => `${numberToWordsIndian(Math.floor(n))} Rupees only`;

export function buildReceiptHtml(data: ReceiptData): string {
  const line = '-'.repeat(32);
  const rows = data.items
    .map((item) => {
      const name = escapeHtml(item.name).slice(0, 20);
      const row = `${name.padEnd(20)}${String(item.quantity).padStart(4)} ${`₹${money(item.subtotal)}`.padStart(8)}`;
      const unit = item.unit ? `  @ ₹${money(item.unitPrice)}/${escapeHtml(item.unit)}` : '';
      return unit ? `${row}\n${unit}` : row;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="color-scheme" content="light only" />
<style>
  :root { color-scheme: light only; }
  @page { size: 80mm; margin: 0; }
  html, body { background: #ffffff; color: #000000; }
  body { width: 76mm; margin: 0 auto; font-family: 'Courier New', monospace; font-size: 12px; white-space: pre; padding: 8px; }
  @media print { body { width: 76mm; } }
</style>
</head>
<body>${escapeHtml(data.business?.name ?? 'OBIX')}
${escapeHtml(data.business?.address ?? '')}
${data.business?.gst_number ? `GSTIN: ${escapeHtml(data.business.gst_number)}` : ''}
${line}
Order: ${escapeHtml(data.orderNumber)}
Date: ${new Date(data.createdAt).toLocaleString('en-IN')}
Customer: ${escapeHtml(data.customerName || 'Walk-in')}
${line}
${rows}
${line}
TOTAL:  ₹${money(data.totalAmount)}
${line}
${data.queued ? 'Recorded offline — will sync automatically.\n' : ''}Thank you!
<script>
  window.onload = () => {
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

/**
 * Rich A4 "Bill of Supply" style receipt — used instead of buildReceiptHtml
 * when the business's Paper Size setting is "a4". Unlike the server-rendered
 * equivalent (renderA4ReceiptHtml in invoice.template.ts, used for the
 * GET /api/orders/:id/receipt fallback), images here are plain <img src="...">
 * URLs rather than base64 data URIs — this renders in a real browser popup
 * via document.write(), not Puppeteer, so relative/absolute URLs resolve
 * normally without needing to be inlined.
 */
export function buildA4ReceiptHtml(data: ReceiptData): string {
  const totalQuantity = data.items.reduce((sum, item) => sum + item.quantity, 0);
  const rows = data.items
    .map((item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td></td>
          <td class="num">${item.quantity}</td>
          <td>${escapeHtml(item.unit ?? '-')}</td>
          <td class="num">₹${money(item.unitPrice)}</td>
          <td class="num">₹${money(item.subtotal)}</td>
        </tr>`)
    .join('');

  const receivedAmount = data.receivedAmount ?? 0;
  const balance = data.totalAmount - receivedAmount;
  const previousBalance = 0;
  const currentBalance = previousBalance + balance;

  const logoUrl = toAbsoluteFileUrl(data.business?.logo_url);
  const upiQrUrl = toAbsoluteFileUrl(data.business?.upi_qr_url);
  const showUpiQr = !!upiQrUrl && data.business?.custom_settings?.receipt?.showUpiQrCode !== false;
  const termsAndConditions = data.business?.custom_settings?.receipt?.termsAndConditions;

  const created = new Date(data.createdAt);
  const invoiceDate = created.toLocaleDateString('en-IN');
  const invoiceTime = created.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const customerName = escapeHtml(data.customerName || 'Walk-in Customer');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="color-scheme" content="light only" />
<style>
  /* A printed document must always look the same regardless of the viewer's
     dark-mode setting — without an explicit background + color-scheme,
     Android Chrome's "force dark" (and similar) recolors the page to a
     near-black background, making the light-gray/muted text unreadable. */
  :root { color-scheme: light only; }
  html, body { background: #ffffff; }
  @page { size: A4; margin: 16mm; }
  body { font-family: Arial, sans-serif; color: #1e293b; font-size: 13px; }
  .muted { color: #64748b; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .business-header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 10px; }
  .business-header .logo { height: 56px; max-width: 180px; object-fit: contain; }
  .business-header h1 { font-size: 22px; margin: 0 0 2px; }
  .bos-title { text-align: center; font-size: 18px; font-weight: bold; padding: 8px 0; border-bottom: 2px solid #0f172a; margin-bottom: 14px; }
  .two-col { display: flex; justify-content: space-between; margin-bottom: 16px; }
  .two-col .col { width: 48%; }
  .two-col .label { font-weight: bold; margin-bottom: 2px; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  table.items th { background: #7B7FD4; color: #fff; padding: 8px; font-size: 12px; text-align: left; font-weight: 600; }
  table.items td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  table.items .num { text-align: right; }
  table.items tfoot td { font-weight: bold; border-top: 2px solid #0f172a; border-bottom: none; }
  .below-table { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
  .words-terms { width: 55%; font-size: 12px; }
  .words-terms .row { margin-bottom: 10px; }
  .summary-box { width: 40%; font-size: 13px; }
  .summary-box .row { display: flex; justify-content: space-between; padding: 3px 0; }
  .summary-box .row.total, .summary-box .row.current { font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 2px; }
  .bank-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; }
  .bank-details .qr { width: 100px; height: 100px; object-fit: contain; display: block; }
  .bank-details .upi-badge { display: inline-block; background: #00BA5B; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 8px; border-radius: 4px; margin-top: 4px; }
  .signature { text-align: right; font-size: 13px; }
  .signature .for-line { margin-bottom: 48px; }
  .ack-divider { border-top: 1px dashed #94a3b8; margin: 28px 0 16px; }
  .ack-title { text-align: center; color: #8B8FE8; font-weight: bold; font-size: 16px; margin-bottom: 16px; }
  .ack-cols { display: flex; justify-content: space-between; font-size: 12px; }
  .ack-cols .muted-label { color: #94a3b8; }
  .ack-seal { text-align: center; font-size: 11px; }
  .ack-seal .line { border-top: 1px dashed #94a3b8; width: 100px; margin: 24px auto 4px; }
</style>
</head>
<body>
  <div class="business-header">
    ${logoUrl ? `<img class="logo" src="${logoUrl}" alt="${escapeHtml(data.business?.name ?? 'Logo')}" />` : ''}
    <div>
      <h1>${escapeHtml(data.business?.name ?? 'OBIX')}</h1>
      ${data.business?.address ? `<div class="muted">${escapeHtml(data.business.address)}</div>` : ''}
      ${data.business?.phone ? `<div class="muted">Phone no.: ${escapeHtml(data.business.phone)}</div>` : ''}
    </div>
  </div>
  <div class="bos-title">Bill of Supply</div>

  <div class="two-col">
    <div class="col">
      <div class="label">Bill To</div>
      <div class="bold">${customerName}</div>
      ${data.customerPhone ? `<div class="muted">Contact No.: ${escapeHtml(data.customerPhone)}</div>` : ''}
    </div>
    <div class="col right">
      <div class="label">Invoice Details</div>
      <div>Invoice No.: ${escapeHtml(data.orderNumber)}</div>
      <div>Date: ${invoiceDate}</div>
      <div>Time: ${invoiceTime}</div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr><th>Item name</th><th>HSN/SAC</th><th class="num">Quantity</th><th>Unit</th><th class="num">Price/unit</th><th class="num">Amount</th></tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td>Total</td><td></td><td class="num">${totalQuantity}</td><td></td><td></td><td class="num">₹${money(data.totalAmount)}</td></tr>
    </tfoot>
  </table>

  <div class="below-table">
    <div class="words-terms">
      <div class="row"><span class="bold">Invoice Amount In Words:</span> ${amountInWords(data.totalAmount)}</div>
      ${termsAndConditions ? `<div class="row"><span class="bold">Terms and conditions:</span> ${escapeHtml(termsAndConditions)}</div>` : ''}
      ${data.queued ? '<div class="row muted">Recorded offline — will sync automatically.</div>' : ''}
    </div>
    <div class="summary-box">
      <div class="row"><span>Sub Total</span><span>₹${money(data.totalAmount)}</span></div>
      <div class="row total"><span>Total</span><span>₹${money(data.totalAmount)}</span></div>
      <div class="row"><span>Received</span><span>₹${money(receivedAmount)}</span></div>
      <div class="row"><span>Balance</span><span>₹${money(balance)}</span></div>
      <div class="row"><span>Previous Balance</span><span>₹${money(previousBalance)}</span></div>
      <div class="row current"><span>Current Balance</span><span>₹${money(currentBalance)}</span></div>
    </div>
  </div>

  <div class="bank-section">
    ${showUpiQr ? `
    <div class="bank-details">
      <div class="bold">Bank Details</div>
      <img class="qr" src="${upiQrUrl}" alt="UPI QR Code" />
      <div class="upi-badge">CLICK TO PAY</div>
    </div>
    ` : '<div></div>'}
    <div class="signature">
      <div class="for-line">For: ${escapeHtml(data.business?.name ?? 'OBIX')}</div>
      <div>Authorized Signatory</div>
    </div>
  </div>

  <div class="ack-divider"></div>
  <div class="ack-title">Acknowledgment</div>
  <div class="ack-cols">
    <div>
      <div class="muted-label">Invoice To:</div>
      <div class="bold">${customerName}</div>
    </div>
    <div>
      <div class="muted-label">Invoice Details:</div>
      <div>Invoice No. : ${escapeHtml(data.orderNumber)}</div>
      <div>Invoice Date : ${invoiceDate}</div>
      <div>Invoice Amount : ₹${money(data.totalAmount)}</div>
    </div>
    <div class="ack-seal">
      <div class="line"></div>
      <div>Receiver's Seal &amp; Sign</div>
    </div>
  </div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;
}

export function printReceiptHtml(html: string): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}
