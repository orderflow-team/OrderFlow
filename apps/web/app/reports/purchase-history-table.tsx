import { StatusBadge } from '@/components/status-badge';
import { formatCurrency, formatDate } from '@/lib/format-currency';

interface PurchaseHistoryRow {
  id: string;
  supplierName: string;
  orderNumber: string | null;
  status: string;
  totalAmount: number;
  createdAt: string;
}

export function PurchaseHistoryTable({ rows }: { rows: PurchaseHistoryRow[] }) {
  if (rows.length === 0) {
    return <p className="p-10 text-center text-slate-400 text-sm">No purchases recorded yet.</p>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/40 transition-colors gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{row.supplierName}</p>
            <p className="text-xs text-slate-400 mt-0.5">{formatDate(row.createdAt)} · {row.orderNumber}</p>
          </div>
          <div className="text-right flex-shrink-0 flex items-center gap-3">
            <StatusBadge status={row.status} />
            <p className="font-bold text-slate-800 w-20 text-right">{formatCurrency(row.totalAmount)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
