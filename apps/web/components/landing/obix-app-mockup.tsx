'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Home,
  Receipt,
  Package,
  BarChart3,
  Menu,
  TrendingUp,
  Search,
  CheckCircle2,
  Clock,
  ChevronRight,
  ScanBarcode,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  Sparkles,
  FileText,
  Users,
  DollarSign,
  Tag,
  Plus,
  Mic,
  MessageSquare,
  Phone,
  Send,
  X,
  UserPlus,
  PackagePlus,
  Check,
  Pill,
  UtensilsCrossed,
  Crown,
  Settings,
  ShieldCheck,
  MapPin,
  Warehouse,
  Link2,
  RefreshCw,
  AlertTriangle,
  IndianRupee,
  Bot,
  ChevronDown,
  Bell,
  Trash2,
  CreditCard,
  Building2,
  ShoppingCart,
  UserCheck,
  Play,
  Pause,
  Star,
  Calendar,
  ArrowLeft,
} from 'lucide-react';
import { ObixMark } from '@/components/obix-logo';

export type ObixAppScreen = 'dashboard' | 'orders' | 'billing' | 'inventory' | 'salesman' | 'clients';

// ─── Guided Demo Steps ───────────────────────────────────────────────────────
// Each step describes WHAT the mockup shows and how long to hold it (ms)
type DemoStep =
  | { type: 'dashboard'; highlight?: 'neworder' | 'clients' }
  | { type: 'orders_list' }
  | { type: 'new_order'; voicePhase: 0 | 1 | 2 }   // 0=empty, 1=listening, 2=parsed
  | { type: 'whatsapp_sent' }
  | { type: 'order_confirmed' }
  | { type: 'clients' };

// tapAt: % coords relative to phone screen (left%, top%) where the tap indicator appears
const DEMO_SEQUENCE: { step: DemoStep; duration: number; label: string; tapAt?: { x: number; y: number } }[] = [
  { step: { type: 'dashboard', highlight: 'neworder' },  duration: 3200, label: 'Dashboard',     tapAt: { x: 88, y: 71 } },  // mic button on New Order stripe
  { step: { type: 'orders_list' },                        duration: 3000, label: 'Orders',        tapAt: { x: 30, y: 97 } },  // Orders bottom nav tab
  { step: { type: 'new_order', voicePhase: 0 },           duration: 1600, label: 'New Order',     tapAt: { x: 50, y: 60 } },  // mic icon center
  { step: { type: 'new_order', voicePhase: 1 },           duration: 3200, label: 'Voice AI' },                                // no tap — AI is listening
  { step: { type: 'new_order', voicePhase: 2 },           duration: 3500, label: 'Items Parsed',  tapAt: { x: 76, y: 88 } },  // WhatsApp Bill button
  { step: { type: 'whatsapp_sent' },                      duration: 3500, label: 'WhatsApp Sent' },                           // no tap — toast result
  { step: { type: 'order_confirmed' },                    duration: 3200, label: 'Order Created' },                           // no tap — showing result
  { step: { type: 'dashboard', highlight: 'clients' },    duration: 2800, label: 'Dashboard',     tapAt: { x: 25, y: 48 } },  // CLIENTS tile
  { step: { type: 'clients' },                            duration: 4200, label: 'Customer View' },                           // no tap — viewing profile
];

