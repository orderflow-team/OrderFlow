export function expiryStatus(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'Expired', tone: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20' };
  if (days <= 60) return { label: `Expires in ${days}d`, tone: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20' };
  return {
    label: `Exp ${new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}`,
    tone: 'bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/20',
  };
}
