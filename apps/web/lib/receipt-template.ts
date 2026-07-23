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

export interface ReceiptBusiness {
  name?: string | null;
  address?: string | null;
  gst_number?: string | null;
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
  items: ReceiptItem[];
  totalAmount: number;
  queued?: boolean;
}

const money = (n: number) => n.toFixed(2);

// Item/customer/business names are free text a cashier can type — escape
// before interpolating into HTML so a name like "<script>..." can't execute
// in the print window (which, as a same-origin popup, can reach back into
// window.opener otherwise).
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
<style>
  @page { size: 80mm; margin: 0; }
  body { width: 76mm; margin: 0 auto; font-family: 'Courier New', monospace; font-size: 12px; white-space: pre; padding: 8px; }
  @media print { body { width: 76mm; } }
</style>
</head>
<body>${escapeHtml(data.business?.name ?? 'OrderFlow')}
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

export function printReceiptHtml(html: string): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}
