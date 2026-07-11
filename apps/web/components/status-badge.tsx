const STATUS_STYLES: Record<string, string> = {
  // order / KOT lifecycle
  draft: 'bg-slate-500/10 text-slate-600 ring-slate-500/20',
  confirmed: 'bg-blue-500/10 text-blue-700 ring-blue-500/20',
  packed: 'bg-violet-500/10 text-violet-700 ring-violet-500/20',
  dispatched: 'bg-amber-500/10 text-amber-700 ring-amber-500/20',
  delivered: 'bg-teal-500/10 text-teal-700 ring-teal-500/20',
  paid: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20',
  cancelled: 'bg-rose-500/10 text-rose-700 ring-rose-500/20',
  returned: 'bg-yellow-500/10 text-yellow-700 ring-yellow-500/20',
  // restaurant table status
  available: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20',
  occupied: 'bg-amber-500/10 text-amber-700 ring-amber-500/20',
  payment_pending: 'bg-rose-500/10 text-rose-700 ring-rose-500/20',
  // KOT status
  cooking: 'bg-amber-500/10 text-amber-700 ring-amber-500/20',
  ready: 'bg-blue-500/10 text-blue-700 ring-blue-500/20',
  served: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20',
  // purchase order
  received: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || 'bg-slate-500/10 text-slate-600 ring-slate-500/20';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize backdrop-blur-sm ring-1 ${style}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
