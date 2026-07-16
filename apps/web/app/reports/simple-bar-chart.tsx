'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '@/lib/format-currency';

interface BarRow {
  label: string;
  value: number;
}

export function SimpleBarChart({ data, color = '#059669', emptyMessage = 'No data in this period yet.' }: {
  data: BarRow[];
  color?: string;
  emptyMessage?: string;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="p-10 text-center text-slate-400 text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(value) => formatCurrency(value, 0)}
            tick={{ fontSize: 12, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            formatter={(value: number) => [formatCurrency(value), 'Total']}
            contentStyle={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.5)', fontSize: 13 }}
          />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
