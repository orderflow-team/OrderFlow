'use client';

import { useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency, formatDate } from '@/lib/format-currency';

interface ChartRow {
  date: string;
  sales: number;
  purchases: number;
}

type Granularity = 'day' | 'week' | 'month';

function tickLabel(value: string, granularity: Granularity) {
  if (granularity === 'month') return formatDate(value, { month: 'short', year: '2-digit' });
  return formatDate(value, { day: '2-digit', month: 'short' });
}

function tooltipLabel(value: string, granularity: Granularity) {
  if (granularity === 'month') return formatDate(value, { month: 'long', year: 'numeric' });
  if (granularity === 'week') return `Week of ${formatDate(value, { day: '2-digit', month: 'short', year: 'numeric' })}`;
  return formatDate(value, { day: '2-digit', month: 'short', year: 'numeric' });
}

const NAMES: Record<string, string> = { sales: 'Sales', purchases: 'Purchases' };

export function SalesVsPurchaseChart({ data, granularity = 'day' }: { data: ChartRow[]; granularity?: Granularity }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (data.length === 0) {
    return <p className="p-10 text-center text-slate-400 text-sm">No sales or purchase activity in this period yet.</p>;
  }

  const totalSales = data.reduce((sum, row) => sum + row.sales, 0);
  const totalPurchases = data.reduce((sum, row) => sum + row.purchases, 0);
  const profit = totalSales - totalPurchases;
  const isProfit = profit >= 0;
  // Keep the x-axis readable: fit as many labels as the actual chart width allows
  // (~55px each for a "06 Jul"-style label) instead of a fixed count that overlaps on mobile.
  const maxLabels = Math.max(3, Math.floor(containerWidth / 55));
  const tickInterval = Math.max(0, Math.ceil(data.length / maxLabels) - 1);

  return (
    <div>
      <p className={`text-base font-semibold mb-4 ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
        {isProfit
          ? `You sold ${formatCurrency(profit)} more than you spent on purchases this period.`
          : `You spent ${formatCurrency(Math.abs(profit))} more than you sold this period.`}
      </p>

      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Money In (Sales)</p>
          <p className="font-bold text-emerald-600 mt-0.5">{formatCurrency(totalSales)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Money Out (Purchases)</p>
          <p className="font-bold text-amber-600 mt-0.5">{formatCurrency(totalPurchases)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Profit</p>
          <p className={`font-bold mt-0.5 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(profit)}</p>
        </div>
      </div>

      <div ref={containerRef} className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => tickLabel(value, granularity)}
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              interval={tickInterval}
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value, 0)}
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrency(value), NAMES[name] ?? name]}
              labelFormatter={(value) => tooltipLabel(value as string, granularity)}
              contentStyle={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.5)', fontSize: 13 }}
            />
            <Legend formatter={(value) => NAMES[value] ?? value} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="sales" name="sales" fill="#059669" radius={[4, 4, 0, 0]} />
            <Bar dataKey="purchases" name="purchases" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
