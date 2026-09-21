'use client';

interface GooglePlayButtonProps {
  className?: string;
  variant?: 'dark' | 'glass' | 'light';
  size?: 'default' | 'sm';
}

export function GooglePlayButton({ className = '', variant = 'dark', size = 'default' }: GooglePlayButtonProps) {
  // Official Google Play Store URL for Obix
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.obix.app';

  if (size === 'sm') {
    return (
      <a
        href={playStoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs ${
          variant === 'dark'
            ? 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-700'
            : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200'
        } ${className}`}
      >
        <GooglePlayIcon className="w-4 h-4" />
        <div className="text-left leading-none">
          <div className="text-[8px] uppercase tracking-wider text-slate-400 font-medium">Get it on</div>
          <div className="text-[11px] font-bold">Google Play</div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={playStoreUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center h-14 px-6 sm:px-7 rounded-full transition-all group cursor-pointer ${
        variant === 'dark'
          ? 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-700/80 shadow-lg shadow-slate-950/20 hover:scale-[1.02]'
          : 'bg-white/85 hover:bg-white text-slate-900 border border-white/80 shadow-md backdrop-blur-md hover:scale-[1.02]'
      } ${className}`}
    >
      <GooglePlayIcon className="w-6 h-6 mr-3 shrink-0" />
      <div className="text-left leading-tight">
        <div className="text-[9px] uppercase tracking-[0.18em] text-slate-400 font-semibold">GET IT ON</div>
        <div className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
          <span>Google Play</span>
          <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/15 px-1.5 py-0.2 rounded border border-amber-400/30">
            ★ 4.9
          </span>
        </div>
      </div>
    </a>
  );
}

export function GooglePlayIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3.60875 1.55437C3.39062 1.7825 3.25 2.14875 3.25 2.65625V21.3438C3.25 21.8512 3.39062 22.2175 3.60875 22.4456L3.68125 22.5181L14.0737 12.1256V11.8744L3.68125 1.48187L3.60875 1.55437Z"
        fill="#00D3FF"
      />
      <path
        d="M17.5337 15.5869L14.0737 12.1269V11.8731L17.5337 8.41312L17.6162 8.46187L21.7287 10.7994C22.9025 11.4644 22.9025 12.5356 21.7287 13.2031L17.6162 15.5381L17.5337 15.5869Z"
        fill="#FFCE00"
      />
      <path
        d="M17.6162 15.5381L14.0737 12L3.60875 22.4456C3.99375 22.8531 4.64625 22.9019 5.39375 22.4831L17.6162 15.5381Z"
        fill="#FF3A44"
      />
      <path
        d="M17.6162 8.46188L5.39375 1.51688C4.64625 1.09813 3.99375 1.14688 3.60875 1.55438L14.0737 12L17.6162 8.46188Z"
        fill="#00E676"
      />
    </svg>
  );
}
