export function ObixMark({ className = 'w-9 h-9' }: { className?: string }) {
  return <img src="/obix-mark.png" alt="OBIX" className={`${className} object-contain`} />;
}

export function ObixWordmark({
  className = '',
  size = 'text-xl',
  tagline = false,
}: {
  className?: string;
  size?: string;
  tagline?: boolean;
}) {
  return (
    <div className={className}>
      <div className={`flex items-baseline font-extrabold tracking-tight leading-none ${size}`}>
        <span className="text-blue-600">O</span>
        <span className="text-slate-900">B</span>
        <span className="text-slate-900">I</span>
        <span className="bg-gradient-to-br from-blue-600 to-emerald-500 bg-clip-text text-transparent">X</span>
      </div>
      {tagline && (
        <div className="flex items-center gap-2 mt-1.5">
          <span className="h-px w-4 bg-slate-300" />
          <span className="text-[10px] tracking-[0.2em] text-slate-500 font-semibold uppercase">
            Business. Simplified.
          </span>
          <span className="h-px w-4 bg-slate-300" />
        </div>
      )}
    </div>
  );
}
