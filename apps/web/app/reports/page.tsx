'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { IndianRupee, TrendingDown, TrendingUp, Receipt } from 'lucide-react';

interface Profit {
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPercent: number;
}

interface TaxRow {
  date: string;
  orderCount: number;
  totalSales: number;
  totalTax: number;
}

interface OutstandingCustomer {
  id: string;
  name: string;
  outstanding_amount: string | number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatCard({ icon: Icon, label, value, sub, tint, valueClass }: {
  icon: typeof IndianRupee;
  label: string;
  value: string;
  sub?: string;
  tint: string;
  valueClass?: string;
}) {
  return (
    <Card className="ring-white/50 glass-sheen-sm">
      <CardContent className="p-4 flex flex-col gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tint}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className={`text-lg font-bold mt-0.5 ${valueClass || 'text-slate-800'}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const { businessId, ready } = useBusiness();
  const [profit, setProfit] = useState<Profit | null>(null);
  const [tax, setTax] = useState<TaxRow[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready || !businessId) return;
    setLoading(true);
    Promise.all([
      apiClient.get<Profit>('/api/reports/profit', { params: { businessId } }),
      apiClient.get<TaxRow[]>('/api/reports/tax', { params: { businessId } }),
      apiClient.get<OutstandingCustomer[]>('/api/reports/outstanding', { params: { businessId } }),
    ])
      .then(([profitRes, taxRes, outstandingRes]) => {
        setProfit(profitRes.data);
        setTax(taxRes.data);
        setOutstanding(outstandingRes.data);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load reports'))
      .finally(() => setLoading(false));
  }, [ready, businessId]);

  if (!ready) return null;

  const totalTaxCollected = tax.reduce((sum, r) => sum + r.totalTax, 0);

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
        <PageHeader title="Reports" description="Profit, GST/tax collected, and outstanding dues." />

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <StatCard icon={IndianRupee} label="Revenue" value={formatCurrency(profit?.revenue || 0)} tint="bg-blue-500/10 text-blue-600" />
              <StatCard icon={TrendingDown} label="Cost of Goods" value={formatCurrency(profit?.cost || 0)} tint="bg-slate-500/10 text-slate-600" />
              <StatCard
                icon={TrendingUp}
                label="Gross Profit"
                value={formatCurrency(profit?.grossProfit || 0)}
                sub={`${(profit?.marginPercent || 0).toFixed(1)}% margin`}
                tint="bg-emerald-500/10 text-emerald-600"
                valueClass="text-emerald-600"
              />
              <StatCard icon={Receipt} label="GST Collected" value={formatCurrency(totalTaxCollected)} tint="bg-violet-500/10 text-violet-600" />
            </div>

            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <CardTitle className="text-base">Tax Report (by day)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {tax.length === 0 ? (
                  <p className="p-10 text-center text-slate-400 text-sm">No tax data yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {tax.map((row) => (
                      <div key={row.date} className="flex items-center justify-between px-4 py-3 hover:bg-white/40 transition-colors gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{formatDate(row.date)}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{row.orderCount} order{row.orderCount !== 1 ? 's' : ''} · Sales {formatCurrency(row.totalSales)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-slate-400 uppercase tracking-wide">Tax</p>
                          <p className="font-bold text-slate-800">{formatCurrency(row.totalTax)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <CardTitle className="text-base">Outstanding by Customer</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {outstanding.length === 0 ? (
                  <p className="p-10 text-center text-slate-400 text-sm">No outstanding dues.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {outstanding.map((c) => (
                      <div key={c.id} className="px-6 py-3 flex justify-between text-sm">
                        <span className="text-slate-800 font-medium">{c.name}</span>
                        <span className="font-semibold text-rose-600">{formatCurrency(Number(c.outstanding_amount))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
