'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { Printer, Download, MessageCircle } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface InvoiceItem {
  id: string;
  product_id: string | null;
  product?: { name: string } | null;
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
  items: InvoiceItem[];
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const { businessId, ready } = useBusiness();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready || !businessId || !params?.id) return;
    apiClient
      .get<Invoice>(`/api/billing/invoices/${params.id}`, { params: { businessId } })
      .then((res) => setInvoice(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load invoice'));
  }, [ready, businessId, params?.id]);

  if (!ready) return null;

  const subtotal = invoice ? Number(invoice.total_amount) - Number(invoice.tax_amount) : 0;

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
      const res = await apiClient.get(`/api/billing/invoices/${params.id}/pdf`, {
        params: { businessId },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice?.invoice_number || 'invoice'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(await extractErrorMessage(err, 'Failed to download invoice PDF'));
    }
  };

  const thermalPrint = async () => {
    try {
      setError('');
      const res = await apiClient.get(`/api/billing/invoices/${params.id}/receipt`, {
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

  const shareOnWhatsapp = async () => {
    try {
      setError('');
      const res = await apiClient.get<{ url: string }>(`/api/billing/invoices/${params.id}/share-link`, {
        params: { businessId },
      });
      const pdfUrl = `${API_BASE_URL}${res.data.url}`;
      const text = `Invoice ${invoice?.invoice_number}: ${pdfUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } catch (err) {
      setError(await extractErrorMessage(err, 'Failed to create share link'));
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
                  <Button onClick={shareOnWhatsapp} className="gap-1.5">
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Share on WhatsApp</span>
                  </Button>
                </div>
              )
            }
          />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {invoice && (
          <div className="bg-white ring-1 ring-slate-200/70 rounded-2xl overflow-hidden shadow-sm shadow-slate-200/40 print:ring-0 print:shadow-none">
            <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-400 print:hidden" />
            <div className="p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Tax Invoice</h2>
                <p className="text-slate-500 text-sm mt-1">{invoice.invoice_number}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 text-sm">{new Date(invoice.created_at).toLocaleDateString('en-IN')}</p>
                <p className="text-slate-400 text-xs mt-0.5">{new Date(invoice.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                {invoice.order_status && (
                  <div className="mt-2 inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 uppercase tracking-wider">
                    Status: {invoice.order_status}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Billed To</p>
              <p className="text-slate-800 font-semibold">{invoice.customer?.name || 'Walk-in Customer'}</p>
              {invoice.customer?.phone && <p className="text-slate-500 text-sm">{invoice.customer.phone}</p>}
            </div>

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
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 text-slate-800">{item.product?.name || item.custom_product_name || '-'}</td>
                    <td className="py-3 text-right text-slate-600">{Number(item.quantity)}</td>
                    <td className="py-3 text-right text-slate-600">{Number(item.unit_price).toFixed(2)}</td>
                    <td className="py-3 text-right text-slate-600">
                      {Number(item.tax_percentage) > 0 ? `${Number(item.tax_percentage)}%` : '-'}
                    </td>
                    <td className="py-3 text-right text-slate-800 font-medium">
                      {(Number(item.subtotal) + Number(item.tax_amount)).toFixed(2)}
                    </td>
                  </tr>
                ))}
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
                <div className="flex justify-between text-base font-bold text-slate-800 border-t border-slate-200 pt-2">
                  <span>Total</span>
                  <span>{Number(invoice.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
