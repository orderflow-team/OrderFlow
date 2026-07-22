'use client';

import { useState } from 'react';
import {
  Boxes,
  Printer,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Send,
  Zap,
  Check,
} from 'lucide-react';

export function BentoGrid() {
  const [testNumber, setTestNumber] = useState('9820012345');
  const [billSent, setBillSent] = useState(false);
  const [activeRole, setActiveRole] = useState<'manager' | 'cashier' | 'cook' | 'waiter'>('cashier');

  const handleSendBill = (e: React.FormEvent) => {
    e.preventDefault();
    setBillSent(true);
    setTimeout(() => setBillSent(false), 4000);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Feature 1 (Large - 2 Cols) */}
      <div className="md:col-span-2 rounded-3xl bg-white/70 backdrop-blur-2xl border border-white/80 p-8 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
        
        <div className="flex items-center justify-between mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 text-xs font-bold uppercase tracking-wider border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" /> Real-time Inventory Engine
          </span>
        </div>

        <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 tracking-tight">
          Stock levels that adjust the millisecond a bill is printed.
        </h3>
        <p className="text-slate-600 leading-relaxed max-w-xl text-base mb-6">
          Whether it&apos;s a dine-in order, walk-in grocery item, or field salesman collection — every transaction instantly updates stock balances across all counters and triggers low-stock alerts.
        </p>

        {/* Live Simulation Card inside Bento */}
        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 text-white font-mono text-xs space-y-3 shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-400">BATCH TRACKING: B2409 (FORTUNE OIL 1L)</span>
            <span className="text-emerald-400 font-bold animate-pulse">LIVE SYNC</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Initial Stock Count: 150 Units</span>
            <span className="text-amber-400">Auto FIFO Order</span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full w-[78%] transition-all duration-500" />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Sold Today: 33 Units</span>
            <span className="text-emerald-400 font-bold">117 Units Left (Optimal)</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-6 mt-6 border-t border-slate-200/80 font-mono text-xs">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
            <div className="text-slate-400">Sync Speed</div>
            <div className="text-emerald-700 font-bold text-sm mt-0.5">&lt; 20ms</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
            <div className="text-slate-400">Batch Expiry</div>
            <div className="text-slate-900 font-bold text-sm mt-0.5">FIFO Auto</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
            <div className="text-slate-400">Supplier POs</div>
            <div className="text-slate-900 font-bold text-sm mt-0.5">1-Tap Reorder</div>
          </div>
        </div>
      </div>

      {/* Feature 2 (1 Col - WhatsApp & Invoicing Simulator) */}
      <div className="rounded-3xl bg-white/70 backdrop-blur-2xl border border-white/80 p-8 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center mb-6">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-700 text-xs font-bold uppercase tracking-wider mb-3">
            1-Tap WhatsApp
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-3">
            Send GST PDF bills straight to WhatsApp.
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            Save thermal paper costs! Send itemized GST invoices with your shop branding directly to your customer&apos;s phone.
          </p>
        </div>

        {/* Interactive WhatsApp Sender Simulator */}
        <form onSubmit={handleSendBill} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-xs space-y-2">
          <div className="text-slate-400 font-mono text-[11px]">Test WhatsApp Delivery:</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              className="bg-slate-950 text-white font-mono px-3 py-2 rounded-xl border border-slate-800 w-full focus:outline-none focus:border-emerald-500"
              placeholder="+91 Phone number"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl flex items-center gap-1 shrink-0 hover:bg-emerald-400 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {billSent && (
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl text-[11px] font-mono flex items-center gap-1.5 border border-emerald-500/30 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" /> GST Invoice PDF sent to +91 {testNumber}!
            </div>
          )}
        </form>
      </div>

      {/* Feature 3 (1 Col - Thermal Receipt Printing) */}
      <div className="rounded-3xl bg-white/70 backdrop-blur-2xl border border-white/80 p-8 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden group">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-6">
          <Printer className="w-6 h-6" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 text-xs font-bold uppercase tracking-wider mb-3">
          Thermal Printing
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-3">
          Instant 2-inch &amp; 3-inch ESC/POS receipt printing.
        </h3>
        <p className="text-slate-600 text-sm leading-relaxed mb-4">
          Seamless USB, Bluetooth, and LAN thermal receipt printing formatted cleanly with itemized GST summaries.
        </p>

        {/* Visual Simulated Receipt Strip */}
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 font-mono text-[11px] text-slate-800 space-y-1 shadow-sm">
          <div className="text-center font-bold border-b border-amber-200 pb-1">ORDERFLOW RETAIL STORE</div>
          <div className="flex justify-between pt-1"><span>Bill #1092</span><span>22/07/2026</span></div>
          <div className="flex justify-between"><span>1x Parle-G 100g</span><span>₹12.00</span></div>
          <div className="flex justify-between"><span>2x Amul Milk 1L</span><span>₹136.00</span></div>
          <div className="flex justify-between font-bold border-t border-amber-200 pt-1 text-xs"><span>TOTAL</span><span>₹148.00</span></div>
        </div>
      </div>

      {/* Feature 4 (Large - 2 Cols) */}
      <div className="md:col-span-2 rounded-3xl bg-white/70 backdrop-blur-2xl border border-white/80 p-8 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden group">
        <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center mb-6">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 text-violet-700 text-xs font-bold uppercase tracking-wider mb-3">
          Role-Scoped Security
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
          Keep sensitive financial reports private from the counter.
        </h3>
        <p className="text-slate-600 leading-relaxed max-w-xl text-base mb-6">
          Assign scoped logins for Cashiers, Waiters, Cooks, and Accountants. Cashiers only see billing; cooks only see kitchen tickets; accountants get profit &amp; loss statements.
        </p>

        {/* Interactive Role Switcher Pill Bar */}
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          {[
            { key: 'cashier', label: 'Cashier (Billing Only)' },
            { key: 'cook', label: 'Cook (Kitchen Display)' },
            { key: 'waiter', label: 'Waiter (Table Orders)' },
            { key: 'manager', label: 'Manager (Full Reports)' },
          ].map((role) => (
            <button
              key={role.key}
              onClick={() => setActiveRole(role.key as any)}
              className={`px-4 py-2 rounded-full transition-all cursor-pointer ${
                activeRole === role.key
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>

        {/* Dynamic Mini Role Wireframe */}
        <div className="mt-4 p-3 bg-slate-900 text-white rounded-2xl font-mono text-xs flex justify-between items-center border border-slate-800">
          <span className="text-emerald-400">
            Current Role View: {activeRole.toUpperCase()}
          </span>
          <span className="text-slate-400 text-[11px]">
            {activeRole === 'cashier'
              ? 'Access restricted to billing & counter search'
              : activeRole === 'cook'
              ? 'Access restricted to active KOT list & order timers'
              : activeRole === 'waiter'
              ? 'Access restricted to dining floor plan & table punch'
              : 'Full admin access to P&L, stock, and staff management'}
          </span>
        </div>
      </div>
    </div>
  );
}
