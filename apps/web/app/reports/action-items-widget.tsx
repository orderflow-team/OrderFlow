import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format-currency';
import { RefreshCw, CalendarClock, PackageSearch, CreditCard, ListChecks } from 'lucide-react';
import type { AnalyticsPayload } from './types';

const TYPE_ICON = {
  reorder: RefreshCw,
  expiry: CalendarClock,
  'slow-moving': PackageSearch,
  credit: CreditCard,
} as const;

const TYPE_COLOR = {
  reorder: 'text-blue-600',
  expiry: 'text-rose-600',
  'slow-moving': 'text-amber-600',
  credit: 'text-violet-600',
} as const;

const SEVERITY_BADGE = {
  high: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20',
  medium: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20',
  low: 'bg-slate-500/10 text-slate-600 ring-1 ring-slate-500/20',
} as const;

export function ActionItemsWidget({ items }: { items: AnalyticsPayload['actionItems'] }) {
  return (
    <Card className="ring-white/50 glass-sheen-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-indigo-600" />
          <CardTitle className="text-base">Today's Priorities</CardTitle>
        </div>
        <CardDescription>Reorder risk, near-expiry stock, dead stock, and overdue credit — ranked by urgency.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="p-10 text-center text-slate-400 text-sm">Nothing urgent right now.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const Icon = TYPE_ICON[item.type];
              return (
                <div key={item.id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${TYPE_COLOR[item.type]}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.value !== null && (
                      <span className="font-bold text-slate-700 text-sm">{formatCurrency(item.value)}</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${SEVERITY_BADGE[item.severity]}`}>
                      {item.severity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
