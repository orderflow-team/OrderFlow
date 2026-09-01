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
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-indigo-100 relative overflow-hidden text-center space-y-5">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full opacity-15 blur-2xl pointer-events-none" />
        
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-700 flex items-center justify-center text-amber-300 shadow-xl shadow-indigo-200 ring-4 ring-indigo-50">
          <Crown className="w-9 h-9 fill-current" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            {requiredPlan} Feature Locked
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Unlock {featureName}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
            {description || `${featureName} is exclusive to the ${requiredPlan} Plan. Upgrade today to unlock full access across all your devices.`}
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/settings/subscription"
            onClick={onClose}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white font-extrabold text-sm shadow-xl shadow-indigo-300 hover:shadow-indigo-400 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span>Upgrade to {requiredPlan} Plan ✨</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
