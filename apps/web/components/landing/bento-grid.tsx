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

  const [thermalPrinting, setThermalPrinting] = useState(false);

  const handleTestPrint = () => {
    setThermalPrinting(true);
    setTimeout(() => setThermalPrinting(false), 2200);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
      {/* Feature 1 (Large - 2 Cols) */}
      <div className="md:col-span-2 rounded-[2.5rem] bg-white/80 backdrop-blur-2xl border border-white/90 p-8 sm:p-9 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
        
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <Boxes className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-800 text-xs font-bold uppercase tracking-wider border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Real-time Inventory Engine
            </span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 tracking-tight">
            Stock levels that adjust the millisecond a bill is printed.
          </h3>
          <p className="text-slate-600 leading-relaxed max-w-xl text-sm sm:text-base mb-6">
            Whether it&apos;s a dine-in order, walk-in grocery item, or field salesman collection — every transaction instantly updates stock balances across all counters and triggers low-stock alerts.
          </p>

          {/* Authentic Obix Stock Summary Card matching Play Store UI */}
          <div className="bg-slate-50/90 rounded-2xl p-5 border border-slate-200/80 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-bold text-[11px] uppercase tracking-wider">Inventory Stock Summary</span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold text-[10px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Sync
              </span>
            </div>

            {/* 3 Metrics matching real app */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
                <div className="text-[10px] text-slate-400 font-medium">In Stock</div>
                <div className="text-sm font-extrabold text-slate-900 mt-0.5">1,240</div>
              </div>
              <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/60 shadow-2xs">
                <div className="text-[10px] text-amber-700 font-medium">Low Stock</div>
                <div className="text-sm font-extrabold text-amber-700 mt-0.5">18</div>
              </div>
              <div className="p-2.5 bg-rose-50/70 rounded-xl border border-rose-200/60 shadow-2xs">
                <div className="text-[10px] text-rose-700 font-medium">Out of Stock</div>
                <div className="text-sm font-extrabold text-rose-700 mt-0.5">6</div>
              </div>
            </div>

            {/* Batch Progress */}
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1.5 font-medium">
                <span>Fortune Refined Oil 1L (Batch B2409)</span>
                <span className="text-slate-900 font-bold">117 / 150 Units Left</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full w-[78%]" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-6 mt-6 border-t border-slate-200/80 text-xs">
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70">
            <div className="text-slate-400 text-[11px] font-medium">Sync Speed</div>
            <div className="text-emerald-700 font-bold text-sm mt-0.5">&lt; 20ms</div>
          </div>
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70">
            <div className="text-slate-400 text-[11px] font-medium">Batch Expiry</div>
            <div className="text-slate-900 font-bold text-sm mt-0.5">FIFO Auto</div>
          </div>
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70">
            <div className="text-slate-400 text-[11px] font-medium">Supplier POs</div>
            <div className="text-slate-900 font-bold text-sm mt-0.5">1-Tap Reorder</div>
          </div>
        </div>
      </div>

      {/* Feature 2 (1 Col - WhatsApp & Invoicing Simulator) */}
      <div className="rounded-[2.5rem] bg-white/80 backdrop-blur-2xl border border-white/90 p-8 sm:p-9 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center mb-6 font-bold shadow-xs">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-bold uppercase tracking-wider mb-3 border border-teal-200">
            1-Tap WhatsApp
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3 tracking-tight">
            Send GST PDF bills straight to WhatsApp.
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            Save thermal paper costs! Send itemized GST invoices with your shop branding directly to your customer&apos;s phone.
          </p>
        </div>

        {/* Interactive WhatsApp Sender Simulator in Clean Light Style */}
        <form onSubmit={handleSendBill} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs space-y-2.5 shadow-xs">
          <div className="text-slate-600 font-medium text-[11px]">Test WhatsApp Delivery:</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              className="bg-white text-slate-900 px-3 py-2 rounded-xl border border-slate-200 w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="+91 Phone number"
            />
            <button
              type="submit"
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {billSent && (
            <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-[11px] font-medium flex items-center gap-1.5 border border-emerald-200 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> GST Invoice PDF sent to +91 {testNumber}!
            </div>
          )}
        </form>
      </div>

      {/* Feature 3 (1 Col - Thermal Receipt Printing) */}
      <div className="rounded-[2.5rem] bg-white/80 backdrop-blur-2xl border border-white/90 p-8 sm:p-9 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
        <div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-6 font-bold">
            <Printer className="w-6 h-6" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-800 text-xs font-bold uppercase tracking-wider mb-3 border border-amber-500/20">
            Thermal Printing
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3 tracking-tight">
            Instant 2-inch &amp; 3-inch ESC/POS receipts.
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed mb-4">
            Seamless USB, Bluetooth, and LAN thermal receipt printing formatted cleanly with itemized GST summaries.
          </p>

          {/* Visual Simulated Receipt Strip */}
          <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 font-mono text-[11px] text-slate-800 space-y-1 shadow-sm relative overflow-hidden">
            <div className="text-center font-bold border-b border-amber-200 pb-1">OBIX RETAIL STORE</div>
            <div className="flex justify-between pt-1"><span>Bill #1092</span><span>22/07/2026</span></div>
            <div className="flex justify-between"><span>1x Parle-G 100g</span><span>₹12.00</span></div>
            <div className="flex justify-between"><span>2x Amul Milk 1L</span><span>₹136.00</span></div>
            <div className="flex justify-between font-bold border-t border-amber-200 pt-1 text-xs"><span>TOTAL</span><span>₹148.00</span></div>

            {thermalPrinting && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-xs text-slate-900 p-3 flex flex-col items-center justify-center text-center animate-in fade-in border border-emerald-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-1" />
                <span className="font-bold text-slate-900">Printing 2-inch ESC/POS receipt...</span>
                <span className="text-[10px] text-slate-500 font-sans">USB &amp; Bluetooth Cut Signal Sent</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleTestPrint}
          className="mt-4 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
        >
          <Printer className="w-3.5 h-3.5 text-amber-400" /> Test Simulated Thermal Print
        </button>
      </div>

      {/* Feature 4 (Large - 2 Cols) */}
      <div className="md:col-span-2 rounded-[2.5rem] bg-white/80 backdrop-blur-2xl border border-white/90 p-8 sm:p-9 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
        <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-violet-500/10 text-violet-800 text-xs font-bold uppercase tracking-wider border border-violet-500/20">
              Role-Scoped Security
            </span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 tracking-tight">
            Keep sensitive financial reports private from the counter.
          </h3>
          <p className="text-slate-600 leading-relaxed max-w-xl text-sm sm:text-base mb-6">
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
                    ? 'bg-blue-600 text-white shadow-md font-bold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>

          {/* Dynamic Mini Role Wireframe */}
          <div className="mt-4 p-4 bg-slate-50 text-slate-800 rounded-2xl text-xs flex flex-col sm:flex-row justify-between sm:items-center gap-2 border border-slate-200/80 shadow-xs">
            <span className="text-blue-700 font-bold font-mono">
              ACTIVE SCOPE: {activeRole.toUpperCase()}
            </span>
            <span className="text-slate-600 text-[11px] font-medium">
              {activeRole === 'cashier'
                ? 'Access restricted to billing counter & barcode scan'
                : activeRole === 'cook'
                ? 'Access restricted to active KOT list & kitchen timers'
                : activeRole === 'waiter'
                ? 'Access restricted to dining floor plan & table punch'
                : 'Full admin access to P&L, stock, and staff management'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