export function ObixAppMockup({
  defaultScreen = 'dashboard',
  externalMode = 'pos',
  onModeChange,
}: {
  defaultScreen?: ObixAppScreen;
  externalMode?: 'pos' | 'voice' | 'whatsapp';
  onModeChange?: (mode: 'pos' | 'voice' | 'whatsapp') => void;
}) {
  // ── Auto-demo state ──────────────────────────────────────────────────────
  const [demoIndex, setDemoIndex]   = useState(0);
  const [isPlaying, setIsPlaying]   = useState(true);
  const [tapVisible, setTapVisible] = useState(false);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentDemoEntry = DEMO_SEQUENCE[demoIndex];
  const currentStep      = currentDemoEntry.step;

  // Derive UI state from demo step
  const activeScreen: ObixAppScreen =
    currentStep.type === 'dashboard'       ? 'dashboard'  :
    currentStep.type === 'orders_list'     ? 'orders'     :
    currentStep.type === 'new_order'       ? 'orders'     :
    currentStep.type === 'whatsapp_sent'   ? 'orders'     :
    currentStep.type === 'order_confirmed' ? 'orders'     :
    currentStep.type === 'clients'         ? 'clients'    : 'dashboard';

  const showNewOrderSheet =
    currentStep.type === 'new_order' || currentStep.type === 'whatsapp_sent';

  const invoiceDispatched = currentStep.type === 'whatsapp_sent';

  const voicePhase =
    currentStep.type === 'new_order' ? currentStep.voicePhase : 0;

  const dashboardHighlight =
    currentStep.type === 'dashboard' ? currentStep.highlight : undefined;

  // Auto-advance timer
  useEffect(() => {
    if (!isPlaying) return;
    timerRef.current = setTimeout(() => {
      setDemoIndex((i) => (i + 1) % DEMO_SEQUENCE.length);
    }, currentDemoEntry.duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [demoIndex, isPlaying, currentDemoEntry.duration]);

  // Show tap indicator when step changes (if step has a tapAt target)
  useEffect(() => {
    const entry = DEMO_SEQUENCE[demoIndex];
    if (!entry.tapAt) return;
    // Delay so screen has fully rendered before showing tap
    const showDelay = setTimeout(() => {
      setTapVisible(true);
      tapTimerRef.current = setTimeout(() => setTapVisible(false), 1100);
    }, 300);
    return () => {
      clearTimeout(showDelay);
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      setTapVisible(false);
    };
  }, [demoIndex]);

  // External mode override (from hero switcher buttons)
  useEffect(() => {
    if (externalMode === 'voice') {
      setIsPlaying(false);
      setDemoIndex(3); // voice phase 1
    } else if (externalMode === 'whatsapp') {
      setIsPlaying(false);
      setDemoIndex(5); // whatsapp sent
    } else if (externalMode === 'pos') {
      setIsPlaying(true);
      setDemoIndex(0);
    }
  }, [externalMode]);

  // ── Real data ────────────────────────────────────────────────────────────
  const ordersList = [
    { id: 'ORD-1060', customer: 'Pravinbhai',     date: '19 Sept', status: 'CONFIRMED', amount: '₹188.40', paymentState: 'unpaid' as const },
    { id: 'ORD-0721', customer: 'Walk-in',         date: '19 Sept', status: 'CONFIRMED', amount: '₹9.00',   paymentState: 'unpaid' as const },
    { id: 'ORD-4821', customer: 'Walk-in',         date: '01 Sept', status: 'CONFIRMED', amount: '₹3,566', paymentState: 'unpaid' as const },
    { id: 'ORD-1670', customer: 'Walk-in',         date: '01 Sept', status: 'CONFIRMED', amount: '₹0.00',  paymentState: 'paid'   as const },
  ];

  // New order that appears after confirmation
  const newOrder = { id: 'ORD-1061', customer: 'Ravi Mehta', date: 'Just now', status: 'CONFIRMED', amount: '₹187.00', paymentState: 'unpaid' as const, isNew: true };

  const displayOrders = currentStep.type === 'order_confirmed'
    ? [newOrder, ...ordersList]
    : ordersList;

  // Progress bar width (0–100)
  const progressPct = ((demoIndex) / DEMO_SEQUENCE.length) * 100;

  return (
    <div className="relative mx-auto w-full max-w-[360px] sm:max-w-[380px]">
      {/* ── Guided tour label ─────────────────────────────────────────────── */}
      <div className="absolute -top-10 left-0 right-0 flex items-center justify-between px-1 z-20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {DEMO_SEQUENCE.map((entry, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setDemoIndex(i); setIsPlaying(false); }}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  i === demoIndex ? 'w-6 bg-blue-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {currentDemoEntry.label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsPlaying((p) => !p)}
          className="w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          {isPlaying
            ? <Pause className="w-3 h-3" />
            : <Play  className="w-3 h-3 translate-x-px" />
          }
        </button>
      </div>

      {/* ── Phone bezel ───────────────────────────────────────────────────── */}
      <div className="relative rounded-[3.2rem] p-3 sm:p-3.5 bg-slate-900 shadow-2xl ring-1 ring-slate-800/90 backdrop-blur-xl">
        <div className="relative rounded-[2.6rem] bg-slate-50 border border-slate-200/90 overflow-hidden shadow-inner flex flex-col h-[630px] sm:h-[650px] text-slate-800 select-none">

          {/* Status Bar */}
          <div className="pt-3 px-6 pb-2 flex items-center justify-between text-xs font-semibold text-slate-800 bg-white/80 backdrop-blur-md border-b border-slate-100 shrink-0">
            <span className="font-mono text-[11px] font-bold">9:41</span>
            <div className="w-20 h-4 bg-slate-900 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-800 mr-2" />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span>5G</span>
              <div className="w-4 h-2 rounded-2xs border border-slate-800 p-0.5 flex items-center">
                <div className="h-full w-full bg-slate-800 rounded-3xs" />
              </div>
            </div>
          </div>

          {/* App Header */}
          <div className="px-4 py-2 bg-gradient-to-r from-[#e0f7f2] via-[#e6f9f6] to-[#ebfbf8] border-b border-slate-200/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {(currentStep.type === 'clients') ? (
                <button
                  type="button"
                  onClick={() => { setDemoIndex(0); setIsPlaying(true); }}
                  className="w-7 h-7 rounded-xl bg-white shadow-2xs border border-slate-200 flex items-center justify-center cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-700" />
                </button>
              ) : (
                <div className="w-7 h-7 rounded-xl bg-white shadow-2xs border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-900 shrink-0">
                  <ObixMark className="w-4 h-4" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-1 text-xs font-extrabold text-slate-900 leading-none">
                  <span>{currentStep.type === 'clients' ? 'Pravinbhai' : 'New medical'}</span>
                  {currentStep.type !== 'clients' && <ChevronDown className="w-3 h-3 text-slate-400" />}
                </div>
                <div className="text-[8px] font-bold text-teal-800 uppercase tracking-wider mt-0.5">
                  {currentStep.type === 'clients' ? 'Customer Profile' : 'Pharmacy • Owner'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative p-1">
                <Bell className="w-4 h-4 text-slate-600" />
                <span className="absolute -top-0.5 -right-1 w-3.5 h-3.5 bg-rose-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center">
                  20
                </span>
              </div>
            </div>
          </div>

          {/* WhatsApp Toast */}
          {invoiceDispatched && (
            <div className="absolute top-24 inset-x-3 z-50 bg-emerald-950/95 text-white p-3 rounded-2xl shadow-xl border border-emerald-500/40 backdrop-blur-xl animate-in slide-in-from-top duration-500">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-extrabold flex items-center justify-between">
                    <span className="text-emerald-400">WhatsApp PDF Dispatched</span>
                    <span className="text-[9px] text-slate-400 font-mono">Just now</span>
                  </div>
                  <p className="text-[10px] text-slate-200 truncate mt-0.5">
                    Tax invoice sent to +91 98765 43210 from store WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SCREEN: DASHBOARD                                           */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {activeScreen === 'dashboard' && (
              <div className="space-y-3.5 animate-in fade-in duration-500">

                {/* Crown Banner */}
                <div className="bg-[#1e1035] text-white p-3 rounded-2xl shadow-2xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-xs">
                      <Crown className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold flex items-center gap-1.5 leading-tight">
                        <span>Lifetime Free Access</span>
                        <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1 py-0.1 rounded">Active</span>
                      </div>
                      <div className="text-[9px] text-slate-300">Billing and features unlocked</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-bold shadow-2xs">Manage</span>
                </div>

                {/* 4 Pastel Tiles */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className={`bg-[#fed7aa]/75 p-3.5 rounded-3xl border shadow-2xs flex flex-col items-center justify-center text-center transition-all duration-300 ${
                    dashboardHighlight === 'clients' ? 'border-orange-400 scale-105 shadow-lg shadow-orange-200' : 'border-orange-200'
                  }`}>
                    <div className="w-9 h-9 rounded-2xl bg-white text-orange-600 shadow-2xs flex items-center justify-center mb-1.5">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-extrabold tracking-wider text-orange-950 uppercase">CLIENTS</span>
                    {dashboardHighlight === 'clients' && (
                      <span className="mt-1 text-[8px] bg-orange-500 text-white rounded-full px-1.5 py-0.5 font-bold animate-pulse">
                        Tap →
                      </span>
                    )}
                  </div>

                  <div className="bg-[#e9d5ff]/75 p-3.5 rounded-3xl border border-purple-200 shadow-2xs flex flex-col items-center justify-center text-center">
                    <div className="w-9 h-9 rounded-2xl bg-white text-purple-600 shadow-2xs flex items-center justify-center mb-1.5">
                      <Pill className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-extrabold tracking-wider text-purple-950 uppercase">MEDICINES</span>
                  </div>

                  <div className="bg-[#bae6fd]/75 p-3.5 rounded-3xl border border-sky-200 shadow-2xs flex flex-col items-center justify-center text-center">
                    <div className="w-9 h-9 rounded-2xl bg-white text-sky-600 shadow-2xs flex items-center justify-center mb-1.5">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-extrabold tracking-wider text-sky-950 uppercase">ORDERS</span>
                  </div>

                  <div className="bg-[#bbf7d0]/75 p-3.5 rounded-3xl border border-emerald-200 shadow-2xs flex flex-col items-center justify-center text-center">
                    <div className="w-9 h-9 rounded-2xl bg-white text-emerald-700 shadow-2xs flex items-center justify-center mb-1.5">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-extrabold tracking-wider text-emerald-950 uppercase">LEDGER</span>
                  </div>
                </div>

                {/* Quick Action Stripes */}
                <div className="space-y-2">
                  <div className={`bg-white p-2.5 rounded-2xl border shadow-2xs flex items-center justify-between transition-all duration-300 ${
                    dashboardHighlight === 'neworder' ? 'border-orange-400 shadow-lg shadow-orange-100 scale-[1.02]' : 'border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-xs">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 leading-tight">New Order</div>
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">Record a Sale</div>
                      </div>
                    </div>
                    <div className={`w-7 h-7 rounded-full text-white flex items-center justify-center shadow-xs transition-all duration-300 ${
                      dashboardHighlight === 'neworder' ? 'bg-orange-500 animate-pulse scale-110' : 'bg-orange-500'
                    }`}>
                      <Mic className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                        <Pill className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 leading-tight">Add Medicine</div>
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">Add to Pharmacy Stock</div>
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Mic className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500">Today&apos;s Sales</div>
                      <div className="text-sm font-extrabold text-slate-900 font-mono">₹197.40</div>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <IndianRupee className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500">Pending</div>
                      <div className="text-sm font-extrabold text-rose-700 font-mono">₹4,245</div>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                      <CreditCard className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SCREEN: ORDERS LIST                                         */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {activeScreen === 'orders' && !showNewOrderSheet && (
              <div className="space-y-3 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 leading-tight">Orders</h3>
                    <p className="text-[10px] text-slate-500">Live Counter Bills</p>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1 bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Order
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <div className="w-full pl-8 pr-2 py-1.5 text-xs rounded-xl bg-white border border-slate-200 shadow-2xs font-medium text-slate-400">
                    Search customer or Rx #...
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pb-1 text-[11px] font-bold">
                  {(['all', 'unpaid', 'paid'] as const).map((f) => (
                    <span key={f} className={`px-3 py-0.5 rounded-full uppercase ${f === 'all' ? 'bg-orange-500 text-white shadow-2xs' : 'bg-white text-slate-600 border border-slate-200'}`}>
                      {f}
                    </span>
                  ))}
                </div>

                <div className="space-y-2">
                  {displayOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`bg-white p-3 rounded-2xl border shadow-2xs space-y-2 transition-all duration-500 ${
                        'isNew' in order && order.isNew ? 'border-emerald-400 ring-1 ring-emerald-300 animate-in slide-in-from-top duration-700' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#fed7aa] text-orange-950 flex items-center justify-center font-extrabold text-xs">
                            {order.customer[0]}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                              {order.customer}
                              {(order as { isNew?: boolean }).isNew === true && (
                                <span className="text-[8px] bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-1.5 py-0.2 font-extrabold">NEW</span>
                              )}
                            </div>
                            <div className="text-[9px] text-slate-400">{order.date}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.2 rounded-full border border-blue-200">{order.status}</span>
                          <div className="text-xs font-extrabold text-orange-700 font-mono mt-0.5">{order.amount}</div>
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg font-semibold">
                          <span className="px-2 py-0.2 text-slate-500">NEW</span>
                          <span className={`px-2 py-0.2 rounded font-bold shadow-2xs ${order.paymentState === 'unpaid' ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {order.paymentState === 'unpaid' ? '⚠️ UNPAID' : 'PAID'}
                          </span>
                          <span className={`px-2 py-0.2 rounded font-bold shadow-2xs ${order.paymentState === 'paid' ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}>
                            PAID
                          </span>
                        </div>
                        <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                          <Printer className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SCREEN: NEW ORDER SHEET (Voice phases 0-2)                  */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {activeScreen === 'orders' && showNewOrderSheet && (
              <div className="space-y-3 bg-white rounded-2xl p-3.5 border border-slate-200 shadow-md animate-in slide-in-from-bottom duration-500 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-extrabold text-xs text-slate-900">New Order &amp; WhatsApp Bill</span>
                  <div className="flex items-center gap-2">
                    {/* Step indicator */}
                    <div className="flex items-center gap-1">
                      {[0,1,2].map((ph) => (
                        <div key={ph} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${voicePhase >= ph ? 'bg-blue-500' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
                      <X className="w-3 h-3" />
                    </div>
                  </div>
                </div>

                {/* Phase 0: Empty form */}
                {voicePhase === 0 && (
                  <div className="space-y-2.5">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-[10px] text-slate-400 font-semibold mb-1">Customer</div>
                      <div className="text-xs text-slate-300 italic">Tap mic to speak or type...</div>
                    </div>
                    <div className="flex items-center justify-center py-4">
                      <div className="w-12 h-12 rounded-full bg-orange-50 border-2 border-orange-200 flex items-center justify-center">
                        <Mic className="w-5 h-5 text-orange-400" />
                      </div>
                    </div>
                    <p className="text-center text-[10px] text-slate-400">Say your order — Voice AI will parse items</p>
                  </div>
                )}

                {/* Phase 1: AI Listening */}
                {voicePhase === 1 && (
                  <div className="space-y-2.5">
                    <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-200 flex items-center justify-between text-blue-900">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                        <span className="font-bold text-[10px]">AI Voice Listening...</span>
                      </div>
                      <span className="text-[9px] font-mono text-emerald-700 bg-white px-1.5 py-0.2 rounded border border-blue-200 font-bold">Live</span>
                    </div>

                    {/* Animated waveform */}
                    <div className="flex items-center justify-center gap-0.5 py-3">
                      {[3,5,8,6,9,7,4,8,5,6,9,4,7,5,8].map((h, i) => (
                        <div
                          key={i}
                          className="w-1 rounded-full bg-blue-400"
                          style={{
                            height: `${h * 2}px`,
                            animation: `voiceBar 0.6s ease-in-out ${i * 0.05}s infinite alternate`,
                            opacity: 0.7 + (h / 9) * 0.3,
                          }}
                        />
                      ))}
                    </div>

                    <p className="text-slate-600 text-[11px] italic bg-slate-50 p-2 rounded-xl border border-slate-200 leading-relaxed">
                      &ldquo;1 strip Dolo 650, 1 Benadryl syrup, aur 2 Tata salt...&rdquo;
                    </p>
                    <div className="flex justify-center">
                      <div className="text-[9px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-full border border-blue-200 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        Transcribing in real-time
                      </div>
                    </div>
                  </div>
                )}

                {/* Phase 2: Items Parsed */}
                {voicePhase === 2 && (
                  <div className="space-y-2.5">
                    <div className="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={3} />
                        <span className="font-bold text-[10px] text-emerald-800">AI Parsed — 3 Items</span>
                      </div>
                      <span className="text-[9px] font-mono text-emerald-700 bg-white px-1.5 py-0.2 rounded border border-emerald-200 font-bold">99.2% Match</span>
                    </div>

                    <p className="text-slate-600 text-[11px] italic bg-slate-50 p-2 rounded-xl border border-slate-200">
                      &ldquo;1 strip Dolo 650, 1 Benadryl syrup, aur 2 Tata salt add karo&rdquo;
                    </p>

                    <div className="space-y-1 font-mono text-[11px]">
                      {[
                        { name: 'Dolo 650mg Tablet', price: '₹34.00' },
                        { name: 'Benadryl Syrup 100ml', price: '₹125.00' },
                        { name: 'Tata Salt 1kg ×2', price: '₹28.00' },
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between bg-slate-50 p-1.5 rounded-lg border border-slate-200 animate-in fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                          <span className="text-slate-700">{item.name}</span>
                          <span className="font-bold text-slate-900">{item.price}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-slate-500 block">Total Due:</span>
                        <span className="text-sm font-extrabold text-slate-900 font-mono">₹187.00</span>
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" /> WhatsApp Bill
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* SCREEN: CLIENTS / CUSTOMER PROFILE                          */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {activeScreen === 'clients' && (
              <div className="space-y-3 animate-in fade-in duration-500 text-xs">

                {/* Customer Card */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-md flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#fed7aa] text-orange-950 flex items-center justify-center font-extrabold text-xl shrink-0">
                    P
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-slate-900 text-sm">Pravinbhai</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5" /> +91 98765 43210
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[8px] bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-1.5 py-0.3 font-bold">Regular Customer</span>
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map(s => <Star key={s} className="w-2 h-2 fill-amber-400 text-amber-400" />)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ledger Summary */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs text-center">
                    <div className="text-[9px] text-slate-400 font-semibold uppercase">Total Orders</div>
                    <div className="text-lg font-extrabold text-slate-900 font-mono">14</div>
                    <div className="text-[8px] text-slate-400">Since Jan 2026</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-2xl border border-rose-200 shadow-2xs text-center">
                    <div className="text-[9px] text-rose-500 font-semibold uppercase">Outstanding</div>
                    <div className="text-lg font-extrabold text-rose-700 font-mono">₹376</div>
                    <div className="text-[8px] text-slate-400">2 unpaid orders</div>
                  </div>
                </div>

                {/* Order History */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-[11px]">Recent Orders</span>
                    <span className="text-[9px] text-blue-600 font-bold">View all</span>
                  </div>
                  {[
                    { id: 'ORD-1061', amount: '₹187.00', date: 'Just now',  paid: false, isNew: true },
                    { id: 'ORD-1060', amount: '₹188.40', date: '19 Sept',   paid: false },
                    { id: 'ORD-0812', amount: '₹540.00', date: '12 Sept',   paid: true },
                  ].map((order) => (
                    <div key={order.id} className={`flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 ${order.isNew ? 'animate-in fade-in duration-700' : ''}`}>
                      <div>
                        <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                          {order.id}
                          {order.isNew && <span className="text-[7px] bg-emerald-100 text-emerald-700 rounded-full px-1 font-extrabold">NEW</span>}
                        </div>
                        <div className="text-[9px] text-slate-400">{order.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-extrabold text-slate-900 font-mono">{order.amount}</div>
                        <span className={`text-[8px] font-bold px-1.5 rounded-full ${order.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {order.paid ? 'PAID' : 'UNPAID'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* WhatsApp quick action */}
                <button
                  type="button"
                  className="w-full py-2.5 bg-[#25D366] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Send Payment Reminder on WhatsApp
                </button>
              </div>
            )}

          </div>

          {/* Floating FAB */}
          {activeScreen === 'orders' && !showNewOrderSheet && (
            <button
              type="button"
              className="absolute bottom-16 left-4 z-40 w-11 h-11 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/40 transition-all"
            >
              <Plus className="w-6 h-6 stroke-[2.75]" />
            </button>
          )}

          {/* AI Assistant FAB */}
          <button
            type="button"
            className="absolute bottom-16 right-4 z-40 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-1.5 rounded-full shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 text-[11px] font-bold transition-all"
          >
            <Bot className="w-3.5 h-3.5" /> AI Assistant
          </button>

          {/* Bottom Nav */}
          <div className="bg-white border-t border-slate-200 px-2 py-2 flex items-center justify-around text-slate-500 text-[10px] shrink-0 font-bold select-none z-30">
            {([
              { screen: 'dashboard', icon: Home,         label: 'Home'   },
              { screen: 'orders',    icon: ShoppingCart, label: 'Orders' },
              { screen: 'billing',   icon: Receipt,      label: 'Billing'},
              { screen: 'inventory', icon: Warehouse,    label: 'Stock'  },
              { screen: 'clients',   icon: Users,        label: 'Clients'},
            ] as const).map(({ screen, icon: Icon, label }) => (
              <button
                key={screen}
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setDemoIndex(DEMO_SEQUENCE.findIndex(e => e.step.type === screen || (screen === 'orders' && e.step.type === 'orders_list')) || 0);
                }}
                className={`flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
                  (screen === 'orders' && (activeScreen === 'orders')) ||
                  (screen === activeScreen)
                    ? 'text-orange-600' : 'hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* ── Tap pointer indicator ──────────────────────────────────── */}
          {tapVisible && DEMO_SEQUENCE[demoIndex].tapAt && (
            <div
              className="pointer-events-none absolute z-[60]"
              style={{
                left:      `${DEMO_SEQUENCE[demoIndex].tapAt!.x}%`,
                top:       `${DEMO_SEQUENCE[demoIndex].tapAt!.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Outer ripple ring 1 */}
              <div
                className="absolute rounded-full bg-blue-400/25 border border-blue-400/40"
                style={{
                  width: 48, height: 48,
                  top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  animation: 'tapRippleOuter 1.0s ease-out forwards',
                }}
              />
              {/* Inner ripple ring 2 */}
              <div
                className="absolute rounded-full bg-blue-500/20"
                style={{
                  width: 32, height: 32,
                  top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  animation: 'tapRippleInner 1.0s ease-out forwards',
                }}
              />
              {/* Touch dot */}
              <div
                className="relative w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-xl shadow-blue-600/50 flex items-center justify-center"
                style={{ animation: 'tapDot 1.0s ease-out forwards' }}
              >
                {/* Glossy inner shine */}
                <div className="w-1.5 h-1.5 rounded-full bg-white/70" />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Waveform + tap animation keyframes */}
      <style>{`
        @keyframes voiceBar {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1);   }
        }
        @keyframes tapDot {
          0%   { transform: scale(1.3);  opacity: 0.5; }
          25%  { transform: scale(0.8);  opacity: 1;   }
          65%  { transform: scale(1.05); opacity: 0.9; }
          100% { transform: scale(1);   opacity: 0.6; }
        }
        @keyframes tapRippleOuter {
          0%   { transform: translate(-50%,-50%) scale(0.3); opacity: 0.7; }
          100% { transform: translate(-50%,-50%) scale(2.0); opacity: 0;   }
        }
        @keyframes tapRippleInner {
          0%   { transform: translate(-50%,-50%) scale(0.2); opacity: 0.5; }
          60%  { transform: translate(-50%,-50%) scale(1.3); opacity: 0.2; }
          100% { transform: translate(-50%,-50%) scale(1.6); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}
