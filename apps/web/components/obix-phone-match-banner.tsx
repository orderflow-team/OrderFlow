'use client';

import { Link2, X, Loader2, Check, Clock } from 'lucide-react';

interface ObixPhoneMatchBannerProps {
  match: { businessId: string; name: string } | null;
  connectionStatus: 'none' | 'pending' | 'accepted' | 'rejected';
  connecting: boolean;
  error?: string;
  /** 'retailer' = this business would be buying from the match; 'wholesaler' = selling to it. */
  role: 'retailer' | 'wholesaler';
  onConnect: () => void;
  onDismiss: () => void;
}

const COUNTERPART_LABEL: Record<'retailer' | 'wholesaler', string> = {
  retailer: 'wholesaler',
  wholesaler: 'retailer',
};

/** Inline nudge shown wherever a phone number is typed (Supplier/Customer forms, placing an order) that turns out to belong to a real OBIX business — see lib/use-obix-phone-match.ts. */
export function ObixPhoneMatchBanner({ match, connectionStatus, connecting, error, role, onConnect, onDismiss }: ObixPhoneMatchBannerProps) {
  if (!match) return null;

  return (
    <div className="flex items-center gap-2 bg-sky-50/80 ring-1 ring-sky-200/60 rounded-xl px-3 py-2 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
      <Link2 className="w-3.5 h-3.5 text-sky-600 shrink-0" />
      <div className="flex-1 min-w-0 text-xs text-sky-800">
        {connectionStatus === 'accepted' ? (
          <span className="flex items-center gap-1 font-medium text-emerald-700">
            <Check className="w-3 h-3" /> Already linked to <span className="font-semibold">{match.name}</span> on OBIX
          </span>
        ) : connectionStatus === 'pending' ? (
          <span className="flex items-center gap-1 font-medium text-amber-700">
            <Clock className="w-3 h-3" /> Connection request to <span className="font-semibold">{match.name}</span> is pending
          </span>
        ) : (
          <span>
            <span className="font-semibold">{match.name}</span> is on OBIX — connect as your {COUNTERPART_LABEL[role]}?
          </span>
        )}
        {error && <p className="text-rose-600 mt-0.5">{error}</p>}
      </div>
      {connectionStatus === 'none' || connectionStatus === 'rejected' ? (
        <button
          type="button"
          onClick={onConnect}
          disabled={connecting}
          className="shrink-0 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 rounded-full px-3 py-1 transition-colors"
        >
          {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
        </button>
      ) : null}
      <button type="button" onClick={onDismiss} className="shrink-0 text-sky-400 hover:text-sky-700" aria-label="Dismiss">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
