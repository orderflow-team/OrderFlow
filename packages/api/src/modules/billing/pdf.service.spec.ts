import * as path from 'path';
import { invoiceFilenameStem } from './pdf.service';

describe('invoiceFilenameStem', () => {
  it('replaces the slashes in a GST-format invoice number with a filename-safe separator', () => {
    expect(invoiceFilenameStem('INV/2026-27/00001')).toBe('INV-2026-27-00001');
  });

  it('replaces backslashes too', () => {
    expect(invoiceFilenameStem('INV\\2026-27\\00001')).toBe('INV-2026-27-00001');
  });

  it('leaves an already-safe legacy-format invoice number unchanged', () => {
    expect(invoiceFilenameStem('INV-1786527603959')).toBe('INV-1786527603959');
  });

  it('never lets a slash-containing invoice number turn path.join into a nested directory (regression guard for the original bug)', () => {
    // The exact failure mode that shipped: pdf.service.ts built filePath via
    // path.join(UPLOADS_DIR, `${invoice.invoice_number}.pdf`) directly — since
    // every GST-format invoice number contains "/", path.join treated it as a
    // directory separator and tried to write into a folder that's never
    // created, throwing ENOENT uncaught for every single invoice.
    const uploadsDir = path.join('/app', 'uploads', 'invoices');
    const filePath = path.join(uploadsDir, `${invoiceFilenameStem('INV/2026-27/00001')}.pdf`);

    expect(path.dirname(filePath)).toBe(uploadsDir);
    expect(path.basename(filePath)).toBe('INV-2026-27-00001.pdf');
  });
});
