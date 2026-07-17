import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format-currency';
import { KpiCard } from './kpi-card';
import { SimpleBarChart } from './simple-bar-chart';
import { Package, Boxes, PackageSearch, TrendingUp, CalendarClock, RefreshCw, ShieldAlert, Tags } from 'lucide-react';
import type { AnalyticsPayload } from './types';

export function ProductsTab({ analytics, isPharmacy, days, inventoryEnabled, showExpiry }: {
  analytics: AnalyticsPayload | null;
  isPharmacy: boolean;
  days: number;
  inventoryEnabled: boolean;
  showExpiry: boolean;
}) {
  const products = analytics?.products;

  return (
    <div className="space-y-8">
      {(inventoryEnabled || showExpiry) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {inventoryEnabled && (
            <>
              <KpiCard
                icon={Boxes}
                label="Inventory Value"
                value={formatCurrency(products?.inventoryValuation.totalValue || 0)}
                sub={`${products?.inventoryValuation.skuCount || 0} SKUs, ${products?.inventoryValuation.totalUnits || 0} units`}
                tint="bg-blue-500/10 text-blue-600"
              />
              <KpiCard
                icon={PackageSearch}
                label="Slow-Moving Items"
                value={String(products?.slowMoving.length || 0)}
                sub={`In stock, zero sales in ${days}d`}
                tint="bg-amber-500/10 text-amber-600"
              />
              <KpiCard
                icon={TrendingUp}
                label="Tied-Up Value at Risk"
                value={formatCurrency((products?.slowMoving || []).reduce((sum, p) => sum + p.tiedUpValue, 0))}
                sub="Slow-moving stock, current cost"
                tint="bg-rose-500/10 text-rose-600"
              />
            </>
          )}
          {showExpiry && (
            <KpiCard
              icon={CalendarClock}
              label="Expiring Stock Value"
              value={formatCurrency(products?.expiryValueAtRisk || 0)}
              sub="Expiring in 3–6 months, current cost"
              tint="bg-violet-500/10 text-violet-600"
            />
          )}
        </div>
      )}

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            <CardTitle className="text-base">Sales by Category</CardTitle>
          </div>
          <CardDescription>Revenue by product category, last {days} day{days !== 1 ? 's' : ''}.</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart
            data={(products?.categoryBreakdown || []).map((c) => ({ label: c.category, value: c.totalRevenue }))}
            color="#059669"
          />
        </CardContent>
      </Card>

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tags className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-base">Sales by Brand</CardTitle>
          </div>
          <CardDescription>Revenue by product brand, last {days} day{days !== 1 ? 's' : ''}.</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart
            data={(products?.brandBreakdown || []).map((b) => ({ label: b.brand, value: b.totalRevenue }))}
            color="#7c3aed"
          />
        </CardContent>
      </Card>

      {isPharmacy && (
        <Card className="ring-white/50 glass-sheen-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <CardTitle className="text-base">Prescription vs OTC Sales</CardTitle>
            </div>
            <CardDescription>Last {days} day{days !== 1 ? 's' : ''}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">Rx (Prescription)</p>
                <p className="font-bold text-slate-800 mt-0.5">{formatCurrency(products?.rxOtcSplit.rx.totalRevenue || 0)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{products?.rxOtcSplit.rx.totalQuantity || 0} units</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">OTC</p>
                <p className="font-bold text-slate-800 mt-0.5">{formatCurrency(products?.rxOtcSplit.otc.totalRevenue || 0)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{products?.rxOtcSplit.otc.totalQuantity || 0} units</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {inventoryEnabled && (
        <Card className="ring-white/50 glass-sheen-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-base">Reorder Suggestions</CardTitle>
            </div>
            <CardDescription>Low stock with real demand — ranked by soonest estimated stockout.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(products?.reorderSuggestions.length || 0) === 0 ? (
              <p className="p-10 text-center text-slate-400 text-sm">No low-stock items with recent sales velocity.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {products?.reorderSuggestions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{p.stockQuantity} left · {p.velocityPerDay.toFixed(2)}/day</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                      p.daysLeft <= 3 ? 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20' : 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20'
                    }`}>
                      {p.daysLeft <= 0 ? 'Out of stock' : `${Math.round(p.daysLeft)}d left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className={`grid gap-6 ${inventoryEnabled ? 'md:grid-cols-2' : ''}`}>
        <Card className="ring-white/50 glass-sheen-sm">
          <CardHeader>
            <CardTitle className="text-base">Top Margin Products</CardTitle>
            <CardDescription>Highest ₹ profit contributors — not always the top sellers.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(products?.topMarginProducts.length || 0) === 0 ? (
              <p className="p-10 text-center text-slate-400 text-sm">No sales in this period yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {products?.topMarginProducts.map((p) => (
                  <div key={p.productId} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.productName}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{p.totalQuantity} sold</p>
                    </div>
                    <p className="font-bold text-emerald-600 shrink-0">{formatCurrency(p.totalMargin)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {inventoryEnabled && (
          <Card className="ring-white/50 glass-sheen-sm">
            <CardHeader>
              <CardTitle className="text-base">Slow-Moving / Dead Stock</CardTitle>
              <CardDescription>In stock, zero units sold in {days} day{days !== 1 ? 's' : ''} — ranked by ₹ tied up.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {(products?.slowMoving.length || 0) === 0 ? (
                <p className="p-10 text-center text-slate-400 text-sm">Nothing slow-moving right now.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {products?.slowMoving.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3 gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{p.stockQuantity} units in stock</p>
                      </div>
                      <p className="font-bold text-rose-600 shrink-0">{formatCurrency(p.tiedUpValue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
