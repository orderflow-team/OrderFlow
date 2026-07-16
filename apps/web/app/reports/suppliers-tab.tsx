import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format-currency';
import { Truck, Clock } from 'lucide-react';
import type { AnalyticsPayload } from './types';

export function SuppliersTab({ analytics }: { analytics: AnalyticsPayload | null }) {
  const topSuppliers = analytics?.suppliers.topSuppliers || [];
  const leadTime = analytics?.suppliers.leadTime || [];

  return (
    <div className="space-y-8">
      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-base">Top Suppliers</CardTitle>
          </div>
          <CardDescription>By received purchase spend, last 30 days.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {topSuppliers.length === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">No received purchases from a named supplier in this period yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {topSuppliers.map((s) => (
                <div key={s.supplierId} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.supplierName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.orderCount} purchase order{s.orderCount !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="font-bold text-slate-800 shrink-0">{formatCurrency(s.totalSpent)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <CardTitle className="text-base">Average Lead Time</CardTitle>
          </div>
          <CardDescription>Days from order to receipt, last 30 days.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {leadTime.length === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">No received purchases from a named supplier in this period yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {leadTime.map((s) => (
                <div key={s.supplierId} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.supplierName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.orderCount} purchase order{s.orderCount !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="font-bold text-slate-800 shrink-0">{s.avgLeadTimeDays.toFixed(1)}d</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
