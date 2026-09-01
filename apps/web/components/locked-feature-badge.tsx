'use client';

import Link from 'next/link';
import { Lock, Crown, Sparkles, ArrowRight } from 'lucide-react';

interface LockedFeatureBadgeProps {
  featureName: string;
  requiredPlan?: 'Pro' | 'Enterprise';
  description?: string;
}

export function LockedFeatureBadge({
  featureName,
  requiredPlan = 'Pro',
  description,
}: LockedFeatureBadgeProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 p-6 text-white shadow-xl border border-indigo-500/30 my-4">
      {/* Decorative Crown Watermark */}
      <div className="absolute right-0 top-0 opacity-10 translate-x-6 -translate-y-6 pointer-events-none">
        <Crown className="w-44 h-44 text-white" />
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2 max-w-lg">
          <div className="flex items-center gap-2">
            <span className="bg-yellow-400 text-indigo-950 font-extrabold px-3 py-1 rounded-full text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
              <Lock className="w-3.5 h-3.5 stroke-[3]" />
              {requiredPlan} Feature Locked
            </span>
            <span className="bg-indigo-800/60 text-indigo-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold backdrop-blur-md">
              Subscription Upgrade Required
            </span>
          </div>

          <h3 className="text-xl font-bold text-white tracking-tight">
            Unlock {featureName}
          </h3>

          <p className="text-xs sm:text-sm text-indigo-200 leading-relaxed">
            {description || `${featureName} is available exclusively on the ${requiredPlan} Plan. Upgrade today to unlock full access.`}
          </p>
        </div>

        <Link
          href="/settings/subscription"
          className="px-5 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all flex items-center gap-2 shrink-0 active:scale-95"
        >
          <span>Upgrade to {requiredPlan} ✨</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

interface LockedFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  requiredPlan?: 'Pro' | 'Enterprise';
  description?: string;
}

export function LockedFeatureModal({
  isOpen,
  onClose,
  featureName,
  requiredPlan = 'Pro',
  description,
}: LockedFeatureModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-indigo-500/40 relative overflow-hidden my-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center text-slate-950 shadow-lg shrink-0 mt-0.5">
              <Crown className="w-6 h-6 fill-current" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-amber-400/20 text-amber-300 font-extrabold px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider border border-amber-400/30">
                  🔒 {requiredPlan} Feature Locked
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
                Unlock {featureName}
              </h2>
              <p className="text-xs text-indigo-200 leading-relaxed max-w-md">
                {description || `${featureName} is exclusive to the ${requiredPlan} Plan. Upgrade today to unlock.`}
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col items-center gap-2 w-full sm:w-auto shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-indigo-800/40">
            <Link
              href="/settings/subscription"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <span>Upgrade to {requiredPlan}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto py-1.5 text-xs font-semibold text-indigo-300 hover:text-white transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
