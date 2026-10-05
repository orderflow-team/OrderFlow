'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/format-currency';
import { buildCsv, dateRangePreset, downloadCsv, printReport } from '@/lib/report-export';
import { DateRangeBar } from './date-range-bar';

interface DayBookEntry {
  at: string;
  type: 'sale' | 'payment' | 'expense' | 'purchase';
  reference: string;
  party: string;
  description: string;
  moneyIn: number;
  moneyOut: number;
  saleAmount: number;
}
interface DayBook {
  truncated?: boolean;
  entries: DayBookEntry[];
  totals: { sales: number; moneyIn: number; moneyOut: number; net: number };
}

const TYPE_STYLE: Record<DayBookEntry['type'], string> = {
  sale: 'bg-indigo-500/10 text-indigo-700',
  payment: 'bg-emerald-500/10 text-emerald-700',
  expense: 'bg-rose-500/10 text-rose-700',
  purchase: 'bg-amber-500/10 text-amber-700',
};

const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function DayBookTab({ businessId }: { businessId: string }) {
  const [range, setRange] = useState(dateRangePreset('today'));
  const [data, setData] = useState<DayBook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const load = () => {
    const id = ++requestId.current; // a slower, older response must not overwrite a newer one
    setLoading(true);
    setError('');
    apiClient
      .get<DayBook>('/api/reports/day-book', { params: { businessId, ...range } })
      .then((res) => { if (id === requestId.current) setData(res.data); })
      .catch((err) => { if (id === requestId.current) setError(err.response?.data?.message || 'Failed to load day book'); })
      .finally(() => { if (id === requestId.current) setLoading(false); });
  };

  useEffect(() => {
    if (businessId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const headers = ['Time', 'Type', 'Reference', 'Party', 'Details', 'Sale', 'Money In', 'Money Out'];
  const rows = () =>
    (data?.entries ?? []).map((e) => [fmtTime(e.at), e.type, e.reference, e.party, e.description, e.saleAmount || '', e.moneyIn || '', e.moneyOut || '']);
  const title = `Day Book ${range.from} to ${range.to}`;
  const stats: [string, number, string][] = data
    ? [
        ['Sales billed', data.totals.sales, 'text-indigo-700'],
        ['Money in', data.totals.moneyIn, 'text-emerald-700'],
        ['Money out', data.totals.moneyOut, 'text-rose-700'],
        ['Net cash', data.totals.net, data.totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'],
      ]
    : [];

  return (
    <div className="space-y-6">
      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <CardTitle className="text-base">Day Book</CardTitle>
          <CardDescription>Every sale, payment received, expense and purchase in time order.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DateRangeBar
            from={range.from}
            to={range.to}
            onChange={setRange}
            onApply={load}
            loading={loading}
            disabled={!data}
            onCsv={() => downloadCsv(`day_book_${range.from}_to_${range.to}.csv`, buildCsv(title, headers, rows()))}
            onPrint={() =>
              printReport('Day Book', `${range.from} to ${range.to} · Sales ${data?.totals.sales} · In ${data?.totals.moneyIn} · Out ${data?.totals.moneyOut}`, headers, rows())
            }
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.map(([label, value, color]) => (
                  <div key={label} className="rounded-2xl bg-white/50 ring-1 ring-white/50 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className={`text-lg font-extrabold ${color}`}>{formatCurrency(value)}</p>
                  </div>
                ))}
              </div>
              {data.truncated && <p className="text-xs text-amber-700">This range has more entries than can be shown. Totals reflect only the entries listed — narrow the dates for exact figures.</p>}
              {data.entries.length === 0 ? (
                <p className="text-sm text-slate-400">Nothing recorded in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        {headers.map((h) => <th key={h} className="py-2 pr-4 font-semibold whitespace-nowrap">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {data.entries.map((e, i) => (
                        <tr key={i} className="border-t border-white/40">
                          <td className="py-2 pr-4 whitespace-nowrap">{fmtTime(e.at)}</td>
                          <td className="py-2 pr-4"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${TYPE_STYLE[e.type]}`}>{e.type}</span></td>
                          <td className="py-2 pr-4">{e.reference}</td>
                          <td className="py-2 pr-4">{e.party}</td>
                          <td className="py-2 pr-4">{e.description}</td>
                          <td className="py-2 pr-4 text-right">{e.saleAmount ? formatCurrency(e.saleAmount) : ''}</td>
                          <td className="py-2 pr-4 text-right text-emerald-700">{e.moneyIn ? formatCurrency(e.moneyIn) : ''}</td>
                          <td className="py-2 pr-4 text-right text-rose-700">{e.moneyOut ? formatCurrency(e.moneyOut) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
