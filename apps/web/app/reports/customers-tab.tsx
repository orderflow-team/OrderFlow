import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/format-currency';
import { KpiCard } from './kpi-card';
import { Users, UserPlus, Repeat, Receipt, Clock3, Crown, CreditCard, Layers } from 'lucide-react';
import type { AnalyticsPayload, OutstandingCustomer } from './types';

const TIER_STYLES: Record<string, string> = {
  High: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20',
  Medium: 'bg-amber-500/10 text-amber-700 ring-amber-500/20',
  Low: 'bg-slate-500/10 text-slate-600 ring-slate-500/20',
};

export function CustomersTab({ analytics, outstanding, days }: {
  analytics: AnalyticsPayload | null;
  outstanding: OutstandingCustomer[];
  days: number;
}) {
  const customers = analytics?.customers;
  const customerCountDelta = analytics?.comparison.customerCountGrowthPercent || 0;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={UserPlus}
          label="New Customers"
          value={String(customers?.newVsReturning.newCustomers || 0)}
          sub={formatCurrency(customers?.newVsReturning.newRevenue || 0)}
          tint="bg-blue-500/10 text-blue-600"
        />
        <KpiCard
          icon={Repeat}
          label="Returning Customers"
          value={String(customers?.newVsReturning.returningCustomers || 0)}
          sub={formatCurrency(customers?.newVsReturning.returningRevenue || 0)}
          tint="bg-emerald-500/10 text-emerald-600"
        />
        <KpiCard
          icon={Receipt}
          label="Average Order Value"
          value={formatCurrency(customers?.averageOrderValue || 0)}
          sub={`Last ${days} day${days !== 1 ? 's' : ''}`}
          tint="bg-violet-500/10 text-violet-600"
        />
        <KpiCard
          icon={Clock3}
          label="Inactive Customers"
          value={String(customers?.inactiveCustomers.length || 0)}
          sub="No order in 30+ days"
          tint="bg-amber-500/10 text-amber-600"
        />
      </div>

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-base">Top Customers</CardTitle>
          </div>
          <CardDescription>
            By revenue in the last {days} day{days !== 1 ? 's' : ''} · Customer count {customerCountDelta >= 0 ? '+' : ''}{customerCountDelta.toFixed(1)}% vs previous period
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(customers?.topCustomers.length || 0) === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">No customer orders in this period yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {customers?.topCustomers.map((c) => (
                <div key={c.customerId} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.customerName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{c.orderCount} order{c.orderCount !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="font-bold text-slate-800 shrink-0">{formatCurrency(c.totalSpent)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="ring-white/50 glass-sheen-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-600" />
              <CardTitle className="text-base">Lifetime Value Leaders</CardTitle>
            </div>
            <CardDescription>All-time top customers by total spend.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(customers?.allTimeTopCustomers.length || 0) === 0 ? (
              <p className="p-10 text-center text-slate-400 text-sm">No customer orders yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {customers?.allTimeTopCustomers.map((c) => (
                  <div key={c.customerId} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.customerName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.orderCount} order{c.orderCount !== 1 ? 's' : ''}, all time</p>
                    </div>
                    <p className="font-bold text-slate-800 shrink-0">{formatCurrency(c.totalSpent)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="ring-white/50 glass-sheen-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-amber-600" />
              <CardTitle className="text-base">Inactive Customers</CardTitle>
            </div>
            <CardDescription>Ordered before, but not in the last 30 days — worth a follow-up.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(customers?.inactiveCustomers.length || 0) === 0 ? (
              <p className="p-10 text-center text-slate-400 text-sm">No inactive customers.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {customers?.inactiveCustomers.map((c) => (
                  <div key={c.customerId} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.customerName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Last order {formatDate(c.lastOrderAt)}</p>
                    </div>
                    <p className="font-bold text-slate-800 shrink-0">{formatCurrency(c.lifetimeSpent)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-rose-600" />
            <CardTitle className="text-base">Credit Exposure</CardTitle>
          </div>
          <CardDescription>Customers who've used 80%+ of their credit limit.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(customers?.creditExposure.length || 0) === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">No customers near their credit limit.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {customers?.creditExposure.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(c.outstandingAmount)} of {formatCurrency(c.creditLimit)} limit</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20 shrink-0">
                    {c.utilizationPercent.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-base">Customer Value Segments</CardTitle>
          </div>
          <CardDescription>All period customers split into equal-count High/Medium/Low thirds by spend.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(customers?.valueSegments.length || 0) === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">No customer orders in this period yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {customers?.valueSegments.map((s) => (
                <div key={s.tier} className="flex items-center justify-between px-4 py-3 gap-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ring-1 ${TIER_STYLES[s.tier]}`}>{s.tier}</span>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">{formatCurrency(s.totalRevenue)}</p>
                    <p className="text-xs text-slate-400">{s.customerCount} customer{s.customerCount !== 1 ? 's' : ''}</p>
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
    </div>
  );
}
