'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/format-currency';
import { buildCsv, dateRangePreset, downloadCsv, printReport, type ExportCell } from '@/lib/report-export';
import { DateRangeBar } from './date-range-bar';

type View = 'profit' | 'staff' | 'stock' | 'money';

interface SaleProfitRow { id: string; orderNumber: string; createdAt: string; customerName: string; revenue: number; cost: number; profit: number; marginPercent: number; uncostedLines: number }
interface SaleProfit { sales: SaleProfitRow[]; truncated: boolean; totals: { bills: number; revenue: number; cost: number; profit: number; marginPercent: number; lossMakingBills: number } }
interface StaffRow { userId: string | null; name: string; role: string | null; bills: number; sales: number; tax: number; averageBill: number; sharePercent: number }
interface StaffSales { staff: StaffRow[]; totals: { bills: number; sales: number } }
interface StockRow { id: string; name: string; sku: string | null; category: string | null; unit: string | null; currentStock: number; costPrice: number; stockValue: number; purchasedQty: number; soldQty: number; soldRevenue: number; status: 'ok' | 'low' | 'out' }
interface StockSummary { items: StockRow[]; totals: { products: number; stockValue: number; outOfStock: number; lowStock: number; purchasedQty: number; soldQty: number } }

interface FlowRow { label: string; total: number; count: number }
interface MoneyFlow {
  moneyInByMethod: FlowRow[];
  expenseByCategory: FlowRow[];
  purchases: { total: number; count: number };
  daily: { date: string; moneyIn: number; moneyOut: number; net: number }[];
  totals: { moneyIn: number; moneyOut: number; net: number; cashIn: number; digitalIn: number };
}

