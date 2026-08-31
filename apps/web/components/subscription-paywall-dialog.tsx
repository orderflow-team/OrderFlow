'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Crown, Zap, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface SubscriptionData {
  status: 'trialing' | 'active' | 'past_due' | 'expired' | 'canceled';
  planCode: string;
  planName: string;
  trialDaysLeft: number;
}

export function SubscriptionPaywallDialog() {
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const checkSubscription = async () => {
    // Don't show modal if already on the subscription settings page or auth pages
    if (pathname.startsWith('/settings/subscription') || pathname.startsWith('/login') || pathname.startsWith('/register')) {
      setIsOpen(false);
      return;
    }

    try {
      const res = await apiClient.get('/api/subscriptions/current');
      setSub(res.data);
      if (res.data?.status === 'expired' || res.data?.status === 'canceled') {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    } catch (err) {
      console.error('Failed to check subscription status:', err);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [pathname]);

  // Listen for HTTP 402 Paywall signals from API interceptor
  useEffect(() => {
    const handlePaywallTrigger = () => {
      if (!pathname.startsWith('/settings/subscription')) {
        setIsOpen(true);
      }
    };
    window.addEventListener('orderflow-paywall-required', handlePaywallTrigger);
    return () => {
      window.removeEventListener('orderflow-paywall-required', handlePaywallTrigger);
    };
  }, [pathname]);

  if (!isOpen || !sub) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-indigo-100 relative overflow-hidden text-center space-y-6">
        {/* Top Decorative Background Glow */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full opacity-15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-gradient-to-tr from-yellow-400 to-amber-500 rounded-full opacity-15 blur-2xl pointer-events-none" />

        {/* Crown Icon Avatar */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-700 flex items-center justify-center text-amber-300 shadow-xl shadow-indigo-200 ring-4 ring-indigo-50">
          <Crown className="w-9 h-9 fill-current" />
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            30-Day Free Trial Expired
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Upgrade Your Plan to Continue
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
            Your 30-day free trial has completed. Choose a plan starting at <strong>₹59/month</strong> to keep creating orders and accessing all features.
          </p>
        </div>

        {/* Features Quick List */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-left space-y-2 text-xs text-slate-700">
          <div className="flex items-center gap-2 font-semibold text-indigo-950">
            <Zap className="w-4 h-4 text-indigo-600 fill-indigo-600 shrink-0" />
            <span>All your store data, inventory & bills remain 100% safe.</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Select Mobile Starter (₹59) or Pro Plan (₹399).</span>
          </div>
        </div>

        {/* Action Upgrade Button */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            router.push('/settings/subscription');
          }}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white font-extrabold text-sm shadow-xl shadow-indigo-300 hover:shadow-indigo-400 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span>Upgrade Subscription Plan</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
