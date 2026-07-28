'use client';

import {
  Users,
  Package,
  ShoppingCart,
  Receipt,
  UserPlus,
  Store,
  PackagePlus,
  Banknote,
  UserCog,
  BarChart3,
  CheckCircle2,
  Printer,
  Mail,
  Sparkles,
  ShoppingBag,
  Building2,
  Pill,
  Check,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { ObixMark } from '@/components/obix-logo';

interface StepVisualizerProps {
  activeIndex: number;
}

const BRAND_TILES = [
  { icon: Users, bg: 'bg-rose-500/10 text-rose-600' },
  { icon: Package, bg: 'bg-purple-500/10 text-purple-600' },
  { icon: ShoppingCart, bg: 'bg-sky-500/10 text-sky-600' },
  { icon: Receipt, bg: 'bg-emerald-500/10 text-emerald-600' },
];

export function StepVisualizer({ activeIndex }: StepVisualizerProps) {
  return (
    <div className="w-full max-w-full rounded-[2.5rem] bg-white/40 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/60 p-6 sm:p-7 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),inset_0_-1px_1px_rgba(255,255,255,0.2),0_20px_45px_-15px_rgba(15,23,42,0.2)] transition-all duration-500 min-h-[480px] flex flex-col justify-between relative overflow-hidden">
      {/* Background Soft Glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-300/30 rounded-full blur-3xl pointer-events-none" />

      {/* Real App Window Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 relative z-10">
        <div className="flex items-center gap-3">
          <ObixMark className="w-9 h-9" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-800 tracking-tight">OBIX</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                LIVE APP PREVIEW
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              {activeIndex === 0
                ? 'obix.io/signup'
                : activeIndex === 1
                ? 'obix.io/select-business'
                : activeIndex === 2
                ? 'obix.io/products/new'
                : activeIndex === 3
                ? 'obix.io/counter/billing'
                : activeIndex === 4
                ? 'obix.io/staff/roles'
                : 'obix.io/dashboard'}
            </div>
          </div>
        </div>

        {/* Brand Icons Row */}
        <div className="hidden sm:flex items-center gap-1.5">
          {BRAND_TILES.map(({ icon: Icon, bg }, i) => (
            <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center ${bg} ring-1 ring-white/60`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
          ))}
        </div>
      </div>

      {/* Authentic App Screen Render */}
      <div className="py-4 relative z-10">
        {/* STEP 01: AUTHENTIC SIGNUP / LOGIN SCREEN */}
        {activeIndex === 0 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div>
              <h4 className="text-xl font-bold tracking-tight text-slate-900">Create account</h4>
              <p className="text-xs font-medium text-slate-600 mt-0.5">
                You&apos;ll set up your business workspace right after.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Full name</label>
                <div className="h-12 bg-white/60 backdrop-blur-md rounded-full px-4 text-xs font-medium text-slate-800 border border-white/80 ring-1 ring-slate-200/80 flex items-center">
                  Neel Sharma
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Email address</label>
                <div className="h-12 bg-white/60 backdrop-blur-md rounded-full px-4 text-xs font-medium text-slate-800 border border-white/80 ring-1 ring-slate-200/80 flex items-center justify-between">
                  <span>name@example.com</span>
                  <Mail className="w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Password / Email OTP</label>
                <div className="h-12 bg-white/60 backdrop-blur-md rounded-full px-4 text-xs font-medium text-slate-800 border border-white/80 ring-1 ring-slate-200/80 flex items-center">
                  ••••••••••••
                </div>
              </div>

              <div className="h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-full flex items-center justify-center gap-2 shadow-md transition-all">
                <span>Create Account</span> <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 02: AUTHENTIC SELECT BUSINESS SCREEN */}
        {activeIndex === 1 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div>
              <h4 className="text-xl font-bold tracking-tight text-slate-900">Add a new business</h4>
              <p className="text-xs font-medium text-slate-600 mt-0.5">
                Set up a workspace tailored to your category.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Business Name</label>
                <div className="h-12 bg-white/60 backdrop-blur-md rounded-full px-4 text-xs font-bold text-slate-900 border border-white/80 ring-1 ring-slate-200/80 flex items-center">
                  Radhe Supermarket
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Business Category</label>
                <div className="h-12 bg-white/60 backdrop-blur-md rounded-full px-4 text-xs font-bold text-emerald-900 border border-white/80 ring-1 ring-slate-200/80 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-emerald-600" /> Grocery Store
                  </span>
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
              </div>

              {/* Real Inventory Checkbox from select-business */}
              <div className="flex items-start gap-3 p-3.5 bg-white/50 backdrop-blur-md rounded-2xl border border-white/80 ring-1 ring-slate-200/80">
                <div className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0">
                  ✓
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-800 block">Enable Inventory Module</span>
                  <span className="text-[11px] text-slate-500 font-medium">Track stock, purchase orders, and low-stock alerts</span>
                </div>
              </div>

              <div className="h-12 bg-emerald-600 text-white font-bold text-xs rounded-full flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20">
                <span>Create Business Workspace</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 03: AUTHENTIC PRODUCT CATALOG ENTRY */}
        {activeIndex === 2 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div>
              <h4 className="text-xl font-bold tracking-tight text-slate-900">Add Product Catalog</h4>
              <p className="text-xs font-medium text-slate-600 mt-0.5">
                Set item pricing, HSN codes, and initial stock.
              </p>
            </div>

            <div className="p-4 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 ring-1 ring-slate-200/80 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                <div>
                  <div className="font-bold text-slate-900 text-sm">Parle-G Gold 100g</div>
                  <div className="text-[11px] text-slate-500 font-medium">Category: Biscuits &amp; Snacks</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-700 text-sm">₹12.00</div>
                  <div className="text-[10px] text-slate-400">HSN 1905 • GST 18%</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-medium">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">Opening Stock: 150 Bags</div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">Reorder Alert: &lt; 15 Bags</div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[11px] text-emerald-700 font-semibold">
                <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Barcode Scanned (#8901030)</span>
                <span className="px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-bold">+ Save Item</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 04: AUTHENTIC POS BILLING SCREEN */}
        {activeIndex === 3 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div>
              <h4 className="text-xl font-bold tracking-tight text-slate-900">Counter POS &amp; Billing</h4>
              <p className="text-xs font-medium text-slate-600 mt-0.5">
                Generate GST bills and share invoices with 1 tap.
              </p>
            </div>

            <div className="p-4 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 ring-1 ring-slate-200/80 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-800 font-medium">
                <span>10x Parle-G Gold 100g</span>
                <span className="font-bold">₹120.00</span>
              </div>
              <div className="flex justify-between items-center text-slate-800 font-medium">
                <span>2x Amul Taaza Milk 1L</span>
                <span className="font-bold">₹136.00</span>
              </div>

              <div className="pt-2 border-t border-slate-200/80 flex justify-between items-center font-bold text-slate-900 text-sm">
                <span>Total Net Bill</span>
                <span className="text-emerald-700 text-base">₹256.00</span>
              </div>

              <div className="pt-2 grid grid-cols-2 gap-2">
                <div className="py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-full flex items-center justify-center gap-1.5 shadow-sm">
                  <Printer className="w-3.5 h-3.5" /> Thermal Print
                </div>
                <div className="py-2.5 bg-slate-900 text-white font-bold text-xs rounded-full flex items-center justify-center gap-1.5 shadow-sm">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" /> Email Invoice
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 05: AUTHENTIC STAFF ROLES SCREEN */}
        {activeIndex === 5 ? null : activeIndex === 4 ? (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div>
              <h4 className="text-xl font-bold tracking-tight text-slate-900">Bring in your team</h4>
              <p className="text-xs font-medium text-slate-600 mt-0.5">
                Role-scoped logins so staff see only their job screen.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 ring-1 ring-slate-200/80 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-900">Rahul Sharma (Cashier)</div>
                  <div className="text-[11px] text-slate-500 font-medium">Scope: Counter POS &amp; Billing Only</div>
                </div>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>

              <div className="p-3 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 ring-1 ring-slate-200/80 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-900">Chef Suresh (Cook)</div>
                  <div className="text-[11px] text-slate-500 font-medium">Scope: Kitchen KOT Display Screen</div>
                </div>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
          </div>
        ) : null}

        {/* STEP 06: AUTHENTIC DASHBOARD ANALYTICS SCREEN */}
        {activeIndex === 5 && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div>
              <h4 className="text-xl font-bold tracking-tight text-slate-900">Watch it add up</h4>
              <p className="text-xs font-medium text-slate-600 mt-0.5">
                Live sales, stock turnover, and GST reports.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 ring-1 ring-slate-200/80 shadow-sm">
                <div className="text-slate-500 font-medium">Today&apos;s Sales</div>
                <div className="text-2xl font-bold text-emerald-700 mt-1">₹42,850</div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">+18% growth</div>
              </div>
              <div className="p-3.5 bg-white/60 backdrop-blur-md rounded-2xl border border-white/80 ring-1 ring-slate-200/80 shadow-sm">
                <div className="text-slate-500 font-medium">Total Orders</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">84</div>
                <div className="text-[10px] text-slate-400 font-normal mt-0.5">Counter #1</div>
              </div>
            </div>

            <div className="p-3 bg-emerald-500/15 backdrop-blur-md rounded-2xl border border-emerald-500/30 text-xs text-emerald-900 font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> GST Tax Report Ready
              </span>
              <span className="text-xs underline cursor-pointer">Export GSTR-1</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Step Progress Dots */}
      <div className="pt-4 border-t border-slate-200/80 flex justify-between items-center text-xs font-semibold text-slate-600 relative z-10">
        <span>Step {activeIndex + 1} of 6</span>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === activeIndex ? 'w-7 bg-emerald-600' : 'w-2 bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