const VIEWS: { id: View; label: string; path: string; description: string }[] = [
  { id: 'profit', label: 'Sale-wise profit', path: 'sale-profit', description: 'Profit and margin on every bill. Cost uses each product’s current purchase price.' },
  { id: 'staff', label: 'Staff-wise sales', path: 'staff-sales', description: 'Bills and sales per team member. QR and online orders have no staff member and are grouped together.' },
  { id: 'stock', label: 'Stock summary', path: 'stock-summary', description: 'Current stock and value per item, with what was purchased and sold in the period.' },
  { id: 'money', label: 'Money in / out', path: 'money-flow', description: 'Payments received (cash vs UPI/bank) against expenses and supplier purchases, day by day.' },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const STATUS_STYLE = { ok: 'bg-emerald-500/10 text-emerald-700', low: 'bg-amber-500/10 text-amber-700', out: 'bg-rose-500/10 text-rose-700' };

function Stat({ label, value, tone = 'text-slate-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-white/50 ring-1 ring-white/50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            {headers.map((h) => <th key={h} className="py-2 pr-4 font-semibold whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const td = 'py-2 pr-4';
const num = `${td} text-right`;

export function SalesStockTab({ businessId }: { businessId: string }) {
  const [view, setView] = useState<View>('profit');
  const [range, setRange] = useState(dateRangePreset('month'));
  // Each result is tagged with the view that fetched it, so a view never renders another view's payload
  // (e.g. in the render between clicking a toggle and the new data arriving).
  const [result, setResult] = useState<{ view: View; data: SaleProfit | StaffSales | StockSummary | MoneyFlow } | null>(null);
  const data = result?.view === view ? result.data : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const meta = VIEWS.find((v) => v.id === view)!;

  const load = (v: View = view) => {
    setLoading(true);
    setError('');
    apiClient
      .get(`/api/reports/${VIEWS.find((x) => x.id === v)!.path}`, { params: { businessId, ...range } })
      .then((res) => setResult({ view: v, data: res.data }))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load report'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!businessId) return;
    load(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, view]);

  let headers: string[] = [];
  let rows: ExportCell[][] = [];
  if (view === 'profit' && data) {
    headers = ['Date', 'Bill', 'Customer', 'Revenue', 'Cost', 'Profit', 'Margin %'];
    rows = (data as SaleProfit).sales.map((s) => [fmtDate(s.createdAt), s.orderNumber, s.customerName, s.revenue, s.cost, s.profit, s.marginPercent]);
  } else if (view === 'staff' && data) {
    headers = ['Staff', 'Role', 'Bills', 'Sales', 'Tax', 'Average bill', 'Share %'];
    rows = (data as StaffSales).staff.map((s) => [s.name, s.role ?? '', s.bills, s.sales, s.tax, s.averageBill, s.sharePercent]);
  } else if (view === 'stock' && data) {
    headers = ['Item', 'SKU', 'Category', 'Unit', 'Current stock', 'Cost price', 'Stock value', 'Purchased', 'Sold', 'Status'];
    rows = (data as StockSummary).items.map((i) => [i.name, i.sku ?? '', i.category ?? '', i.unit ?? '', i.currentStock, i.costPrice, i.stockValue, i.purchasedQty, i.soldQty, i.status]);
  } else if (view === 'money' && data) {
    const m = data as MoneyFlow;
    headers = ['Date', 'Money in', 'Money out', 'Net'];
    rows = m.daily.map((d) => [d.date, d.moneyIn, d.moneyOut, d.net]);
    rows.push(['Total', m.totals.moneyIn, m.totals.moneyOut, m.totals.net]);
  }
  const title = `${meta.label} ${range.from} to ${range.to}`;

  const profit = view === 'profit' ? (data as SaleProfit | null) : null;
  const staff = view === 'staff' ? (data as StaffSales | null) : null;
  const money = view === 'money' ? (data as MoneyFlow | null) : null;
  const stock = view === 'stock' ? (data as StockSummary | null) : null;

  return (
    <div className="space-y-6">
      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <CardTitle className="text-base">Sales &amp; Stock Reports</CardTitle>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold ring-1 transition-colors ${
                  view === v.id ? 'ring-emerald-500/30 text-emerald-700 bg-emerald-500/10' : 'ring-white/50 text-slate-700 bg-white/40 hover:bg-white/60'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <DateRangeBar
            from={range.from}
            to={range.to}
            onChange={setRange}
            onApply={() => load()}
            loading={loading}
            disabled={!data}
            onCsv={() => downloadCsv(`${meta.path.replace('-', '_')}_${range.from}_to_${range.to}.csv`, buildCsv(title, headers, rows))}
            onPrint={() => printReport(meta.label, `${range.from} to ${range.to}`, headers, rows)}
          />

          {error && <p className="text-sm text-rose-600">{error}</p>}

          {profit && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat label="Bills" value={String(profit.totals.bills)} />
                <Stat label="Revenue (pre-tax)" value={formatCurrency(profit.totals.revenue)} />
                <Stat label="Cost" value={formatCurrency(profit.totals.cost)} />
                <Stat label="Profit" value={formatCurrency(profit.totals.profit)} tone={profit.totals.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
                <Stat label="Margin" value={`${profit.totals.marginPercent}%`} />
              </div>
              {profit.totals.lossMakingBills > 0 && <p className="text-xs text-rose-700">{profit.totals.lossMakingBills} bill(s) sold below cost.</p>}
              {profit.truncated && <p className="text-xs text-amber-700">Showing the most recent {profit.sales.length} of {profit.totals.bills} bills. Totals cover all bills — narrow the dates to see the rest.</p>}
              {profit.sales.length === 0 ? (
                <p className="text-sm text-slate-400">No bills in this period.</p>
              ) : (
                <Table headers={headers}>
                  {profit.sales.map((s) => (
                    <tr key={s.id} className="border-t border-white/40">
                      <td className={`${td} whitespace-nowrap`}>{fmtDate(s.createdAt)}</td>
                      <td className={td}>{s.orderNumber}</td>
                      <td className={td}>{s.customerName}</td>
                      <td className={num}>{formatCurrency(s.revenue)}</td>
                      <td className={num}>
                        {formatCurrency(s.cost)}
                        {s.uncostedLines > 0 && <span title="Contains free-text items with no cost price" className="text-amber-600"> *</span>}
                      </td>
                      <td className={`${num} font-semibold ${s.profit < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatCurrency(s.profit)}</td>
                      <td className={num}>{s.marginPercent}%</td>
                    </tr>
                  ))}
                </Table>
              )}
              <p className="text-xs text-slate-400">* includes free-text items with no cost price, counted as zero cost.</p>
            </>
          )}

          {staff && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Bills" value={String(staff.totals.bills)} />
                <Stat label="Sales" value={formatCurrency(staff.totals.sales)} />
              </div>
              {staff.staff.length === 0 ? (
                <p className="text-sm text-slate-400">No bills in this period.</p>
              ) : (
                <Table headers={headers}>
                  {staff.staff.map((s) => (
                    <tr key={s.userId ?? 'none'} className="border-t border-white/40">
                      <td className={`${td} font-semibold`}>{s.name}</td>
                      <td className={`${td} capitalize`}>{s.role ?? ''}</td>
                      <td className={num}>{s.bills}</td>
                      <td className={num}>{formatCurrency(s.sales)}</td>
                      <td className={num}>{formatCurrency(s.tax)}</td>
                      <td className={num}>{formatCurrency(s.averageBill)}</td>
                      <td className={num}>{s.sharePercent}%</td>
                    </tr>
                  ))}
                </Table>
              )}
            </>
          )}

          {stock && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat label="Items" value={String(stock.totals.products)} />
                <Stat label="Stock value" value={formatCurrency(stock.totals.stockValue)} />
                <Stat label="Out of stock" value={String(stock.totals.outOfStock)} tone={stock.totals.outOfStock > 0 ? 'text-rose-700' : 'text-slate-900'} />
                <Stat label="Low stock" value={String(stock.totals.lowStock)} tone={stock.totals.lowStock > 0 ? 'text-amber-700' : 'text-slate-900'} />
                <Stat label="Sold in period" value={String(stock.totals.soldQty)} />
              </div>
              {stock.items.length === 0 ? (
                <p className="text-sm text-slate-400">No products yet.</p>
              ) : (
                <Table headers={headers}>
                  {stock.items.map((i) => (
                    <tr key={i.id} className="border-t border-white/40">
                      <td className={`${td} font-semibold`}>{i.name}</td>
                      <td className={td}>{i.sku}</td>
                      <td className={td}>{i.category}</td>
                      <td className={td}>{i.unit}</td>
                      <td className={num}>{i.currentStock}</td>
                      <td className={num}>{formatCurrency(i.costPrice)}</td>
                      <td className={num}>{formatCurrency(i.stockValue)}</td>
                      <td className={num}>{i.purchasedQty}</td>
                      <td className={num}>{i.soldQty}</td>
                      <td className={td}><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[i.status]}`}>{i.status === 'ok' ? 'In stock' : i.status === 'low' ? 'Low' : 'Out'}</span></td>
                    </tr>
                  ))}
                </Table>
              )}
              <p className="text-xs text-slate-400">Current stock and value are as of now; purchased and sold cover the selected dates.</p>
            </>
          )}
          {money && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat label="Money in" value={formatCurrency(money.totals.moneyIn)} tone="text-emerald-700" />
                <Stat label="Money out" value={formatCurrency(money.totals.moneyOut)} tone="text-rose-700" />
                <Stat label="Net" value={formatCurrency(money.totals.net)} tone={money.totals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
                <Stat label="Cash received" value={formatCurrency(money.totals.cashIn)} />
                <Stat label="UPI / bank received" value={formatCurrency(money.totals.digitalIn)} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">Money in by method</p>
                  {money.moneyInByMethod.length === 0 ? <p className="text-sm text-slate-400">No payments received.</p> : (
                    <Table headers={['Method', 'Payments', 'Amount']}>
                      {money.moneyInByMethod.map((m) => (
                        <tr key={m.label} className="border-t border-white/40"><td className={td}>{m.label}</td><td className={num}>{m.count}</td><td className={num}>{formatCurrency(m.total)}</td></tr>
                      ))}
                    </Table>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">Money out</p>
                  <Table headers={['Type', 'Entries', 'Amount']}>
                    {money.expenseByCategory.map((m) => (
                      <tr key={m.label} className="border-t border-white/40"><td className={td}>Expense: {m.label}</td><td className={num}>{m.count}</td><td className={num}>{formatCurrency(m.total)}</td></tr>
                    ))}
                    <tr className="border-t border-white/40"><td className={td}>Supplier purchases received</td><td className={num}>{money.purchases.count}</td><td className={num}>{formatCurrency(money.purchases.total)}</td></tr>
                  </Table>
                </div>
              </div>
              {money.daily.length > 0 && (
                <Table headers={headers}>
                  {money.daily.map((d) => (
                    <tr key={d.date} className="border-t border-white/40">
                      <td className={td}>{d.date}</td>
                      <td className={`${num} text-emerald-700`}>{formatCurrency(d.moneyIn)}</td>
                      <td className={`${num} text-rose-700`}>{formatCurrency(d.moneyOut)}</td>
                      <td className={`${num} font-semibold`}>{formatCurrency(d.net)}</td>
                    </tr>
                  ))}
                </Table>
              )}
              <p className="text-xs text-slate-400">Purchases count on the day they were received, not when the supplier was paid. Credit sales are not money in until paid.</p>
            </>
          )}
          {loading && !data && <p className="text-sm text-slate-400">Loading...</p>}
        </CardContent>
      </Card>
    </div>
  );
}
