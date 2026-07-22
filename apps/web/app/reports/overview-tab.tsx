import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format-currency';
import { expiryStatus } from '@/lib/expiry-status';
import { KpiCard } from './kpi-card';
import { SalesVsPurchaseChart } from './sales-vs-purchase-chart';
import { PurchaseHistoryTable } from './purchase-history-table';
import { SalesHistoryTable } from './sales-history-table';
import { FastMovingWidget } from './fast-moving-widget';
import { ActionItemsWidget } from './action-items-widget';
import { IndianRupee, ShoppingCart, TrendingUp, Wallet, Receipt, AlertTriangle, CalendarClock } from 'lucide-react';
import type { AnalyticsPayload } from './types';

function deltaSub(percent: number | undefined) {
  const value = percent || 0;
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}% vs previous period`;
}

export function OverviewTab({ analytics, days, inventoryEnabled, showExpiry, isPharmacy }: {
  analytics: AnalyticsPayload | null;
  days: number;
  inventoryEnabled: boolean;
  showExpiry: boolean;
  isPharmacy: boolean;
}) {
  const kpis = analytics?.kpis;
  const comparison = analytics?.comparison;

  return (
    <div className="space-y-8">
      <ActionItemsWidget items={analytics?.actionItems || []} />

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
          sub={`${(comparison?.marginChangePercent || 0) >= 0 ? '+' : ''}${(comparison?.marginChangePercent || 0).toFixed(1)}pt vs previous period`}
          tint="bg-emerald-500/10 text-emerald-600"
          valueClass="text-emerald-600"
        />
        <KpiCard
          icon={Wallet}
          label="Net Cash Flow"
          value={formatCurrency(kpis?.netCashFlow || 0)}
          sub="Selected period: sales − purchases"
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
              <p className="text-xs text-slate-400 uppercase tracking-wide">Output GST (period)</p>
              <p className="font-bold text-slate-800 mt-0.5">{formatCurrency(kpis?.taxSummary.period.outputGst || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Input GST (period)</p>
              <p className="font-bold text-slate-800 mt-0.5">{formatCurrency(kpis?.taxSummary.period.inputGst || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <CardTitle className="text-base">Sales vs Purchases (last {days} day{days !== 1 ? 's' : ''})</CardTitle>
          <CardDescription>
            Sales {deltaSub(comparison?.salesGrowthPercent)} · Purchases {deltaSub(comparison?.purchasesGrowthPercent)}
            {analytics?.chartGranularity && analytics.chartGranularity !== 'day' && (
              <> · grouped by {analytics.chartGranularity} to keep the chart readable</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SalesVsPurchaseChart data={analytics?.chart || []} granularity={analytics?.chartGranularity} />
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
          <CardDescription>Top 5 {isPharmacy ? 'medicines' : 'products'} by quantity sold in the last {days} day{days !== 1 ? 's' : ''}.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <FastMovingWidget rows={analytics?.fastMoving || []} />
        </CardContent>
      </Card>

      {(inventoryEnabled || showExpiry) && (
        <div className={`grid gap-6 ${inventoryEnabled && showExpiry ? 'md:grid-cols-2' : ''}`}>
          {inventoryEnabled && (
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
          )}

          {showExpiry && (
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
          )}
        </div>
      )}
    </div>
  );
}
