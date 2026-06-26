const STATUS_STYLES: Record<string, string> = {
  // order / KOT lifecycle
  draft: 'bg-slate-100 text-slate-600',
  confirmed: 'bg-blue-50 text-blue-700',
  packed: 'bg-violet-50 text-violet-700',
  dispatched: 'bg-amber-50 text-amber-700',
  delivered: 'bg-teal-50 text-teal-700',
  paid: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-700',
  // restaurant table status
  available: 'bg-emerald-50 text-emerald-700',
  occupied: 'bg-amber-50 text-amber-700',
  payment_pending: 'bg-rose-50 text-rose-700',
  // KOT status
  cooking: 'bg-amber-50 text-amber-700',
  ready: 'bg-blue-50 text-blue-700',
  served: 'bg-emerald-50 text-emerald-700',
  // purchase order
  received: 'bg-emerald-50 text-emerald-700',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${style}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
