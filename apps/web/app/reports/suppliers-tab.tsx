import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/format-currency';
import { Truck, Clock, RotateCcw } from 'lucide-react';
import apiClient from '@/lib/api-client';
import type { AnalyticsPayload } from './types';

interface SupplierReturn {
  id: string;
  quantity: string | number;
  unit_price: string | number;
  amount: string | number;
  reason: string;
  status: 'pending' | 'credited';
  batch_number: string | null;
  created_at: string;
  supplier: { name: string } | null;
  product: { name: string } | null;
}

export function SuppliersTab({ analytics, days, businessId }: { analytics: AnalyticsPayload | null; days: number; businessId?: string }) {
  const topSuppliers = analytics?.suppliers.topSuppliers || [];
  const leadTime = analytics?.suppliers.leadTime || [];
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);

  const loadReturns = () => {
    if (!businessId) return;
    setReturnsLoading(true);
    apiClient
      .get<SupplierReturn[]>('/api/inventory/supplier-returns', { params: { businessId } })
      .then((res) => setReturns(res.data))
      .catch((err) => console.error('Failed to load supplier returns', err))
      .finally(() => setReturnsLoading(false));
  };

  useEffect(loadReturns, [businessId]);

  const markCredited = async (id: string) => {
    if (!businessId) return;
    try {
      await apiClient.patch(`/api/inventory/supplier-returns/${id}/status`, { status: 'credited' }, { params: { businessId } });
      loadReturns();
    } catch (err) {
      console.error('Failed to update return status', err);
    }
  };

  const pendingTotal = returns.filter((r) => r.status === 'pending').reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="space-y-8">
      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-base">Top Suppliers</CardTitle>
          </div>
          <CardDescription>By received purchase spend, last {days} day{days !== 1 ? 's' : ''}.</CardDescription>
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
          <CardDescription>Days from order to receipt, last {days} day{days !== 1 ? 's' : ''}.</CardDescription>
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

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-600" />
            <CardTitle className="text-base">Supplier Returns</CardTitle>
          </div>
          <CardDescription>
            Expired/damaged/wrong-item stock sent back to a supplier, from Medicines &rarr; batch &rarr; Return to Supplier.
            {pendingTotal > 0 && ` ${formatCurrency(pendingTotal)} still pending credit.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {returnsLoading ? (
            <p className="p-10 text-center text-slate-400 text-sm">Loading...</p>
          ) : returns.length === 0 ? (
            <p className="p-10 text-center text-slate-400 text-sm">No supplier returns recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {returns.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {r.product?.name || 'Unknown item'} &middot; {Number(r.quantity)} unit{Number(r.quantity) !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      To {r.supplier?.name || 'Unknown supplier'} &middot; {r.reason.replace('_', ' ')} &middot; {formatDate(r.created_at)}
                      {r.batch_number ? ` · Batch ${r.batch_number}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-bold text-slate-800">{formatCurrency(Number(r.amount))}</p>
                    {r.status === 'pending' ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markCredited(r.id)}>
                        Mark Credited
                      </Button>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20">
                        Credited
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
