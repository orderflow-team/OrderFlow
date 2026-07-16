import { formatCurrency } from '@/lib/format-currency';

interface FastMovingRow {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export function FastMovingWidget({ rows }: { rows: FastMovingRow[] }) {
  if (rows.length === 0) {
    return <p className="p-10 text-center text-slate-400 text-sm">No sales in this period yet.</p>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row, index) => (
        <div key={row.productId} className="flex items-center justify-between px-4 py-3 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">
              {index + 1}
            </span>
            <p className="text-sm font-semibold text-slate-800 truncate">{row.productName}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold text-slate-800">{row.totalQuantity} sold</p>
            <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(row.totalRevenue)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
