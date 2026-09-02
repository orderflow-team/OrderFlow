'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Building2,
  Smartphone,
  Crown,
  ArrowLeft,
  X,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface SubscriptionData {
  status: 'trialing' | 'active' | 'past_due' | 'expired' | 'canceled';
  planCode: string;
  planName: string;
  trialDaysLeft: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  quotas: {
    ordersUsedThisMonth: number;
    maxOrdersPerMonth: number;
    aiScansUsedThisMonth: number;
    maxAiScansPerMonth: number;
    staffUsersCount: number;
    maxStaffUsers: number;
  };
  features: Record<string, boolean>;
}

export default function SubscriptionSettingsPage() {
  const router = useRouter();
  const [sub, setSub] = useState<SubscriptionData | null>(null);

  const handleClose = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/dashboard');
    }
  };
  const [loading, setLoading] = useState(true);
  const [upgradingCode, setUpgradingCode] = useState<string | null>(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('pro');
  const [mobileActiveTab, setMobileActiveTab] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [inputReferralCode, setInputReferralCode] = useState('');
  const [applyingReferral, setApplyingReferral] = useState(false);
  const [message, setMessage] = useState('');
  const [referralInfo, setReferralInfo] = useState<{
    referralCode: string;
    referralLink: string;
    totalReferrals: number;
    bonusDaysEarned: number;
    shareMessage: string;
  } | null>(null);

  const handleApplyReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputReferralCode.trim()) return;
    setApplyingReferral(true);
    try {
      const res = await apiClient.post('/api/subscriptions/apply-referral', { referralCode: inputReferralCode.trim() });
      setMessage(res.data.message || 'Referral code applied! 30 Bonus Days credited! 🎉');
      setInputReferralCode('');
      fetchSubscription();
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Invalid or expired referral code.');
    } finally {
      setApplyingReferral(false);
    }
  };

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const [resSub, resRef] = await Promise.all([
        apiClient.get('/api/subscriptions/current'),
        apiClient.get('/api/subscriptions/referral-info').catch(() => null),
      ]);
      setSub(resSub.data);
      if (resRef) setReferralInfo(resRef.data);
      if (resSub.data?.planCode) {
        setSelectedPlanCode(resSub.data.planCode);
        if (resSub.data.planCode === 'starter' || resSub.data.planCode === 'pro' || resSub.data.planCode === 'enterprise') {
          setMobileActiveTab(resSub.data.planCode);
        }
      }
    } catch (err: any) {
      console.error('Failed to load subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const handleSimulateUpgrade = async (planCode: string) => {
    try {
      setUpgradingCode(planCode);
      setSelectedPlanCode(planCode);
      setMessage('');
      const res = await apiClient.post('/api/subscriptions/simulate-upgrade', {
        planCode,
        billingCycle,
      });
      setMessage(res.data.message || 'Plan upgrade active!');
      await fetchSubscription();
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Upgrade failed');
    } finally {
      setUpgradingCode(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-200 animate-ping opacity-75" />
            <div className="relative w-10 h-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest animate-pulse">
            Loading Subscriptions...
          </p>
        </div>
      </div>
    );
  }

  const isTrial = sub?.status === 'trialing';
  const isActive = sub?.status === 'active';

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 md:p-8 space-y-5 sm:space-y-8 bg-slate-50/50 min-h-screen">
      {/* Top Back & Close Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleClose}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 shadow-sm transition active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          onClick={handleClose}
          aria-label="Close page"
          className="p-2 rounded-full bg-slate-200/80 hover:bg-rose-500 hover:text-white text-slate-600 transition shadow-sm active:scale-95"
          title="Close Subscription Page"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Top Banner Header */}
      <div className="relative bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-xl overflow-hidden border border-indigo-700/50">
        <div className="absolute right-0 top-0 opacity-10 translate-x-6 -translate-y-6 pointer-events-none">
          <Crown className="w-48 h-48 sm:w-64 sm:h-64 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-yellow-400 text-indigo-950 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <Crown className="w-3.5 h-3.5 fill-current" />
                {sub?.planName || 'PRO PLAN'}
              </span>
              {isTrial && (
                <span className="bg-indigo-700/80 text-indigo-100 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md">
                  30-Day Free Trial ({sub.trialDaysLeft} days remaining)
                </span>
              )}
              {isActive && (
                <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Active Subscription
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white">
              Orderflow Subscription Status
            </h1>
            <p className="text-indigo-200 text-xs sm:text-sm">
              Manage your store workspace subscription, view usage quotas, or upgrade your plan.
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-xs text-emerald-700 hover:text-emerald-950 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Centered Heading & Pill Toggle */}
      <div className="flex flex-col items-center text-center space-y-3 pt-2">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
          Choose Your Subscription Plan
        </h2>

        {/* Pill Toggle Container */}
        <div className="bg-slate-200/70 p-1.5 rounded-full flex items-center gap-2 border border-slate-300/60 shadow-inner max-w-xs sm:max-w-sm w-full justify-center">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-full text-xs font-semibold transition ${
              billingCycle === 'monthly'
                ? 'bg-white text-indigo-950 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              billingCycle === 'yearly'
                ? 'bg-white text-indigo-950 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Annual Billing
            <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
              Save 17%
            </span>
          </button>
        </div>
      </div>

      {/* 📱 MOBILE VIEW ONLY (<768px): Segmented Mobile Plan Switcher */}
      <div className="block md:hidden space-y-4 pt-1">
        {/* Segmented Tab Switch */}
        <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center gap-1 border border-slate-300/70 shadow-inner">
          <button
            onClick={() => setMobileActiveTab('starter')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
              mobileActiveTab === 'starter'
                ? 'bg-white text-slate-900 shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Starter ₹59
          </button>
          <button
            onClick={() => setMobileActiveTab('pro')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 relative ${
              mobileActiveTab === 'pro'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-indigo-700 hover:text-indigo-950'
            }`}
          >
            ⭐ Pro ₹399
          </button>
          <button
            onClick={() => setMobileActiveTab('enterprise')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
              mobileActiveTab === 'enterprise'
                ? 'bg-purple-900 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Enterprise ₹999
          </button>
        </div>

        {/* Mobile Active Card Display (Full Uncompressed Proper Card) */}
        {mobileActiveTab === 'starter' && (
          <div
            onClick={() => setSelectedPlanCode('starter')}
            className="bg-white rounded-3xl p-6 border-2 border-indigo-600 ring-4 ring-indigo-500/10 shadow-xl transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                  <Smartphone className="w-5 h-5" />
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ENTRY LEVEL</span>
              </div>

              <h3 className="text-xl font-bold text-slate-900">Mobile Starter</h3>
              <p className="text-xs text-slate-500 mt-1">Essential digital POS for Kirana & small retail shops</p>

              <div className="my-5">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {billingCycle === 'yearly' ? '₹599' : '₹59'}
                  </span>
                  <span className="text-xs text-slate-500">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-xs font-semibold text-emerald-600 mt-1">Equivalent to ~₹49/month</p>
                )}
              </div>

              <div className="space-y-3 text-xs text-slate-600 mb-6">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>500 Orders</strong> / month</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>1 Active Billing Device</strong></span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>2 Staff Accounts</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>15 AI Invoice Scans / month</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>POS Barcode & Customer Khata</span>
                </div>
              </div>
            </div>

            <button
              disabled={upgradingCode === 'starter' || (sub?.planCode === 'starter' && isActive)}
              onClick={() => handleSimulateUpgrade('starter')}
              className={`w-full py-3.5 rounded-full font-bold transition flex items-center justify-center gap-2 text-xs min-h-[44px] ${
                sub?.planCode === 'starter' && isActive
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-slate-900 text-white shadow-md active:scale-95'
              }`}
            >
              {upgradingCode === 'starter' ? 'Upgrading...' : sub?.planCode === 'starter' && isActive ? 'Current Plan' : 'Select Starter →'}
            </button>
          </div>
        )}

        {mobileActiveTab === 'pro' && (
          <div
            onClick={() => setSelectedPlanCode('pro')}
            className="bg-white rounded-3xl p-6 border-2 border-indigo-600 shadow-2xl transition-all flex flex-col justify-between relative overflow-hidden ring-4 ring-indigo-500/10"
          >
            <div className="absolute -top-px -right-px bg-indigo-600 text-white text-[10px] font-extrabold px-4 py-1.5 rounded-bl-2xl rounded-tr-3xl uppercase tracking-wider shadow-sm z-10">
              MOST POPULAR
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-200">
                  <Zap className="w-5 h-5 fill-current" />
                </span>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider pr-24">AUTOMATED BIZ</span>
              </div>

              <h3 className="text-xl font-bold text-slate-900">Pro Plan</h3>
              <p className="text-xs text-slate-500 mt-1">For Pharmacies, Restaurants, Supermarkets & Wholesalers</p>

              <div className="my-5">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {billingCycle === 'yearly' ? '₹3,999' : '₹399'}
                  </span>
                  <span className="text-xs text-slate-500">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-xs font-semibold text-emerald-600 mt-1">Equivalent to ~₹333/month</p>
                )}
              </div>

              <div className="space-y-3 text-xs text-slate-600 mb-6">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong className="text-slate-900">UNLIMITED Orders</strong></span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>5 Active Billing Devices</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>10 Staff Accounts</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong className="text-slate-900">100 AI Invoice Scans</strong> / month</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Pharmacy FEFO Expiry & H1 Register</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Restaurant KOT & Table Layout</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Automated WhatsApp Invoices</span>
                </div>
              </div>
            </div>

            <button
              disabled={upgradingCode === 'pro' || (sub?.planCode === 'pro' && isActive)}
              onClick={() => handleSimulateUpgrade('pro')}
              className={`w-full py-3.5 rounded-full font-bold transition flex items-center justify-center gap-2 text-xs min-h-[44px] ${
                sub?.planCode === 'pro' && isActive
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 active:scale-95'
              }`}
            >
              {upgradingCode === 'pro' ? 'Upgrading...' : sub?.planCode === 'pro' && isActive ? 'Current Plan' : 'Select Pro ✨'}
            </button>
          </div>
        )}

        {mobileActiveTab === 'enterprise' && (
          <div
            onClick={() => setSelectedPlanCode('enterprise')}
            className="bg-white rounded-3xl p-6 border-2 border-indigo-600 ring-4 ring-indigo-500/10 shadow-xl transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
                  <Building2 className="w-5 h-5" />
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">MULTI-BRANCH</span>
              </div>

              <h3 className="text-xl font-bold text-slate-900">Enterprise Plan</h3>
              <p className="text-xs text-slate-500 mt-1">For Multi-store chains & regional distributors</p>

              <div className="my-5">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {billingCycle === 'yearly' ? '₹9,999' : '₹999'}
                  </span>
                  <span className="text-xs text-slate-500">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-xs font-semibold text-emerald-600 mt-1">Equivalent to ~₹833/month</p>
                )}
              </div>

              <div className="space-y-3 text-xs text-slate-600 mb-6">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong className="text-slate-900">UNLIMITED Everything</strong></span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span><strong>Multi-Branch Outlets</strong></span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Inter-Store Stock Transfer</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Unlimited Salesmen GPS Routes</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>24/7 Dedicated Account Manager</span>
                </div>
              </div>
            </div>

            <button
              disabled={upgradingCode === 'enterprise' || (sub?.planCode === 'enterprise' && isActive)}
              onClick={() => handleSimulateUpgrade('enterprise')}
              className={`w-full py-3.5 rounded-full font-bold transition flex items-center justify-center gap-2 text-xs min-h-[44px] ${
                sub?.planCode === 'enterprise' && isActive
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-slate-900 text-white shadow-md active:scale-95'
              }`}
            >
              {upgradingCode === 'enterprise' ? 'Upgrading...' : sub?.planCode === 'enterprise' && isActive ? 'Current Plan' : 'Select Enterprise →'}
            </button>
          </div>
        )}
      </div>

      {/* 🖥️ DESKTOP VIEW ONLY (≥768px): Original 3-Column Side-by-Side Grid */}
      <div className="hidden md:grid md:grid-cols-3 gap-6 items-stretch pt-2">
        {/* Starter Plan Card */}
        <div
          onClick={() => setSelectedPlanCode('starter')}
          className={`bg-white rounded-3xl p-6 border-2 transition-all duration-300 flex flex-col justify-between cursor-pointer relative shadow-sm hover:shadow-xl group ${
            selectedPlanCode === 'starter'
              ? 'border-indigo-600 ring-4 ring-indigo-500/10'
              : 'border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div>
            <div className="flex justify-between items-center mb-5">
              <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
                <Smartphone className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ENTRY LEVEL</span>
            </div>

            <h3 className="text-xl font-bold text-slate-900">Mobile Starter</h3>
            <p className="text-xs text-slate-500 mt-1">Essential digital POS for Kirana & small retail shops</p>

            <div className="my-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900">
                  {billingCycle === 'yearly' ? '₹599' : '₹59'}
                </span>
                <span className="text-xs text-slate-500">
                  /{billingCycle === 'yearly' ? 'year' : 'month'}
                </span>
              </div>
              {billingCycle === 'yearly' && (
                <p className="text-xs font-semibold text-emerald-600 mt-1">Equivalent to ~₹49/month</p>
              )}
            </div>

            <div className="space-y-3 text-xs text-slate-600 mb-8">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>500 Orders</strong> / month</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>1 Active Billing Device</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>2 Staff Accounts</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>15 AI Invoice Scans / month</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>POS Barcode & Customer Khata</span>
              </div>
            </div>
          </div>

          <button
            disabled={upgradingCode === 'starter' || (sub?.planCode === 'starter' && isActive)}
            onClick={(e) => {
              e.stopPropagation();
              handleSimulateUpgrade('starter');
            }}
            className={`w-full py-3 rounded-full font-bold transition flex items-center justify-center gap-2 text-xs ${
              sub?.planCode === 'starter' && isActive
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-slate-900 hover:bg-indigo-950 text-white shadow-md'
            }`}
          >
            {upgradingCode === 'starter' ? 'Upgrading...' : sub?.planCode === 'starter' && isActive ? 'Current Plan' : 'Select Starter →'}
          </button>
        </div>

        {/* Pro Plan Card (Featured Blue/Purple Border) */}
        <div
          onClick={() => setSelectedPlanCode('pro')}
          className={`bg-white rounded-3xl p-6 border-2 border-indigo-600 shadow-2xl transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden ${
            selectedPlanCode === 'pro'
              ? 'ring-4 ring-indigo-500/10'
              : 'hover:border-indigo-700'
          }`}
        >
          {/* Top Right MOST POPULAR Badge */}
          <div className="absolute -top-px -right-px bg-indigo-600 text-white text-[10px] font-extrabold px-4 py-1.5 rounded-bl-2xl rounded-tr-3xl uppercase tracking-wider shadow-sm z-10">
            MOST POPULAR
          </div>

          <div>
            <div className="flex justify-between items-center mb-5">
              <span className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-200">
                <Zap className="w-5 h-5 fill-current" />
              </span>
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">AUTOMATED BIZ</span>
            </div>

            <h3 className="text-xl font-bold text-slate-900">Pro Plan</h3>
            <p className="text-xs text-slate-500 mt-1">For Pharmacies, Restaurants, Supermarkets & Wholesalers</p>

            <div className="my-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900">
                  {billingCycle === 'yearly' ? '₹3,999' : '₹399'}
                </span>
                <span className="text-xs text-slate-500">
                  /{billingCycle === 'yearly' ? 'year' : 'month'}
                </span>
              </div>
              {billingCycle === 'yearly' && (
                <p className="text-xs font-semibold text-emerald-600 mt-1">Equivalent to ~₹333/month</p>
              )}
            </div>

            <div className="space-y-3 text-xs text-slate-600 mb-8">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong className="text-slate-900">UNLIMITED Orders</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>5 Active Billing Devices</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>10 Staff Accounts</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong className="text-slate-900">100 AI Invoice Scans</strong> / month</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Pharmacy FEFO Expiry & H1 Register</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Restaurant KOT & Table Layout</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Automated WhatsApp Invoices</span>
              </div>
            </div>
          </div>

          <button
            disabled={upgradingCode === 'pro' || (sub?.planCode === 'pro' && isActive)}
            onClick={(e) => {
              e.stopPropagation();
              handleSimulateUpgrade('pro');
            }}
            className={`w-full py-3 rounded-full font-bold transition flex items-center justify-center gap-2 text-xs ${
              sub?.planCode === 'pro' && isActive
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200'
            }`}
          >
            {upgradingCode === 'pro' ? 'Upgrading...' : sub?.planCode === 'pro' && isActive ? 'Current Plan' : 'Select Pro ✨'}
          </button>
        </div>

        {/* Enterprise Plan Card */}
        <div
          onClick={() => setSelectedPlanCode('enterprise')}
          className={`bg-white rounded-3xl p-6 border-2 transition-all duration-300 flex flex-col justify-between cursor-pointer relative shadow-sm hover:shadow-xl group ${
            selectedPlanCode === 'enterprise'
              ? 'border-indigo-600 ring-4 ring-indigo-500/10'
              : 'border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div>
            <div className="flex justify-between items-center mb-5">
              <span className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
                <Building2 className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">MULTI-BRANCH</span>
            </div>

            <h3 className="text-xl font-bold text-slate-900">Enterprise Plan</h3>
            <p className="text-xs text-slate-500 mt-1">For Multi-store chains & regional distributors</p>

            <div className="my-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-slate-900">
                  {billingCycle === 'yearly' ? '₹9,999' : '₹999'}
                </span>
                <span className="text-xs text-slate-500">
                  /{billingCycle === 'yearly' ? 'year' : 'month'}
                </span>
              </div>
              {billingCycle === 'yearly' && (
                <p className="text-xs font-semibold text-emerald-600 mt-1">Equivalent to ~₹833/month</p>
              )}
            </div>

            <div className="space-y-3 text-xs text-slate-600 mb-8">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong className="text-slate-900">UNLIMITED Everything</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>Multi-Branch Outlets</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Inter-Store Stock Transfer</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Unlimited Salesmen GPS Routes</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>24/7 Dedicated Account Manager</span>
              </div>
            </div>
          </div>

          <button
            disabled={upgradingCode === 'enterprise' || (sub?.planCode === 'enterprise' && isActive)}
            onClick={(e) => {
              e.stopPropagation();
              handleSimulateUpgrade('enterprise');
            }}
            className={`w-full py-3 rounded-full font-bold transition flex items-center justify-center gap-2 text-xs ${
              sub?.planCode === 'enterprise' && isActive
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-slate-900 hover:bg-indigo-950 text-white shadow-md'
            }`}
          >
            {upgradingCode === 'enterprise' ? 'Upgrading...' : sub?.planCode === 'enterprise' && isActive ? 'Current Plan' : 'Select Enterprise →'}
          </button>
        </div>
      </div>

      {/* 🎁 Referral Rewards Program Banner */}
      {(() => {
        const displayRef = referralInfo || {
          referralCode: 'OF-REWARD',
          referralLink: 'https://orderflow.in/signup?ref=OF-REWARD',
          totalReferrals: 0,
          bonusDaysEarned: 0,
          shareMessage: 'Hey! I use Orderflow to manage my shop POS billing & inventory. Use my referral link to get a 30-Day FREE Pro Trial + 30 Extra Bonus Days! Signup here: https://orderflow.in/signup?ref=OF-REWARD',
        };
        return (
          <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-indigo-500/30 relative overflow-hidden space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
              <div className="space-y-2 max-w-xl">
                <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 font-black px-3.5 py-1 rounded-full text-[11px] uppercase tracking-wider inline-flex items-center gap-1.5 shadow-md shadow-amber-500/20">
                  🎁 Referral Program
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Invite a Kirana or Pharmacy Friend — Get 1 Month FREE!
                </h3>
                <p className="text-sm text-indigo-200/90 leading-relaxed">
                  Share your unique referral code with fellow shopkeepers. When they register, <strong className="text-amber-300">both you and your friend get 30 Bonus Days of Pro Plan for FREE!</strong>
                </p>
              </div>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(displayRef.shareMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95 border border-emerald-400/50"
              >
                <span className="text-base">📲</span>
                <span>Share on WhatsApp</span>
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-indigo-800/50">
              <div className="bg-white/5 backdrop-blur-xl p-4 rounded-2xl border border-white/10 flex items-center justify-between shadow-inner">
                <div>
                  <p className="text-[10px] uppercase font-bold text-amber-300/90 tracking-wider">Your Referral Code</p>
                  <p className="text-lg font-black font-mono text-amber-400 mt-0.5 tracking-wider">{displayRef.referralCode}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(displayRef.referralCode);
                    setMessage(`Referral code ${displayRef.referralCode} copied to clipboard!`);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 font-extrabold text-xs border border-amber-400/40 active:scale-95 transition"
                >
                  Copy
                </button>
              </div>

              <div className="bg-white/5 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-inner">
                <p className="text-[10px] uppercase font-bold text-indigo-300/90 tracking-wider">Successful Referrals</p>
                <p className="text-xl font-extrabold text-white mt-0.5">{displayRef.totalReferrals} Stores Joined</p>
              </div>

              <div className="bg-white/5 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-inner">
                <p className="text-[10px] uppercase font-bold text-emerald-300/90 tracking-wider">Bonus Pro Days Earned</p>
                <p className="text-xl font-extrabold text-emerald-400 mt-0.5">+{displayRef.bonusDaysEarned} Free Days</p>
              </div>
            </div>

            {/* Apply Referral Code Input Form */}
            <form onSubmit={handleApplyReferral} className="pt-4 border-t border-indigo-800/50 flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 w-full">
                <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-1.5">
                  <span>🎁</span>
                  <span>Received a referral code from a friend?</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter Referral Code (e.g. OF-ABC123)"
                  value={inputReferralCode}
                  onChange={(e) => setInputReferralCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950/70 border border-purple-500/40 text-white font-mono text-sm placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/40 transition shadow-inner"
                />
              </div>
              <button
                type="submit"
                disabled={applyingReferral || !inputReferralCode.trim()}
                className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 disabled:opacity-50 text-amber-950 font-black text-xs shadow-lg shadow-amber-500/30 transition active:scale-95 shrink-0 uppercase tracking-wider"
              >
                {applyingReferral ? 'Applying...' : 'Claim 30 Free Days 🎉'}
              </button>
            </form>
          </div>
        );
      })()}
    </div>
  );
}
