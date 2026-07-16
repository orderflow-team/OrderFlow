import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { formatCurrency } from '@/lib/format-currency';
import { KpiCard } from './kpi-card';
import { SimpleBarChart } from './simple-bar-chart';
import { ClipboardList, XCircle, CalendarDays, UserCog, Clock4 } from 'lucide-react';
import type { AnalyticsPayload } from './types';

function hourLabel(hour: number) {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

export function OperationsTab({ analytics, days }: { analytics: AnalyticsPayload | null; days: number }) {
  const operations = analytics?.operations;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          icon={ClipboardList}
          label={`Orders (${days}d)`}
          value={String((operations?.orderStatusBreakdown || []).reduce((s, r) => s + r.orderCount, 0))}
          tint="bg-blue-500/10 text-blue-600"
        />
        <KpiCard
          icon={XCircle}
          label="Cancellation / Return Rate"
          value={`${(operations?.cancellationRatePercent || 0).toFixed(1)}%`}
          tint="bg-rose-500/10 text-rose-600"
        />
      </div>

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-base">Order Status Breakdown</CardTitle>
          </div>
          <CardDescription>Last {days} day{days !== 1 ? 's' : ''}.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(operations?.orderStatusBreakdown.length || 0) === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">No orders in this period yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {operations?.orderStatusBreakdown.map((s) => (
                <div key={s.status} className="flex items-center justify-between px-4 py-3 gap-4">
                  <StatusBadge status={s.status} />
                  <div className="text-right">
                    <p className="font-bold text-slate-800">{formatCurrency(s.totalAmount)}</p>
                    <p className="text-xs text-slate-400">{s.orderCount} order{s.orderCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            <CardTitle className="text-base">Sales by Day of Week</CardTitle>
          </div>
          <CardDescription>Last {days} day{days !== 1 ? 's' : ''} — spot your peak days.</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart
            data={(operations?.salesByDayOfWeek || []).map((d) => ({ label: d.day, value: d.total }))}
            color="#7c3aed"
          />
        </CardContent>
      </Card>

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock4 className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-base">Peak Sales Hours</CardTitle>
          </div>
          <CardDescription>Last {days} day{days !== 1 ? 's' : ''} — spot your busiest hours.</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart
            data={(operations?.salesByHourOfDay || []).map((h) => ({ label: hourLabel(h.hour), value: h.total }))}
            color="#2563eb"
          />
        </CardContent>
      </Card>

      {(operations?.salesmanPerformance.length || 0) > 0 && (
        <Card className="ring-white/50 glass-sheen-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCog className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-base">Salesman Performance</CardTitle>
            </div>
            <CardDescription>Orders attributed to a salesman login, last {days} day{days !== 1 ? 's' : ''}.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {operations?.salesmanPerformance.map((s) => (
                <div key={s.salesmanId} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.salesmanName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.orderCount} order{s.orderCount !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="font-bold text-slate-800 shrink-0">{formatCurrency(s.totalSales)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
