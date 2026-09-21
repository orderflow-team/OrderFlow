'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { ObixMark } from '@/components/obix-logo';

export type ObixAppScreen = 'dashboard' | 'orders' | 'billing' | 'inventory' | 'salesman';

export function ObixAppMockup({
  defaultScreen = 'dashboard',
  externalMode = 'pos',
  onModeChange,
}: {
  defaultScreen?: ObixAppScreen;
  externalMode?: 'pos' | 'voice' | 'whatsapp';
  onModeChange?: (mode: 'pos' | 'voice' | 'whatsapp') => void;
}) {
  const [activeScreen, setActiveScreen] = useState<ObixAppScreen>(defaultScreen);
  const [orderFilter, setOrderFilter] = useState<'all' | 'new' | 'unpaid' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewOrderSheet, setShowNewOrderSheet] = useState(false);
  const [invoiceDispatched, setInvoiceDispatched] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);

  // Sync external mode with screen
  useEffect(() => {
    if (externalMode === 'voice') {
      setActiveScreen('orders');
      setShowNewOrderSheet(true);
      setVoiceRecording(true);
    } else if (externalMode === 'whatsapp') {
      setActiveScreen('orders');
      setShowNewOrderSheet(false);
      setInvoiceDispatched(true);
    } else if (externalMode === 'pos') {
      setShowNewOrderSheet(false);
      setVoiceRecording(false);
      setInvoiceDispatched(false);
    }
  }, [externalMode]);

  // Real data faithfully matching live obix360.com production app
  const ordersList = [
    {
      id: 'ORD-1060',
      customer: 'Pravinbhai',
      creator: 'Neel Bhatt',
      date: '19 Sept 26',
      status: 'CONFIRMED',
      amount: '₹188.40',
      paymentState: 'unpaid',
    },
    {
      id: 'ORD-0721',
      customer: 'Walk-in Customer',
      creator: 'Neel Bhatt',
      date: '19 Sept 26',
      status: 'CONFIRMED',
      amount: '₹9.00',
      paymentState: 'unpaid',
    },
    {
      id: 'ORD-4821',
      customer: 'Walk-in Customer',
      creator: 'Neel Bhatt',
      date: '01 Sept 26',
      status: 'CONFIRMED',
      amount: '₹3566.24',
      paymentState: 'unpaid',
    },
    {
      id: 'ORD-1670',
      customer: 'Walk-in Customer',
      creator: 'Neel Bhatt',
      date: '01 Sept 26',
      status: 'CONFIRMED',
      amount: '₹0.00',
      paymentState: 'paid',
    },
  ];

  const filteredOrders = ordersList.filter((o) => {
    if (orderFilter === 'all') return true;
    return o.paymentState === orderFilter;
  });

  return (
    <div className="relative mx-auto w-full max-w-[360px] sm:max-w-[380px] rounded-[3.2rem] p-3 sm:p-3.5 bg-slate-900 shadow-2xl ring-1 ring-slate-800/90 backdrop-blur-xl">
      {/* Outer Phone Bezel & Screen */}
      <div className="relative rounded-[2.6rem] bg-slate-50 border border-slate-200/90 overflow-hidden shadow-inner flex flex-col h-[630px] sm:h-[650px] text-slate-800 select-none">
        
        {/* Native Mobile Status Bar with Dynamic Island */}
        <div className="pt-3 px-6 pb-2 flex items-center justify-between text-xs font-semibold text-slate-800 bg-white/80 backdrop-blur-md border-b border-slate-100 shrink-0">
          <span className="font-mono text-[11px] font-bold">9:41</span>
          
          {/* Dynamic Island / Speaker Pill */}
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

        {/* Mobile App Header (Matching obix360.com exactly) */}
        <div className="px-4 py-2 bg-gradient-to-r from-[#e0f7f2] via-[#e6f9f6] to-[#ebfbf8] border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-white shadow-2xs border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-900 shrink-0">
              <ObixMark className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1 text-xs font-extrabold text-slate-900 leading-none">
                <span>New medical</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
              <div className="text-[8px] font-bold text-teal-800 uppercase tracking-wider mt-0.5">
                Pharmacy • Owner
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

        {/* WhatsApp Invoice Real-Time Dispatch Toast */}
        {invoiceDispatched && (
          <div className="absolute top-16 inset-x-3 z-50 bg-emerald-950/95 text-white p-3 rounded-2xl shadow-xl border border-emerald-500/40 backdrop-blur-xl animate-in slide-in-from-top duration-300">
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

        {/* Main Content Area Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
          
          {/* ============================================================ */}
          {/* SCREEN 1: DASHBOARD (MOBILE VIEW) */}
          {/* ============================================================ */}
          {activeScreen === 'dashboard' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              
              {/* Lifetime Free Access Dark Purple Banner */}
              <div className="bg-[#1e1035] text-white p-3 rounded-2xl shadow-2xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-xs">
                    <Crown className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold flex items-center gap-1.5 leading-tight">
                      <span>Lifetime Free Access</span>
                      <span className="text-[8px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1 py-0.1 rounded">
                        Active
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-300">Billing and features unlocked</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-bold shadow-2xs">
                  Manage
                </span>
              </div>

              {/* 4 GIANT SIGNATURE PASTEL CATEGORY TILES (2x2 Grid from obix360.com) */}
              <div className="grid grid-cols-2 gap-2.5">
                
                {/* Tile 1: CLIENTS (Soft Peach) */}
                <div
                  onClick={() => { setActiveScreen('orders'); }}
                  className="bg-[#fed7aa]/75 hover:bg-[#fed7aa] p-3.5 rounded-3xl border border-orange-200 shadow-2xs flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95"
                >
                  <div className="w-9 h-9 rounded-2xl bg-white text-orange-600 shadow-2xs flex items-center justify-center mb-1.5">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-extrabold tracking-wider text-orange-950 uppercase">CLIENTS</span>
                </div>

                {/* Tile 2: MEDICINES (Soft Lilac) */}
                <div
                  onClick={() => { setActiveScreen('inventory'); }}
                  className="bg-[#e9d5ff]/75 hover:bg-[#e9d5ff] p-3.5 rounded-3xl border border-purple-200 shadow-2xs flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95"
                >
                  <div className="w-9 h-9 rounded-2xl bg-white text-purple-600 shadow-2xs flex items-center justify-center mb-1.5">
                    <Pill className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-extrabold tracking-wider text-purple-950 uppercase">MEDICINES</span>
                </div>

                {/* Tile 3: ORDERS (Soft Powder Blue) */}
                <div
                  onClick={() => { setActiveScreen('orders'); }}
                  className="bg-[#bae6fd]/75 hover:bg-[#bae6fd] p-3.5 rounded-3xl border border-sky-200 shadow-2xs flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95"
                >
                  <div className="w-9 h-9 rounded-2xl bg-white text-sky-600 shadow-2xs flex items-center justify-center mb-1.5">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-extrabold tracking-wider text-sky-950 uppercase">ORDERS</span>
                </div>

                {/* Tile 4: LEDGER (Soft Mint Green) */}
                <div
                  onClick={() => { setActiveScreen('billing'); }}
                  className="bg-[#bbf7d0]/75 hover:bg-[#bbf7d0] p-3.5 rounded-3xl border border-emerald-200 shadow-2xs flex flex-col items-center justify-center text-center cursor-pointer transition-all active:scale-95"
                >
                  <div className="w-9 h-9 rounded-2xl bg-white text-emerald-700 shadow-2xs flex items-center justify-center mb-1.5">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-extrabold tracking-wider text-emerald-950 uppercase">LEDGER</span>
                </div>

              </div>

              {/* 3 QUICK ACTION STRIPES WITH PROMINENT MIC / + BUTTONS */}
              <div className="space-y-2">
                
                {/* Stripe 1: New Order */}
                <div
                  onClick={() => { setActiveScreen('orders'); setShowNewOrderSheet(true); }}
                  className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between cursor-pointer hover:border-orange-300 transition-all active:scale-98"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-xs">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 leading-tight">New Order</div>
                      <div className="text-[9px] text-slate-400 uppercase font-semibold">Record a Sale</div>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-xs">
                    <Mic className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Stripe 2: Add Medicine */}
                <div
                  onClick={() => { setActiveScreen('inventory'); }}
                  className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between cursor-pointer hover:border-purple-300 transition-all active:scale-98"
                >
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

                {/* Stripe 3: Add Client */}
                <div
                  onClick={() => { setActiveScreen('orders'); setShowNewOrderSheet(true); }}
                  className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between cursor-pointer hover:border-blue-300 transition-all active:scale-98"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs">
                      <UserPlus className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 leading-tight">Add Client</div>
                      <div className="text-[9px] text-slate-400 uppercase font-semibold">Register Shop Owner</div>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Mic className="w-3.5 h-3.5" />
                  </div>
                </div>

              </div>

              {/* METRICS ROW (2x2 Grid matching obix360.com) */}
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
                    <div className="text-[10px] text-slate-500">Pending Payments</div>
                    <div className="text-sm font-extrabold text-rose-700 font-mono">₹4,245.48</div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                    <CreditCard className="w-3 h-3" />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* SCREEN 2: ORDERS (MOBILE VIEW matching obix360.com/orders) */}
          {/* ============================================================ */}
          {activeScreen === 'orders' && !showNewOrderSheet && (
            <div className="space-y-3 animate-in fade-in duration-200">
              
              {/* Header with New Order and AI Order Assistant */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 leading-tight">Orders</h3>
                  <p className="text-[10px] text-slate-500">Live Counter Bills</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewOrderSheet(true)}
                  className="px-3 py-1 bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> New Order
                </button>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer or Rx #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 text-xs rounded-xl bg-white border border-slate-200 shadow-2xs focus:outline-none font-medium"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
                {(['all', 'new', 'unpaid', 'paid'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setOrderFilter(filter)}
                    className={`px-3 py-0.5 rounded-full uppercase transition-all cursor-pointer ${
                      orderFilter === filter
                        ? 'bg-orange-500 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Orders Stream */}
              <div className="space-y-2">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#fed7aa] text-orange-950 flex items-center justify-center font-extrabold text-xs">
                          {order.customer[0]}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{order.customer}</div>
                          <div className="text-[9px] text-slate-400">{order.creator} • {order.date}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[8px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.2 rounded-full border border-blue-200">
                          {order.status}
                        </span>
                        <div className="text-xs font-extrabold text-orange-700 font-mono mt-0.5">
                          {order.amount}
                        </div>
                      </div>
                    </div>

                    {/* Segmented status pill selector */}
                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <div className="inline-flex bg-slate-100 p-0.5 rounded-lg font-semibold">
                        <span className="px-2 py-0.2 text-slate-500">NEW</span>
                        <span className="px-2 py-0.2 bg-orange-500 text-white rounded font-bold shadow-2xs">
                          ⚠️ UNPAID
                        </span>
                        <span className="px-2 py-0.2 text-slate-500">PAID</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInvoiceDispatched(true)}
                        className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer"
                      >
                        <Printer className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SCREEN 2-B: NEW ORDER DRAWER WITH VOICE SIMULATION */}
          {/* ============================================================ */}
          {activeScreen === 'orders' && showNewOrderSheet && (
            <div className="space-y-3 bg-white rounded-2xl p-3.5 border border-slate-200 shadow-md animate-in slide-in-from-bottom duration-200 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-extrabold text-xs text-slate-900">New Order &amp; WhatsApp Bill</span>
                <button
                  type="button"
                  onClick={() => setShowNewOrderSheet(false)}
                  className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              {/* Voice Listening Active Strip */}
              <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-200 flex items-center justify-between text-blue-900">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                  <span className="font-bold text-[10px]">AI Voice Transcribing:</span>
                </div>
                <span className="text-[9px] font-mono text-emerald-700 bg-white px-1.5 py-0.2 rounded border border-blue-200 font-bold">
                  99.2% Match
                </span>
              </div>
              <p className="text-slate-800 text-[11px] italic bg-slate-50 p-2 rounded-xl border border-slate-200">
                &ldquo;1 strip Dolo 650, 1 Benadryl syrup, aur 2 Tata salt add karo&rdquo;
              </p>

              {/* Parsed Items */}
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex justify-between bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                  <span>Dolo 650mg Tablet</span>
                  <span className="font-bold">₹34.00</span>
                </div>
                <div className="flex justify-between bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                  <span>Benadryl Syrup 100ml</span>
                  <span className="font-bold">₹125.00</span>
                </div>
                <div className="flex justify-between bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                  <span>Tata Salt 1kg</span>
                  <span className="font-bold">₹28.00</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-500 block">Total Due:</span>
                  <span className="text-sm font-extrabold text-slate-900 font-mono">₹187.00</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceDispatched(true);
                    setShowNewOrderSheet(false);
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <MessageSquare className="w-3 h-3" /> WhatsApp Bill
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SCREEN 3: INVENTORY (MOBILE VIEW) */}
          {/* ============================================================ */}
          {activeScreen === 'inventory' && (
            <div className="space-y-3 animate-in fade-in duration-200 text-xs">
              <h3 className="text-lg font-extrabold text-slate-900 leading-tight">Inventory &amp; Stock</h3>

              {/* OBIX Business Network Panel */}
              <div className="bg-white p-3 rounded-2xl border border-dashed border-sky-400/40 bg-sky-50/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                    <Link2 className="w-3.5 h-3.5 text-sky-600" /> OBIX Business Network
                  </span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    Linked
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex justify-between items-center text-[11px]">
                  <span className="font-semibold text-slate-800">Wholesale Depot</span>
                  <span className="text-[9px] text-slate-400 font-mono">Synced</span>
                </div>
              </div>

              {/* Low Stock Items */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Low Stock Items
                </span>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700">
                    <span>Vicks Vaporub 25g</span>
                    <span className="font-bold text-rose-600 font-mono">0 left</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700">
                    <span>Pantocid D SR Capsule</span>
                    <span className="font-bold text-rose-600 font-mono">0 left</span>
                  </div>
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>Fortune Refined Oil 1L</span>
                    <span className="font-bold text-rose-600 font-mono">0 left</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SCREEN 4: BILLING (MOBILE VIEW) */}
          {activeScreen === 'billing' && (
            <div className="space-y-3 animate-in fade-in duration-200 text-xs">
              <h3 className="text-lg font-extrabold text-slate-900 leading-tight">Billing &amp; Ledger</h3>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-2">
                <span className="font-bold text-emerald-800 text-xs flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5 text-emerald-600" /> Record a Payment
                </span>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Search customer..."
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                    defaultValue="Pravinbhai"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Amount"
                      className="w-1/2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold"
                      defaultValue="₹188.40"
                    />
                    <button
                      type="button"
                      onClick={() => setInvoiceDispatched(true)}
                      className="w-1/2 bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center cursor-pointer"
                    >
                      Record Cash
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SCREEN 5: FIELD MODE (MOBILE VIEW) */}
          {activeScreen === 'salesman' && (
            <div className="space-y-3 animate-in fade-in duration-200 text-xs">
              <h3 className="text-lg font-extrabold text-slate-900 leading-tight">Field Mode</h3>

              <div className="bg-white p-3 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Rajesh Kumar (Route #4)</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    GPS Live
                  </span>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="font-bold text-emerald-950 text-[10px]">Shree Ganesh Provision</div>
                  <div className="text-[9px] text-emerald-800 font-mono">10:42 AM Check-in Verified</div>
                </div>
                <div className="flex justify-between text-center pt-1 font-mono">
                  <div><span className="text-[9px] text-slate-400 block">Visits:</span><strong>14 / 18</strong></div>
                  <div><span className="text-[9px] text-slate-400 block">Orders:</span><strong className="text-emerald-700">₹78,400</strong></div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Floating Bottom-Left Floating + Button for Orders */}
        {activeScreen === 'orders' && !showNewOrderSheet && (
          <button
            type="button"
            onClick={() => setShowNewOrderSheet(true)}
            className="absolute bottom-16 left-4 z-40 w-11 h-11 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/40 cursor-pointer active:scale-95 transition-all"
            title="Create New Order"
          >
            <Plus className="w-6 h-6 stroke-[2.75]" />
          </button>
        )}

        {/* Floating Bottom-Right AI Assistant Button */}
        <button
          type="button"
          onClick={() => { setActiveScreen('orders'); setShowNewOrderSheet(true); }}
          className="absolute bottom-16 right-4 z-40 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-1.5 rounded-full shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 text-[11px] font-bold cursor-pointer active:scale-95 transition-all"
        >
          <Bot className="w-3.5 h-3.5" /> AI Assistant
        </button>

        {/* Bottom Mobile Navigation Bar (Matching real mobile app) */}
        <div className="bg-white border-t border-slate-200 px-2 py-2 flex items-center justify-around text-slate-500 text-[10px] shrink-0 font-bold select-none z-30">
          <button
            type="button"
            onClick={() => { setActiveScreen('dashboard'); setShowNewOrderSheet(false); }}
            className={`flex flex-col items-center gap-0.5 cursor-pointer ${
              activeScreen === 'dashboard' ? 'text-orange-600' : 'hover:text-slate-900'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveScreen('orders'); }}
            className={`flex flex-col items-center gap-0.5 cursor-pointer ${
              activeScreen === 'orders' ? 'text-orange-600' : 'hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Orders</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveScreen('billing'); }}
            className={`flex flex-col items-center gap-0.5 cursor-pointer ${
              activeScreen === 'billing' ? 'text-orange-600' : 'hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Billing</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveScreen('inventory'); }}
            className={`flex flex-col items-center gap-0.5 cursor-pointer ${
              activeScreen === 'inventory' ? 'text-orange-600' : 'hover:text-slate-900'
            }`}
          >
            <Warehouse className="w-4 h-4" />
            <span>Stock</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveScreen('salesman'); }}
            className={`flex flex-col items-center gap-0.5 cursor-pointer ${
              activeScreen === 'salesman' ? 'text-orange-600' : 'hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Field</span>
          </button>
        </div>

      </div>
    </div>
  );
}
