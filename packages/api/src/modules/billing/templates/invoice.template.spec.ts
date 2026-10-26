import { renderInvoiceHtml, renderA4ReceiptHtml } from './invoice.template';

// Invoice HTML is rendered by headless Chromium on the server (and shown in the browser for
// receipts) and embeds tenant-supplied names, so an unescaped quote in a name must not be able to
// add attributes to the logo <img>.
describe('invoice templates escaping', () => {
  const evilName = 'Shop" onload="document.body.innerHTML=1" x="';
  const invoice = { invoice_number: 'INV/1', created_at: new Date('2026-01-01'), tax_amount: 0, total_amount: 10, subtotal: 10 } as any;
  const business = { name: evilName, address: 'A', timezone: 'Asia/Kolkata' } as any;
  const logo = 'data:image/png;base64,AAAA';

  it.each([
    ['GST invoice', () => renderInvoiceHtml(invoice, [], business, null, null, logo)],
    ['A4 receipt', () => renderA4ReceiptHtml(invoice, [], business, null, null, 0, logo, null)],
  ])('%s keeps a quote in the business name inside the alt attribute', (_label, render) => {
    const html = render();
    expect(html).not.toContain('" onload="');
    expect(html).toContain('&quot; onload=&quot;');
  });
});
