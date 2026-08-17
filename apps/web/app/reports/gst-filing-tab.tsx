'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, FileSpreadsheet } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/format-currency';

interface RateWiseRow {
  taxPercentage: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  itemCount: number;
}

interface HsnWiseRow {
  hsnCode: string;
  quantity: number;
  taxableValue: number;
  taxAmount: number;
}

interface GstSummary {
  businessGstNumber: string | null;
  rateWise: RateWiseRow[];
  hsnWise: HsnWiseRow[];
  b2b: { invoiceCount: number; totalValue: number };
  b2c: { invoiceCount: number; totalValue: number };
}

/** First day of the current calendar month, as a yyyy-mm-dd date input value. */
function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function GstFilingTab({ businessId }: { businessId: string }) {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [summary, setSummary] = useState<GstSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    apiClient
      .get<GstSummary>('/api/reports/gst-summary', { params: { businessId, from, to: `${to}T23:59:59` } })
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load GST summary'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (businessId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const handleExportCSV = () => {
    if (!summary) return;
    const rows: string[] = [];
    rows.push(`GST Summary,${from} to ${to}`);
    rows.push(`GSTIN,${csvEscape(summary.businessGstNumber || 'Not set')}`);
    rows.push('');
    rows.push('Rate-wise Summary');
    rows.push(['Tax Rate %', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Line Items'].join(','));
    for (const r of summary.rateWise) {
      rows.push([r.taxPercentage, r.taxableValue.toFixed(2), r.cgstAmount.toFixed(2), r.sgstAmount.toFixed(2), r.igstAmount.toFixed(2), r.totalTax.toFixed(2), r.itemCount].join(','));
    }
    rows.push('');
    rows.push('HSN-wise Summary');
    rows.push(['HSN Code', 'Quantity', 'Taxable Value', 'Tax Amount'].join(','));
    for (const h of summary.hsnWise) {
      rows.push([csvEscape(h.hsnCode), h.quantity, h.taxableValue.toFixed(2), h.taxAmount.toFixed(2)].join(','));
    }
    rows.push('');
    rows.push('B2B vs B2C');
    rows.push(['Type', 'Invoice Count', 'Total Value'].join(','));
    rows.push(['B2B (customer has GSTIN)', summary.b2b.invoiceCount, summary.b2b.totalValue.toFixed(2)].join(','));
    rows.push(['B2C (no GSTIN)', summary.b2c.invoiceCount, summary.b2c.totalValue.toFixed(2)].join(','));

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gst_summary_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <CardTitle className="text-base">GST Filing Summary</CardTitle>
          <CardDescription>
            Rate-wise and HSN-wise breakdown for GSTR-1/3B filing.
            {summary?.businessGstNumber ? ` GSTIN: ${summary.businessGstNumber}` : ' No GSTIN set on file — add one in Settings for this report to be filing-ready.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Generate'}</Button>
            <Button variant="outline" onClick={handleExportCSV} disabled={!summary} className="gap-1.5">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>
          {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
        </CardContent>
      </Card>

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card className="ring-white/50 glass-sheen-sm">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">B2B Sales (GSTIN on file)</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(summary.b2b.totalValue)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{summary.b2b.invoiceCount} order{summary.b2b.invoiceCount !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>
            <Card className="ring-white/50 glass-sheen-sm">
              <CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">B2C Sales (no GSTIN)</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(summary.b2c.totalValue)}</p>
                <p className="text-xs text-slate-500 mt-0.5">{summary.b2c.invoiceCount} order{summary.b2c.invoiceCount !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="ring-white/50 glass-sheen-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Rate-wise Summary</CardTitle>
              <CardDescription>Taxable value and CGST/SGST/IGST grouped by GST rate — matches GSTR-1 Table 9.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {summary.rateWise.length === 0 ? (
                <p className="p-10 text-center text-slate-400 text-sm">No taxed sales in this period.</p>
              ) : (
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-4 text-left">Rate</th>
                      <th className="py-2 px-4 text-right">Taxable Value</th>
                      <th className="py-2 px-4 text-right">CGST</th>
                      <th className="py-2 px-4 text-right">SGST</th>
                      <th className="py-2 px-4 text-right">IGST</th>
                      <th className="py-2 px-4 text-right">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.rateWise.map((r) => (
                      <tr key={r.taxPercentage}>
                        <td className="py-2.5 px-4 font-medium text-slate-800">{r.taxPercentage}%</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(r.taxableValue)}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(r.cgstAmount)}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(r.sgstAmount)}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(r.igstAmount)}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-slate-800">{formatCurrency(r.totalTax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card className="ring-white/50 glass-sheen-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> HSN-wise Summary</CardTitle>
              <CardDescription>
                Matches GSTR-1 Table 12. Products without an HSN code appear as &quot;Unclassified&quot; — add HSN codes in Products for a complete filing.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {summary.hsnWise.length === 0 ? (
                <p className="p-10 text-center text-slate-400 text-sm">No sales in this period.</p>
              ) : (
                <table className="w-full text-sm min-w-[560px]">
                  <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-4 text-left">HSN Code</th>
                      <th className="py-2 px-4 text-right">Quantity</th>
                      <th className="py-2 px-4 text-right">Taxable Value</th>
                      <th className="py-2 px-4 text-right">Tax Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.hsnWise.map((h) => (
                      <tr key={h.hsnCode}>
                        <td className={`py-2.5 px-4 font-medium ${h.hsnCode === 'Unclassified' ? 'text-amber-600' : 'text-slate-800'}`}>{h.hsnCode}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{h.quantity}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(h.taxableValue)}</td>
                        <td className="py-2.5 px-4 text-right font-semibold text-slate-800">{formatCurrency(h.taxAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
