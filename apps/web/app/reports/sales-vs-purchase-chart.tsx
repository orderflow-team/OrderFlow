'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency, formatDate } from '@/lib/format-currency';

interface ChartRow {
  date: string;
  sales: number;
  purchases: number;
}

export function SalesVsPurchaseChart({ data }: { data: ChartRow[] }) {
  if (data.length === 0) {
    return <p className="p-10 text-center text-slate-400 text-sm">No sales or purchase activity in this period yet.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => formatDate(value, { day: '2-digit', month: 'short' })}
            tick={{ fontSize: 12, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value, 0)}
            tick={{ fontSize: 12, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
            labelFormatter={(value) => formatDate(value as string)}
            contentStyle={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.5)', fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="sales" name="Sales" fill="#059669" radius={[4, 4, 0, 0]} />
          <Bar dataKey="purchases" name="Purchases" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
