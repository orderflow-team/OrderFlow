'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { formatCurrency, formatDate } from '@/lib/format-currency';
import { expiryStatus } from '@/lib/expiry-status';
import { KpiCard } from './kpi-card';
import { SalesVsPurchaseChart } from './sales-vs-purchase-chart';
import { PurchaseHistoryTable } from './purchase-history-table';
import { SalesHistoryTable } from './sales-history-table';
import { FastMovingWidget } from './fast-moving-widget';
import { IndianRupee, ShoppingCart, TrendingUp, Wallet, Receipt, AlertTriangle, CalendarClock } from 'lucide-react';

interface AnalyticsPayload {
  kpis: {
    todaysSalesRevenue: number;
    todaysPurchaseExpenses: number;
    grossProfitMargin: number;
    netCashFlow: number;
    taxSummary: {
      today: { outputGst: number; inputGst: number };
      month: { outputGst: number; inputGst: number };
    };
  };
  chart: { date: string; sales: number; purchases: number }[];
  purchaseHistory: { id: string; supplierName: string; orderNumber: string | null; status: string; totalAmount: number; createdAt: string }[];
  salesHistory: { id: string; customerName: string; orderNumber: string | null; status: string; totalAmount: number; createdAt: string }[];
  fastMoving: { productId: string; productName: string; totalQuantity: number; totalRevenue: number }[];
  lowStockProducts: { id: string; name: string; stock_quantity: number; batch_number: string | null }[];
  expiringSoon: { id: string; name: string; batch_number: string | null; expiry_date: string | null }[];
}

interface OutstandingCustomer {
  id: string;
  name: string;
  outstanding_amount: string | number;
}

export default function ReportsPage() {
  const { businessId, ready } = useBusiness();
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready || !businessId) return;
    setLoading(true);
    Promise.all([
      apiClient.get<AnalyticsPayload>('/api/reports/analytics', { params: { businessId, days: 30 } }),
      apiClient.get<OutstandingCustomer[]>('/api/reports/outstanding', { params: { businessId } }),
    ])
      .then(([analyticsRes, outstandingRes]) => {
        setAnalytics(analyticsRes.data);
        setOutstanding(outstandingRes.data);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load reports'))
      .finally(() => setLoading(false));
  }, [ready, businessId]);

  if (!ready) return null;

  const kpis = analytics?.kpis;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
        <PageHeader title="Analytics" description="Sales vs purchases, margin, tax, and stock at a glance." />

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                icon={IndianRupee}
                label="Today's Sales"
                value={formatCurrency(kpis?.todaysSalesRevenue || 0)}
                tint="bg-blue-500/10 text-blue-600"
              />
              <KpiCard
                icon={ShoppingCart}
                label="Today's Purchases"
                value={formatCurrency(kpis?.todaysPurchaseExpenses || 0)}
                tint="bg-amber-500/10 text-amber-600"
              />
              <KpiCard
                icon={TrendingUp}
                label="Gross Profit Margin"
                value={`${(kpis?.grossProfitMargin || 0).toFixed(1)}%`}
                sub="This month, current batch cost"
                tint="bg-emerald-500/10 text-emerald-600"
                valueClass="text-emerald-600"
              />
              <KpiCard
                icon={Wallet}
                label="Net Cash Flow"
                value={formatCurrency(kpis?.netCashFlow || 0)}
                sub="This month: sales − purchases"
                tint={(kpis?.netCashFlow || 0) >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}
                valueClass={(kpis?.netCashFlow || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}
              />
            </div>

            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-violet-600" />
                  <CardTitle className="text-base">Tax Summary</CardTitle>
                </div>
                <CardDescription>Output GST collected on sales vs Input GST/ITC paid on purchases.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Output GST (today)</p>
                    <p className="font-bold text-slate-800 mt-0.5">{formatCurrency(kpis?.taxSummary.today.outputGst || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Input GST (today)</p>
                    <p className="font-bold text-slate-800 mt-0.5">{formatCurrency(kpis?.taxSummary.today.inputGst || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Output GST (month)</p>
                    <p className="font-bold text-slate-800 mt-0.5">{formatCurrency(kpis?.taxSummary.month.outputGst || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">Input GST (month)</p>
                    <p className="font-bold text-slate-800 mt-0.5">{formatCurrency(kpis?.taxSummary.month.inputGst || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <CardTitle className="text-base">Sales vs Purchases (last 30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <SalesVsPurchaseChart data={analytics?.chart || []} />
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="ring-white/50 glass-sheen-sm">
                <CardHeader>
                  <CardTitle className="text-base">Purchase History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <PurchaseHistoryTable rows={analytics?.purchaseHistory || []} />
                </CardContent>
              </Card>

              <Card className="ring-white/50 glass-sheen-sm">
                <CardHeader>
                  <CardTitle className="text-base">Sales History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <SalesHistoryTable rows={analytics?.salesHistory || []} />
                </CardContent>
              </Card>
            </div>

            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <CardTitle className="text-base">Fast-Moving Inventory</CardTitle>
                <CardDescription>Top 5 medicines by quantity sold in the last 30 days.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <FastMovingWidget rows={analytics?.fastMoving || []} />
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="ring-white/50 glass-sheen-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <CardTitle className="text-base">Low Stock</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {(analytics?.lowStockProducts.length || 0) === 0 ? (
                    <p className="text-sm text-slate-400">Nothing low on stock.</p>
                  ) : (
                    <div className="space-y-2">
                      {analytics?.lowStockProducts.map((p) => (
                        <div key={p.id} className="flex justify-between text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                          <div>
                            <span className="text-slate-800">{p.name}</span>
                            {p.batch_number && <span className="text-xs text-slate-400 ml-2">Batch {p.batch_number}</span>}
                          </div>
                          <span className="text-amber-600 font-semibold">{p.stock_quantity} left</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="ring-white/50 glass-sheen-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-rose-600" />
                    <CardTitle className="text-base">Expiring Soon (3–6 months)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {(analytics?.expiringSoon.length || 0) === 0 ? (
                    <p className="text-sm text-slate-400">Nothing expiring in this window.</p>
                  ) : (
                    <div className="space-y-2">
                      {analytics?.expiringSoon.map((p) => {
                        const status = expiryStatus(p.expiry_date);
                        return (
                          <div key={p.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                            <div>
                              <span className="text-slate-800">{p.name}</span>
                              {p.batch_number && <span className="text-xs text-slate-400 ml-2">Batch {p.batch_number}</span>}
                            </div>
                            {status && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${status.tone}`}>{status.label}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

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
