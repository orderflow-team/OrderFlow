/**
 * Recreated from the OBIX brand mark (blue "O", navy "B"/"I", blue-to-emerald
 * gradient "X") since we only have a pasted reference image, not the source
 * file — swap in the real asset later if pixel-perfect fidelity matters.
 */

export function ObixMark({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="obix-mark-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="#0f172a" />
      <path d="M12 12 L21 20 L12 28" stroke="#3b82f6" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M28 12 L19 20 L28 28" stroke="url(#obix-mark-grad)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
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
