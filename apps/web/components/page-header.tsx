export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>
      {description && <p className="text-slate-500 text-sm">{description}</p>}
    </div>
  );
}
