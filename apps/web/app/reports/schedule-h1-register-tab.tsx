'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, AlertTriangle } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { formatDate } from '@/lib/format-currency';

interface RegisterRow {
  orderId: string;
  orderNumber: string | null;
  soldAt: string;
  customerName: string;
  patientName: string | null;
  doctorName: string | null;
  doctorRegistrationNumber: string | null;
  productName: string;
  batchNumber: string | null;
  expiryDate: string | null;
  quantity: number;
}

/** 90 days back, as a yyyy-mm-dd date input value — covers a typical inspection lookback without querying the full 2-year retention window every load. */
function ninetyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ScheduleH1RegisterTab({ businessId }: { businessId: string }) {
  const [from, setFrom] = useState(ninetyDaysAgo());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<RegisterRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    apiClient
      .get<RegisterRow[]>('/api/reports/schedule-h1-register', { params: { businessId, from, to: `${to}T23:59:59` } })
      .then((res) => setRows(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load register'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (businessId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const missingRegNumber = (rows || []).filter((r) => !r.doctorRegistrationNumber).length;

  const handleExportCSV = () => {
    if (!rows) return;
    const csvRows: string[] = [];
    csvRows.push(`Schedule H1/X Drug Register,${from} to ${to}`);
    csvRows.push('');
    csvRows.push(['Date', 'Order #', 'Product', 'Batch', 'Qty', 'Customer', 'Patient Name', 'Doctor Name', 'Doctor Reg. No.'].join(','));
    for (const r of rows) {
      csvRows.push([
        csvEscape(new Date(r.soldAt).toISOString().slice(0, 10)),
        csvEscape(r.orderNumber || ''),
        csvEscape(r.productName),
        csvEscape(r.batchNumber || ''),
        r.quantity,
        csvEscape(r.customerName),
        csvEscape(r.patientName || ''),
        csvEscape(r.doctorName || ''),
        csvEscape(r.doctorRegistrationNumber || ''),
      ].join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule_h1_register_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <CardTitle className="text-base">Schedule H1/X Drug Register</CardTitle>
          <CardDescription>
            Every sale of a medicine marked &quot;Schedule H1/X&quot; in Medicines, with the patient and prescribing doctor's
            registration number captured at checkout — the record Drugs Rules 1945 Rule 65 requires you to retain for 2 years.
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
            <Button variant="outline" onClick={handleExportCSV} disabled={!rows} className="gap-1.5">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>
          {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
        </CardContent>
      </Card>

      {rows && missingRegNumber > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{missingRegNumber} sale{missingRegNumber !== 1 ? 's' : ''} in this period {missingRegNumber !== 1 ? 'are' : 'is'} missing the doctor's registration number — highlighted below.</span>
        </div>
      )}

      <Card className="ring-white/50 glass-sheen-sm">
        <CardContent className="p-0 overflow-x-auto">
          {!rows || rows.length === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">
              {rows ? 'No Schedule H1/X sales in this period.' : 'Generate the register to see entries.'}
            </p>
          ) : (
            <table className="w-full text-sm min-w-[900px]">
              <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2 px-4 text-left">Date</th>
                  <th className="py-2 px-4 text-left">Product</th>
                  <th className="py-2 px-4 text-left">Batch</th>
                  <th className="py-2 px-4 text-right">Qty</th>
                  <th className="py-2 px-4 text-left">Customer</th>
                  <th className="py-2 px-4 text-left">Patient</th>
                  <th className="py-2 px-4 text-left">Doctor</th>
                  <th className="py-2 px-4 text-left">Doctor Reg. No.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={`${r.orderId}-${i}`} className={!r.doctorRegistrationNumber ? 'bg-amber-500/5' : ''}>
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{formatDate(r.soldAt)}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">{r.productName}</td>
                    <td className="py-2.5 px-4 text-slate-600">{r.batchNumber || '-'}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600">{r.quantity}</td>
                    <td className="py-2.5 px-4 text-slate-600">{r.customerName}</td>
                    <td className="py-2.5 px-4 text-slate-600">{r.patientName || '-'}</td>
                    <td className="py-2.5 px-4 text-slate-600">{r.doctorName || '-'}</td>
                    <td className={`py-2.5 px-4 font-medium ${!r.doctorRegistrationNumber ? 'text-amber-700' : 'text-slate-800'}`}>
                      {r.doctorRegistrationNumber || 'Missing'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
