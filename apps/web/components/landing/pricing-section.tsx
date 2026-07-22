'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';

export function PricingSection() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="space-y-12">
      {/* Header & Billing Toggle */}
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs font-bold tracking-[0.2em] text-emerald-700 uppercase mb-3">Transparent Pricing</p>
        <h2 className="text-4xl font-medium text-slate-900 tracking-tight">
          Simple plans that scale with your counter.
        </h2>
        <p className="mt-4 text-lg text-slate-600">
          No hidden fees per bill or transaction cut. Start free and upgrade when your shop grows.
        </p>

        {/* Toggle Pill */}
        <div className="mt-8 inline-flex items-center gap-3 bg-slate-200/80 p-1.5 rounded-full border border-slate-300">
          <button
            onClick={() => setAnnual(false)}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              !annual ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              annual ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Annual Billing <span className="bg-amber-400 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8 items-stretch">
        {/* Plan 1: Starter */}
        <div className="rounded-3xl bg-white/60 backdrop-blur-xl border border-white/60 p-8 shadow-xl flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Starter Free</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Single Counter</h3>
            <p className="text-sm text-slate-600 mb-6">Perfect for small kirana stores or single-table cafes setting up their first digital counter.</p>
            <div className="mb-8">
              <span className="text-4xl font-extrabold text-slate-900 font-mono">₹0</span>
              <span className="text-slate-500 text-sm font-medium"> / forever</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-600 mb-8">
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-600 shrink-0" /> Up to 200 Invoices / mo</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-600 shrink-0" /> Basic Inventory Management</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-600 shrink-0" /> Thermal Printer ESC/POS</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-600 shrink-0" /> 1 Staff Login (Cashier)</li>
            </ul>
          </div>
          <Link
            href="/signup"
            className="w-full py-3.5 px-6 text-center rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all shadow-md"
          >
            Start Free Now
          </Link>
        </div>

        {/* Plan 2: Store Pro (Featured) */}
        <div className="rounded-3xl bg-slate-900 text-white p-8 shadow-2xl flex flex-col justify-between relative border-2 border-emerald-500 hover:scale-[1.02] transition-all">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-slate-950 text-xs font-extrabold uppercase tracking-wider shadow-lg flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Most Popular
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 mt-2">Store Pro</div>
            <h3 className="text-2xl font-bold text-white mb-4">Unlimited Counter</h3>
            <p className="text-sm text-slate-300 mb-6">Designed for busy supermarkets, multi-table restaurants, and busy pharmacies.</p>
            <div className="mb-8">
              <span className="text-5xl font-extrabold text-white font-mono">{annual ? '₹799' : '₹999'}</span>
              <span className="text-slate-400 text-sm font-medium"> / month</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-300 mb-8">
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Unlimited Bills &amp; Invoices</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Real-time Batch &amp; Expiry Track</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> WhatsApp Direct Bill Delivery</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Kitchen Display &amp; KOT System</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Unlimited Staff Logins &amp; Roles</li>
            </ul>
          </div>
          <Link
            href="/signup"
            className="w-full py-3.5 px-6 text-center rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/25"
          >
            Start 14-Day Free Trial
          </Link>
        </div>

        {/* Plan 3: Enterprise */}
        <div className="rounded-3xl bg-white/60 backdrop-blur-xl border border-white/60 p-8 shadow-xl flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Multi-Branch</div>
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Enterprise Chain</h3>
            <p className="text-sm text-slate-600 mb-6">For multi-outlet retail chains, wholesale distribution, and salesman fleets.</p>
            <div className="mb-8">
              <span className="text-4xl font-extrabold text-slate-900 font-mono">{annual ? '₹1,999' : '₹2,499'}</span>
              <span className="text-slate-500 text-sm font-medium"> / branch / mo</span>
            </div>
            <ul className="space-y-3 text-sm text-slate-600 mb-8">
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-600 shrink-0" /> Multi-Branch Central Dashboard</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-600 shrink-0" /> Field Salesman Route &amp; GPS Track</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-600 shrink-0" /> Custom GST Formats &amp; Reports</li>
              <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-600 shrink-0" /> Dedicated Account Manager</li>
            </ul>
          </div>
          <Link
            href="/signup"
            className="w-full py-3.5 px-6 text-center rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all shadow-md"
          >
            Contact Sales
          </Link>
        </div>
      </div>
    </div>
  );
}
