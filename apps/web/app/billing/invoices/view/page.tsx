'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { Printer, Download, MessageCircle } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://orderflow-1.onrender.com';

interface InvoiceItem {
  id: string;
  product_id: string | null;
  product?: { name: string; batch_number?: string | null; expiry_date?: string | null; prescription_required?: boolean } | null;
  custom_product_name: string | null;
  quantity: string | number;
  unit_price: string | number;
  subtotal: string | number;
  tax_percentage: string | number;
  tax_amount: string | number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  total_amount: string | number;
  tax_amount: string | number;
  created_at: string;
  order_status?: string;
  customer?: { name: string; phone?: string | null } | null;
  order_customer_name?: string | null;
  patient_name?: string | null;
  doctor_name?: string | null;
  previous_balance_due?: string | number;
  items: InvoiceItem[];
}

export default function InvoiceDetailPage() {
  return (
    <Suspense fallback={null}>
      <InvoiceDetailPageInner />
    </Suspense>
  );
}

function InvoiceDetailPageInner() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id') || '';
  const { businessId, ready } = useBusiness();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const [shareFallbackReason, setShareFallbackReason] = useState('');
  const [pdfReady, setPdfReady] = useState(false);
  const pdfBlobRef = useRef<Blob | null>(null);
  const pdfBlobPromiseRef = useRef<Promise<Blob> | null>(null);

  useEffect(() => {
    if (!ready || !businessId || !id) return;
    pdfBlobRef.current = null;
    setPdfReady(false);

    apiClient
      .get<Invoice>(`/api/billing/invoices/${id}`, { params: { businessId } })
      .then((res) => setInvoice(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load invoice'));

    // Prefetch the PDF now so the WhatsApp button can call navigator.share()
    // synchronously on click, with no awaited work in between. Safari (and
    // increasingly Chrome) revokes the "user activation" a click grants if
    // there's an async gap before share() is called, so calling it right
    // after an awaited fetch silently fails and falls back to a text link.
    pdfBlobPromiseRef.current = apiClient
      .get(`/api/billing/invoices/${id}/pdf`, { params: { businessId }, responseType: 'blob' })
      .then((res) => {
        pdfBlobRef.current = res.data;
        setPdfReady(true);
        return res.data as Blob;
      });
  }, [ready, businessId, id]);

  if (!ready) return null;

  const subtotal = invoice ? Number(invoice.total_amount) - Number(invoice.tax_amount) : 0;
  const previousBalanceDue = Number(invoice?.previous_balance_due || 0);

  const extractErrorMessage = async (err: any, fallback: string) => {
    const data = err?.response?.data;
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text());
        return parsed?.message || fallback;
      } catch {
        return fallback;
      }
    }
    return data?.message || fallback;
  };

  const downloadPdf = async () => {
    try {
      setError('');
      let blob = pdfBlobRef.current;
      if (!blob) {
        if (pdfBlobPromiseRef.current) {
          blob = await pdfBlobPromiseRef.current;
        } else if (id && businessId) {
          const res = await apiClient.get(`/api/billing/invoices/${id}/pdf`, {
            params: { businessId },
            responseType: 'blob',
          });
          blob = res.data;
          pdfBlobRef.current = blob;
        }
      }
      if (!blob) {
        throw new Error('Failed to retrieve PDF blob.');
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoice?.invoice_number || 'invoice'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(await extractErrorMessage(err, 'Failed to download invoice PDF'));
    }
  };

  const thermalPrint = async () => {
    try {
      setError('');
      const res = await apiClient.get(`/api/billing/invoices/${id}/receipt`, {
        params: { businessId },
        responseType: 'text',
      });
      const win = window.open('', '_blank');
      if (!win) {
        setError('Pop-up blocked — please allow pop-ups to print the receipt.');
        return;
      }
      win.document.write(res.data);
      win.document.close();
    } catch (err) {
      setError(await extractErrorMessage(err, 'Failed to open thermal receipt'));
    }
  };

  const buildWhatsappTarget = (phone?: string | null) => {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return '';
    // Bare 10-digit Indian mobile numbers arrive without a country code.
    return digits.length === 10 ? `91${digits}` : digits;
  };

  const shareOnWhatsapp = async () => {
    try {
      setError('');
      setShareFallbackReason('');

      // On devices that support sharing files (mobile Web Share API), hand
      // WhatsApp the real PDF directly — no download/attach step at all.
      // The PDF is rendered server-side via Puppeteer from plain HTML/CSS,
      // avoiding the oklch() colors Tailwind v4 emits that html2canvas
      // can't parse (the previous client-side screenshot approach failed here).
      if (navigator.canShare && pdfBlobRef.current) {
        try {
          const blob = pdfBlobRef.current;
          const file = new File([blob], `${invoice?.invoice_number || 'invoice'}.pdf`, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Invoice ${invoice?.invoice_number}`,
              text: `Here is the invoice ${invoice?.invoice_number}`,
            });
            return; // Successfully shared the file directly
          }
          setShareFallbackReason('canShare({files}) returned false for this PDF — this browser reports Web Share support but refuses to share a PDF file specifically.');
        } catch (fileErr: any) {
          if (fileErr.name === 'AbortError') {
            return; // User cancelled the share dialog
          }
          setShareFallbackReason(`navigator.share() threw: ${fileErr.name || 'Error'} — ${fileErr.message || String(fileErr)}`);
          console.warn('Direct file share failed, falling back to share link:', fileErr);
        }
      } else {
        if (!navigator.canShare) {
          setShareFallbackReason('navigator.canShare is not defined — this browser has no Web Share API (file sharing) support at all.');
        } else {
          setShareFallbackReason('PDF prefetch had not finished by the time you tapped Share.');
        }
      }

      // No file-sharing support (desktop browsers) — WhatsApp Web has no API
      // to auto-attach a file, so instead send a link that resolves straight
      // to the real PDF. The recipient opens it and gets the actual invoice,
      // with no manual download/attach step for the sender either.
      const { data } = await apiClient.get<{ url: string }>(`/api/billing/invoices/${id}/share-link`, {
        params: { businessId },
      });
      const pdfUrl = `${API_BASE_URL}${data.url}`;
      const text = `Here is your invoice ${invoice?.invoice_number}: ${pdfUrl}`;
      const target = buildWhatsappTarget(invoice?.customer?.phone);
      window.open(`https://wa.me/${target}?text=${encodeURIComponent(text)}`, '_blank');
    } catch (err) {
      setError(await extractErrorMessage(err, 'Failed to process invoice PDF for sharing'));
    }
  };

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6 print:p-0">
        <div className="print:hidden">
          <PageHeader
            title="Invoice"
            action={
              invoice && (
                <div className="flex gap-2">
                  <Button onClick={downloadPdf} variant="outline" className="gap-1.5">
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download PDF</span>
                  </Button>
                  <Button onClick={thermalPrint} variant="outline" className="gap-1.5">
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Thermal Print</span>
                  </Button>
                  <Button
                    onClick={shareOnWhatsapp}
                    disabled={!pdfReady}
                    title={!pdfReady ? 'Preparing PDF...' : undefined}
                    className="gap-1.5 bg-[#25D366] hover:bg-[#1ebd5b] text-white px-4 md:px-5 disabled:opacity-60"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                    </svg>
                    <span className="hidden sm:inline text-[15px] font-medium">{pdfReady ? 'Share on WhatsApp' : 'Preparing...'}</span>
                  </Button>
                </div>
              )
            }
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {shareFallbackReason && <p className="text-xs text-amber-600 print:hidden">Sent as a link instead of the file: {shareFallbackReason}</p>}

        {invoice && (
          <div id="invoice-pdf-content" className="bg-white/40 backdrop-blur-md ring-1 ring-white/50 glass-sheen-sm rounded-3xl overflow-hidden print:bg-white print:ring-0 print:shadow-none print:backdrop-blur-none">
            <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-400 print:hidden" />
            <div className="p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Tax Invoice</h2>
                <p className="text-slate-500 text-sm mt-1">{invoice.invoice_number}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-sm">{new Date(invoice.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                <p className="text-slate-400 text-xs mt-0.5">{new Date(invoice.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</p>
                {invoice.order_status && (
                  <div className="mt-2 inline-flex items-center rounded-full bg-emerald-500/10 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-500/20 uppercase tracking-wider">
                    Status: {invoice.order_status}
                  </div>
                )}
              </div>
            </div>

            {/* Customer Details (Billed To) - only shown if name or phone exists */}
            {(invoice.customer?.name || invoice.order_customer_name || invoice.customer?.phone) && (
              <div className="mb-6">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Billed To</p>
                {(invoice.customer?.name || invoice.order_customer_name) && (
                  <p className="text-slate-800 font-semibold">
                    {invoice.customer?.name || invoice.order_customer_name}
                  </p>
                )}
                {invoice.customer?.phone && (
                  <p className="text-slate-500 text-sm">{invoice.customer.phone}</p>
                )}
              </div>
            )}

            {/* Pharmacy details (Patient & Doctor) - only shown if they exist */}
            {(invoice.patient_name || invoice.doctor_name) && (
              <div className="mb-6 grid grid-cols-2 gap-4">
                {invoice.patient_name && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Patient Name</p>
                    <p className="text-slate-800 font-semibold">{invoice.patient_name}</p>
                  </div>
                )}
                {invoice.doctor_name && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Doctor Name</p>
                    <p className="text-slate-800 font-semibold">{invoice.doctor_name}</p>
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto w-full pb-2"><table className="w-full text-sm text-left mb-6 min-w-[800px]">
              <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2">Item</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Tax</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.items.map((item) => {
                  const details: string[] = [];
                  if (item.product?.batch_number) details.push(`Batch: ${item.product.batch_number}`);
                  if (item.product?.expiry_date) details.push(`Exp: ${new Date(item.product.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}`);
                  if (item.product?.prescription_required) details.push('Rx');
                  return (
                  <tr key={item.id}>
                    <td className="py-3 text-slate-800">
                      {item.product?.name || item.custom_product_name || '-'}
                      {details.length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">{details.join('  •  ')}</p>
                      )}
                    </td>
                    <td className="py-3 text-right text-slate-600">{Number(item.quantity)}</td>
                    <td className="py-3 text-right text-slate-600">{Number(item.unit_price).toFixed(2)}</td>
                    <td className="py-3 text-right text-slate-600">
                      {Number(item.tax_percentage) > 0 ? `${Number(item.tax_percentage)}%` : '-'}
                    </td>
                    <td className="py-3 text-right text-slate-800 font-medium">
                      {(Number(item.subtotal) + Number(item.tax_amount)).toFixed(2)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table></div>

            <div className="flex justify-end">
              <div className="w-56 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax (GST)</span>
                  <span>{Number(invoice.tax_amount).toFixed(2)}</span>
                </div>
                {previousBalanceDue > 0.01 ? (
                  <>
                    <div className="flex justify-between text-base font-bold text-slate-800 border-t border-slate-200 pt-2">
                      <span>This Invoice</span>
                      <span>{Number(invoice.total_amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Previous Balance Due</span>
                      <span>{previousBalanceDue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-rose-700 border-t border-slate-200 pt-2">
                      <span>Total Amount Due</span>
                      <span>{(Number(invoice.total_amount) + previousBalanceDue).toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-base font-bold text-slate-800 border-t border-slate-200 pt-2">
                    <span>Total</span>
                    <span>{Number(invoice.total_amount).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
