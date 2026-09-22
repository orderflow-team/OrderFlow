'use client';

import { useState } from 'react';
import {
  Mic,
  Sparkles,
  MessageSquare,
  FileText,
  CheckCircle2,
  ArrowRight,
  Send,
  Zap,
  Volume2,
  Store,
  Pill,
  UtensilsCrossed,
  ScanText,
  Wifi,
  WifiOff,
  RefreshCw,
  Printer,
  QrCode,
  ShieldCheck,
  Check,
  Play,
  Share2,
  Layers,
  ArrowDownRight,
  Smartphone,
  Laptop,
  Network,
  Link2,
  Truck,
  Boxes,
  Warehouse,
  MapPin,
  UserCheck,
  Repeat,
  Building2,
  Search,
  ShoppingCart,
  AlertTriangle,
  IndianRupee,
  Clock,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react';
import { Reveal } from './reveal';

interface VoicePreset {
  id: string;
  category: 'grocery' | 'restaurant' | 'pharmacy' | 'regional';
  label: string;
  dialect: string;
  icon: any;
  spokenText: string;
  parsedItems: { name: string; qty: number; unitPrice: number; hsn: string; gst: number; batch?: string }[];
}

const VOICE_PRESETS: VoicePreset[] = [
  {
    id: 'preset-grocery',
    category: 'grocery',
    label: 'Kirana / Grocery',
    dialect: 'Hinglish (Hindi + English)',
    icon: Store,
    spokenText: 'Do packet Maggi, ek kilo Aashirvaad aata, aur do pouch Amul milk add karo',
    parsedItems: [
      { name: 'Maggi 2-Min Noodles 70g', qty: 2, unitPrice: 14, hsn: '1902', gst: 12 },
      { name: 'Aashirvaad Shudh Chakki Atta 1kg', qty: 1, unitPrice: 58, hsn: '1101', gst: 5 },
      { name: 'Amul Taaza Toned Milk 500ml', qty: 2, unitPrice: 27, hsn: '0401', gst: 0 },
    ],
  },
  {
    id: 'preset-pharmacy',
    category: 'pharmacy',
    label: 'Pharmacy / Rx',
    dialect: 'Medical & Brand Slang',
    icon: Pill,
    spokenText: '1 strip Dolo 650, 1 bottle Benadryl syrup, aur 10 tablet Azithral 500',
    parsedItems: [
      { name: 'Dolo 650mg Tablet (Strip of 15)', qty: 1, unitPrice: 34, hsn: '3004', gst: 12, batch: 'CR2024A' },
      { name: 'Benadryl Cough Syrup 100ml', qty: 1, unitPrice: 125, hsn: '3004', gst: 12, batch: 'BN8821' },
      { name: 'Azithral 500mg (Sched H1)', qty: 1, unitPrice: 119, hsn: '3004', gst: 12, batch: 'AZ500B' },
    ],
  },
  {
    id: 'preset-restaurant',
    category: 'restaurant',
    label: 'Restaurant / Cafe',
    dialect: 'KOT & Table Speech',
    icon: UtensilsCrossed,
    spokenText: 'Table 4 ke liye 2 Masala Dosa, 1 Filter Coffee, aur 1 Paneer Tikka parcel',
    parsedItems: [
      { name: 'Crispy Butter Masala Dosa', qty: 2, unitPrice: 110, hsn: '9963', gst: 5 },
      { name: 'Special Madras Filter Coffee', qty: 1, unitPrice: 45, hsn: '9963', gst: 5 },
      { name: 'Tandoori Paneer Tikka (Parcel)', qty: 1, unitPrice: 220, hsn: '9963', gst: 5 },
    ],
  },
  {
    id: 'preset-regional',
    category: 'regional',
    label: 'Regional Dialect',
    dialect: 'Gujarati / Hindi Mix',
    icon: Sparkles,
    spokenText: 'Bhai 2 kilo Basmati chokha, 1 liter Singtel tel, ane 500 gram jaggery nakhi dyo',
    parsedItems: [
      { name: 'Fortune Basmati Rice 1kg', qty: 2, unitPrice: 95, hsn: '1006', gst: 5 },
      { name: 'Tirupati Singtel Groundnut Oil 1L', qty: 1, unitPrice: 185, hsn: '1508', gst: 5 },
      { name: 'Kolhapur Organic Jaggery 500g', qty: 1, unitPrice: 42, hsn: '1701', gst: 5 },
    ],
  },
];

interface WhatsAppScenario {
  id: string;
  customerName: string;
  phone: string;
  category: string;
  incomingMessage: string;
  parsedSummary: {
    items: { name: string; qty: string; price: number }[];
    total: number;
    pdfName: string;
  };
}

const WHATSAPP_SCENARIOS: WhatsAppScenario[] = [
  {
    id: 'kirana-order',
    customerName: 'Pravinbhai Patel',
    phone: '+91 98765 43210',
    category: 'Kirana Order',
    incomingMessage: 'Bhaiya 1 pouch Fortune Sunflower Oil 1L aur 2 packet Tata Salt urgent bhej do ghar pe',
    parsedSummary: {
      items: [
        { name: 'Fortune Refined Sunflower 1L', qty: '1 Pouch', price: 145 },
        { name: 'Tata Salt Vacuum Evaporated 1kg', qty: '2 Pkts', price: 56 },
      ],
      total: 201,
      pdfName: 'Invoice_OBX-1048.pdf',
    },
  },
  {
    id: 'pharmacy-order',
    customerName: 'Dr. Ramesh Sharma',
    phone: '+91 98200 55432',
    category: 'Pharmacy Rx List',
    incomingMessage: 'Please send Dolo 650 2 strips, Combiflam 1 strip, and Volini spray 50g to clinic address',
    parsedSummary: {
      items: [
        { name: 'Dolo 650mg (Strip of 15)', qty: '2 Strips', price: 68 },
        { name: 'Combiflam Tablet (Strip of 20)', qty: '1 Strip', price: 46 },
        { name: 'Volini Pain Relief Spray 50g', qty: '1 Can', price: 175 },
      ],
      total: 289,
      pdfName: 'Rx_Invoice_MED-482.pdf',
    },
  },
  {
    id: 'restaurant-parcel',
    customerName: 'Ananya Roy',
    phone: '+91 99341 88123',
    category: 'Cafe Takeaway',
    incomingMessage: '2 Paneer Kathi Roll, 1 Cold Coffee with icecream, parcel pack for 8:30 PM pickup please',
    parsedSummary: {
      items: [
        { name: 'Paneer Tikka Kathi Roll', qty: '2 Rolls', price: 240 },
        { name: 'Cold Coffee with Ice Cream', qty: '1 Glass', price: 110 },
      ],
      total: 350,
      pdfName: 'KOT_Parcel_772.pdf',
    },
  },
];

export function KillerFeaturesShowcase() {
  // ⭐ OBIX Connect Ecosystem State
  const [connectFlow, setConnectFlow] = useState<'auto_po' | 'salesman' | 'pricing'>('auto_po');
  const [connectSimulating, setConnectSimulating] = useState(false);
  const [connectNotification, setConnectNotification] = useState<string | null>(
    'Low stock alert! PO #OBX-4091 auto-sent to Anand FMCG Wholesale Depot'
  );

  // Voice feature state
  const [activeVoicePreset, setActiveVoicePreset] = useState<VoicePreset>(VOICE_PRESETS[0]);
  const [isSimulatingVoice, setIsSimulatingVoice] = useState(false);
  const [voiceSpoken, setVoiceSpoken] = useState(VOICE_PRESETS[0].spokenText);
  const [receiptPrinted, setReceiptPrinted] = useState(false);

  // WhatsApp feature state
  const [activeWaScenario, setActiveWaScenario] = useState<WhatsAppScenario>(WHATSAPP_SCENARIOS[0]);
  const [isExtractingChat, setIsExtractingChat] = useState(false);
  const [replySent, setReplySent] = useState(true);

  // OCR Bill Scanner State
  const [ocrSample, setOcrSample] = useState<'pharma' | 'fmcg'>('pharma');

  // Offline Sync State
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'local_cached' | 'syncing'>('synced');

  const handleSimulateConnect = (flow: 'auto_po' | 'salesman' | 'pricing') => {
    setConnectFlow(flow);
    setConnectSimulating(true);
    setConnectNotification(null);
    setTimeout(() => {
      setConnectSimulating(false);
      if (flow === 'auto_po') {
        setConnectNotification('✓ PO #OBX-4091 accepted by Distributor. Stock dispatch ready for delivery!');
      } else if (flow === 'salesman') {
        setConnectNotification('✓ Field Salesman Vikram logged visit at Shreeji Mart. 20 Cartons order landed in Central Dispatch queue with GPS tag.');
      } else {
        setConnectNotification('✓ Wholesaler updated VIP Dealer rate. Pravin Kirana POS counter immediately shows net buying price ₹112/unit (+26% margin).');
      }
    }, 700);
  };

  const handleVoiceSimulate = (preset: VoicePreset) => {
    setActiveVoicePreset(preset);
    setIsSimulatingVoice(true);
    setVoiceSpoken(preset.spokenText);
    setReceiptPrinted(false);
    setTimeout(() => {
      setIsSimulatingVoice(false);
    }, 750);
  };

  const handleExtractChat = () => {
    setIsExtractingChat(true);
    setReplySent(false);
    setTimeout(() => {
      setIsExtractingChat(false);
      setReplySent(true);
    }, 600);
  };

  const handleToggleOffline = () => {
    if (!isOfflineMode) {
      setIsOfflineMode(true);
      setSyncStatus('local_cached');
    } else {
      setIsOfflineMode(false);
      setSyncStatus('syncing');
      setTimeout(() => {
        setSyncStatus('synced');
      }, 900);
    }
  };

  const calculateVoiceTotal = (items: VoicePreset['parsedItems']) => {
    const subtotal = items.reduce((acc, it) => acc + it.qty * it.unitPrice, 0);
    const tax = items.reduce((acc, it) => acc + (it.qty * it.unitPrice * it.gst) / 100, 0);
    return { subtotal, tax, total: subtotal + tax };
  };

  const voiceTotals = calculateVoiceTotal(activeVoicePreset.parsedItems);

  return (
    <section id="exclusive-features" className="py-24 max-w-[100rem] mx-auto px-6 sm:px-10 relative">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75vw] h-[75vw] max-w-[65rem] max-h-[65rem] rounded-full bg-gradient-to-tr from-blue-400/15 via-emerald-400/15 to-violet-400/15 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16 relative z-10">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-600/10 via-emerald-600/10 to-violet-600/10 border border-emerald-500/30 text-emerald-800 text-xs font-black uppercase tracking-wider shadow-sm mb-4">
            <Zap className="w-4 h-4 text-emerald-600" /> Exclusive to OBIX — Industry First
          </div>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.08]">
            The killer features <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
              no other billing software offers.
            </span>
          </h2>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-5 text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Traditional POS systems isolate your shop. OBIX introduces <strong>OBIX Connect</strong> — linking your counter
            live with distributors, salesmen fleets, voice AI, and automated customer WhatsApp invoices.
          </p>
        </Reveal>
      </div>

      <div className="space-y-10 relative z-10">
        
        {/* ============================================================ */}
        {/* ⭐ CROWN JEWEL: OBIX CONNECT — THE CONNECTED COMMERCE ECOSYSTEM (12 COLS) */}
        {/* ============================================================ */}
        <Reveal>
          <div className="rounded-[2.5rem] bg-white/95 backdrop-blur-2xl text-slate-900 p-6 sm:p-10 shadow-2xl border border-slate-200/90 relative overflow-hidden group">
            {/* Ambient glows */}
            <div className="absolute top-0 right-0 w-[35rem] h-[35rem] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-[30rem] h-[30rem] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              {/* Header Badge, Title & Live Telemetry Panel */}
              <div className="grid lg:grid-cols-12 gap-8 items-start mb-8">
                {/* Left Side: Title, Badges, Copy & Interactive Flow Switcher */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-blue-500/25 ring-2 ring-blue-100 shrink-0">
                      <Network className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono tracking-widest text-sky-700 font-extrabold uppercase">
                          ⭐ The Best of OBIX • Flagship Ecosystem
                        </span>
                        <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded-full border border-sky-200">
                          Zero Middlemen
                        </span>
                      </div>
                      <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 mt-1">
                        OBIX Connect — The Connected B2B Commerce Ecosystem
                      </h3>
                    </div>
                  </div>

                  <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                    Retail shops and wholesale distributors spend hours every day on messy WhatsApp chats, lost phone calls,
                    and manual purchase orders. <strong>OBIX Connect</strong> bridges them into one unified, real-time supply chain:
                    when retail shelf stock drops, purchase orders auto-dispatch to the distributor, prices stay synced live, and salesmen
                    field bookings appear instantly on central depot dispatch screens.
                  </p>

                  {/* Interactive Flow Switcher Tabs */}
                  <div className="pt-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
                      Select a live workflow to test OBIX Connect in action:
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleSimulateConnect('auto_po')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          connectFlow === 'auto_po'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 scale-[1.01]'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                        }`}
                      >
                        <Boxes className="w-4 h-4" />
                        <span>1. Retail POS ➔ Wholesaler Auto-PO</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSimulateConnect('salesman')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          connectFlow === 'salesman'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 scale-[1.01]'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                        }`}
                      >
                        <Truck className="w-4 h-4" />
                        <span>2. Field Salesman Fleet &amp; Route Sync</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSimulateConnect('pricing')}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                          connectFlow === 'pricing'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 scale-[1.01]'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                        }`}
                      >
                        <Repeat className="w-4 h-4" />
                        <span>3. Live B2B Tiered Rates &amp; Udhar Ledger</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Side: Live Ecosystem Telemetry & Core Impact Card (Fills previously empty space) */}
                <div className="lg:col-span-5 xl:col-span-4 bg-gradient-to-br from-slate-50/90 via-sky-50/50 to-blue-50/30 rounded-2xl border border-sky-200/80 p-5 shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      Live Ecosystem Telemetry
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      &lt; 15ms SYNC
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 bg-white/90 backdrop-blur-xs rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-semibold text-slate-500 block">Auto-PO Speed</span>
                      <span className="text-sm font-extrabold text-blue-600 font-mono">Instant</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">POS ➔ Depot direct</span>
                    </div>

                    <div className="p-3 bg-white/90 backdrop-blur-xs rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-semibold text-slate-500 block">Order Errors</span>
                      <span className="text-sm font-extrabold text-emerald-600 font-mono">0%</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">No WhatsApp mistakes</span>
                    </div>

                    <div className="p-3 bg-white/90 backdrop-blur-xs rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-semibold text-slate-500 block">Salesmen Fleet</span>
                      <span className="text-sm font-extrabold text-indigo-600 font-mono">Live Route</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">App booking sync</span>
                    </div>

                    <div className="p-3 bg-white/90 backdrop-blur-xs rounded-xl border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] font-semibold text-slate-500 block">B2B Ledger</span>
                      <span className="text-sm font-extrabold text-purple-600 font-mono">Real-Time</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Auto Udhar balance</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-700 bg-white/95 p-2.5 rounded-xl border border-sky-200/80 flex items-center justify-between shadow-2xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Two-Way GST &amp; HSN Auto-Match
                    </span>
                    <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Realistic Software Canvas: Authentic OBIX App UI Side-by-Side */}
              <div className="bg-slate-100/80 rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-inner relative overflow-hidden">
                
                {/* FLOW 1: RETAILER AUTO-PO TO WHOLESALER */}
                {connectFlow === 'auto_po' && (
                  <div className="grid lg:grid-cols-11 gap-4 items-center">
                    
                    {/* LEFT APP WINDOW: REAL RETAIL POS COUNTER */}
                    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs">
                      {/* Window title bar */}
                      <div className="bg-slate-50 border-b border-slate-200 px-3.5 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          <span className="font-semibold text-slate-700 text-[11px] ml-1">
                            OBIX POS — Pravin Kirana (Counter #1)
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                        </span>
                      </div>

                      {/* Store sub-bar */}
                      <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4 text-blue-600" />
                          <span className="font-bold text-slate-900 text-[11px]">Station Road Store</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">Cashier: Rahul S.</span>
                      </div>

                      {/* Cart Table with Low Stock Trigger */}
                      <div className="p-3 space-y-2">
                        <div className="flex justify-between text-[10px] text-slate-400 uppercase font-semibold border-b border-slate-100 pb-1">
                          <span>Item Name</span>
                          <span>Subtotal</span>
                        </div>

                        {/* Item 1: Triggers Auto-PO */}
                        <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">Fortune Sunflower Oil 1L</span>
                            <span className="font-bold font-mono text-slate-900">₹290.00</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span>Qty: 2 Pkts × ₹145.00</span>
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                              Shelf Stock: 2 left (Min: 5)
                            </span>
                          </div>
                          {/* In-App Auto-PO Trigger Badge */}
                          <div className="text-[10px] text-blue-700 bg-blue-50/90 px-2 py-1 rounded-lg font-semibold flex items-center gap-1.5 border border-blue-200/70">
                            <Zap className="w-3 h-3 text-blue-600 shrink-0" />
                            <span>OBIX Connect auto-dispatched PO #PO-4091 to Anand Depot</span>
                          </div>
                        </div>

                        {/* Item 2 */}
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-800">Tata Salt Vacuum Evaporated 1kg</div>
                            <div className="text-[10px] text-slate-500">Qty: 5 Pkts × ₹28.00</div>
                          </div>
                          <span className="font-bold font-mono text-slate-900">₹140.00</span>
                        </div>

                        {/* Item 3 */}
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-800">Aashirvaad Shudh Chakki Atta 5kg</div>
                            <div className="text-[10px] text-slate-500">Qty: 1 Bag × ₹245.00</div>
                          </div>
                          <span className="font-bold font-mono text-slate-900">₹245.00</span>
                        </div>
                      </div>

                      {/* POS Cart Footer */}
                      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Total Due (Incl. GST)</span>
                          <span className="text-base font-extrabold text-slate-900 font-mono">₹675.00</span>
                        </div>
                        <div className="flex gap-1.5">
                          <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[10px]">
                            F8 Cash
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> F9 WhatsApp
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* CENTER INTERACTIVE PIPE */}
                    <div className="lg:col-span-1 flex flex-col items-center justify-center py-2 text-center">
                      <div className="w-full flex items-center justify-center gap-1 my-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                        <div className="h-0.5 flex-1 bg-gradient-to-r from-blue-600 via-sky-400 to-indigo-600 relative overflow-hidden">
                          <div className="absolute inset-0 bg-white/80 w-1/3 animate-[slide-in-from-left_1.2s_infinite]" />
                        </div>
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping [animation-delay:200ms]" />
                      </div>
                      <div className="bg-white px-2 py-1 rounded-lg border border-slate-300 text-[10px] font-mono text-blue-700 font-bold shadow-2xs">
                        {connectSimulating ? 'Syncing...' : 'PO Auto-Pipe'}
                      </div>
                    </div>

                    {/* RIGHT APP WINDOW: REAL WHOLESALER DISPATCH CONSOLE */}
                    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs">
                      {/* Window title bar */}
                      <div className="bg-slate-50 border-b border-slate-200 px-3.5 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          <span className="font-semibold text-slate-700 text-[11px] ml-1">
                            OBIX Wholesale Hub — Anand FMCG Depot
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                          APMC Yard Depot
                        </span>
                      </div>

                      {/* Business Connections Header (Real Component Layout) */}
                      <div className="p-3 border-b border-slate-100 bg-sky-50/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-sky-600" />
                          <div>
                            <span className="font-bold text-slate-900 text-[11px] block">OBIX Business Network</span>
                            <span className="text-[10px] text-slate-500">48 Retailers Linked</span>
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                          Pravin Kirana Linked ✓
                        </span>
                      </div>

                      {/* Incoming Auto-PO Card in Dispatch Queue */}
                      <div className="p-3 space-y-2.5">
                        <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                              <Boxes className="w-3.5 h-3.5 text-blue-600" />
                              Incoming Auto-PO #PO-4091
                            </span>
                            <span className="text-[9px] bg-blue-600 text-white font-mono px-1.5 py-0.2 rounded font-bold">
                              Just Now
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-700 space-y-1">
                            <div className="flex justify-between">
                              <span>25x Fortune Sunflower Oil 1L (Wholesale @ ₹128/unit)</span>
                              <span className="font-mono font-bold text-slate-900">₹3,200.00</span>
                            </div>
                            <div className="flex justify-between">
                              <span>50x Tata Salt 1kg (Wholesale @ ₹22/unit)</span>
                              <span className="font-mono font-bold text-slate-900">₹1,100.00</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-blue-200/80 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Total PO Value (30-Day Udhar)</span>
                              <span className="text-sm font-extrabold text-blue-900 font-mono">₹4,300.00</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSimulateConnect('auto_po')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Accept &amp; Dispatch
                            </button>
                          </div>
                        </div>

                        {/* Credit Status Card */}
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Pravin Kirana Credit Standing:</span>
                            <span className="font-semibold text-slate-800">₹1,85,000 / ₹2,50,000 Limit Available</span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Good Rating ★★★★★
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* FLOW 2: FIELD SALESMAN ROUTE TO DEPOT DISPATCH */}
                {connectFlow === 'salesman' && (
                  <div className="grid lg:grid-cols-11 gap-4 items-center">
                    
                    {/* LEFT: FIELD SALESMAN MOBILE APP (Real UI from /salesman) */}
                    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs">
                      {/* Phone top bar */}
                      <div className="bg-slate-900 text-white px-3.5 py-1.5 flex items-center justify-between text-[10px] font-mono">
                        <span>9:41 AM</span>
                        <div className="flex items-center gap-1.5">
                          <span>5G</span>
                          <span className="w-4 h-2 rounded-xs border border-white/60 relative">
                            <span className="absolute inset-0.5 bg-emerald-400 rounded-2xs" />
                          </span>
                        </div>
                      </div>

                      {/* Salesman Profile Bar */}
                      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                            V
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-[11px]">Vikram Sharma</span>
                            <span className="text-[10px] text-slate-500">Route: Station Road Market</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                          Shop 7 of 18
                        </span>
                      </div>

                      {/* GPS Check-in Card (Faithfully matches /salesman) */}
                      <div className="p-3 space-y-2.5">
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-emerald-600" />
                            <div>
                              <span className="font-bold text-emerald-950 text-[11px] block">
                                Geo-Verified Visit: Shreeji Mart
                              </span>
                              <span className="text-[10px] text-emerald-800 font-mono">
                                23.0225° N, 72.5714° E (Accuracy: 3m)
                              </span>
                            </div>
                          </div>
                          <span className="text-[9px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded">
                            Verified ✓
                          </span>
                        </div>

                        {/* Order Taking Form */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">On-Site Order Pad</span>
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                            <div>
                              <div className="font-semibold text-slate-800">Parle-G 250g Carton (20 pkts)</div>
                              <div className="text-[10px] text-slate-500">5 Cartons × ₹480/carton</div>
                            </div>
                            <span className="font-mono font-bold text-slate-900">₹2,400.00</span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                            <div>
                              <div className="font-semibold text-slate-800">Frooti 200ml Tetrapack (Tray of 30)</div>
                              <div className="text-[10px] text-slate-500">4 Trays × ₹450/tray</div>
                            </div>
                            <span className="font-mono font-bold text-slate-900">₹1,800.00</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSimulateConnect('salesman')}
                          className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" /> Book Order &amp; Push to Depot Dispatch
                        </button>
                      </div>
                    </div>

                    {/* CENTER INTERACTIVE PIPE */}
                    <div className="lg:col-span-1 flex flex-col items-center justify-center py-2 text-center">
                      <div className="w-full flex items-center justify-center gap-1 my-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <div className="h-0.5 flex-1 bg-gradient-to-r from-emerald-500 to-blue-600" />
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                      </div>
                      <div className="bg-white px-2 py-1 rounded-lg border border-slate-300 text-[10px] font-mono text-emerald-700 font-bold shadow-2xs">
                        GPS &amp; Route Sync
                      </div>
                    </div>

                    {/* RIGHT: CENTRAL DEPOT DISPATCH SCREEN */}
                    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs">
                      <div className="bg-slate-50 border-b border-slate-200 px-3.5 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          <span className="font-semibold text-slate-700 text-[11px] ml-1">
                            Anand Depot — Dispatch Board
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                          Fleet Live
                        </span>
                      </div>

                      <div className="p-3 space-y-3">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-blue-600" />
                              Order #SO-8821 from Salesman Vikram
                            </span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                              Landed in Dispatch
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-600 space-y-1">
                            <div className="flex justify-between">
                              <span>Customer: Shreeji Mart (Station Road)</span>
                              <span className="font-mono font-bold text-slate-900">₹4,200.00</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Assigned to Delivery Van #4 (Depot Departure: 2:00 PM)
                            </div>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/80 text-[11px] text-blue-900 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>Zero lost orders. Salesman booking hits warehouse packing screens within 100ms.</span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* FLOW 3: LIVE B2B TIERED RATES & MIRRORED UDHAR LEDGER */}
                {connectFlow === 'pricing' && (
                  <div className="grid lg:grid-cols-11 gap-4 items-center">
                    
                    {/* LEFT: RETAILER POS BUYING RATE & MARGIN VIEW */}
                    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs">
                      <div className="bg-slate-50 border-b border-slate-200 px-3.5 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          <span className="font-semibold text-slate-700 text-[11px] ml-1">
                            Pravin Kirana — Live Margin Monitor
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                          Tier A Discount
                        </span>
                      </div>

                      <div className="p-3.5 space-y-3">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900 text-sm">Fortune Sunflower Oil 1L</span>
                            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                              +29.5% Net Margin
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[10px] text-slate-400 block">Selling Price (MRP):</span>
                              <span className="font-bold text-slate-800 font-mono">₹145.00</span>
                            </div>
                            <div className="bg-white p-2 rounded-lg border border-slate-200">
                              <span className="text-[10px] text-slate-400 block">Net Buying Rate:</span>
                              <span className="font-bold text-emerald-700 font-mono">₹112.00 / unit</span>
                            </div>
                          </div>
                        </div>

                        {/* Mirrored Udhar Dues */}
                        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-amber-800 font-semibold block">Udhar Due to Anand Depot</span>
                            <span className="text-base font-extrabold text-amber-950 font-mono">₹42,500.00</span>
                          </div>
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-2 py-1 rounded-lg">
                            Due in 18 Days
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* CENTER INTERACTIVE PIPE */}
                    <div className="lg:col-span-1 flex flex-col items-center justify-center py-2 text-center">
                      <div className="w-full flex items-center justify-center gap-1 my-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        <div className="h-0.5 flex-1 bg-gradient-to-r from-amber-500 to-indigo-600" />
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                      </div>
                      <div className="bg-white px-2 py-1 rounded-lg border border-slate-300 text-[10px] font-mono text-amber-700 font-bold shadow-2xs">
                        Mirrored Dues
                      </div>
                    </div>

                    {/* RIGHT: WHOLESALER TIER & LEDGER CONSOLE */}
                    <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs">
                      <div className="bg-slate-50 border-b border-slate-200 px-3.5 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          <span className="font-semibold text-slate-700 text-[11px] ml-1">
                            Anand Depot — Dealer Accounts
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                          Zero Dispute
                        </span>
                      </div>

                      <div className="p-3.5 space-y-3">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900">Dealer: Pravin Kirana</span>
                            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                              Tier A (Net -8%)
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Mirrored Udhar Receivable:</span>
                              <span className="text-base font-extrabold text-slate-900 font-mono">₹42,500.00</span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                              Matches Retailer 100% ✓
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSimulateConnect('pricing')}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Ledger
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSimulateConnect('pricing')}
                            className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] border border-slate-200 cursor-pointer"
                          >
                            Adjust Credit Line
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* Live Event Notification Banner */}
                {connectNotification && (
                  <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{connectNotification}</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-mono bg-white px-2 py-0.5 rounded border border-emerald-300">
                      Live Packet Logged
                    </span>
                  </div>
                )}
              </div>

              {/* 4 Feature Pillars of OBIX Connect (Clean White App Cards) */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-200 text-xs">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5 hover:border-blue-300 transition-colors">
                  <div className="text-blue-700 font-bold flex items-center gap-1.5 text-sm">
                    <Check className="w-4 h-4 text-blue-600" /> 100% Zero Manual POs
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Retail counters never run dry. Low-stock triggers electronic PO straight to distributor dispatch screens.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5 hover:border-blue-300 transition-colors">
                  <div className="text-blue-700 font-bold flex items-center gap-1.5 text-sm">
                    <Check className="w-4 h-4 text-blue-600" /> GPS-Tracked Salesman App
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Salesmen on field routes book shop orders on their phones with verified geo-location tagging.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5 hover:border-blue-300 transition-colors">
                  <div className="text-blue-700 font-bold flex items-center gap-1.5 text-sm">
                    <Check className="w-4 h-4 text-blue-600" /> Mirrored Udhar Ledgers
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Both retailer and wholesaler see the exact same invoice dues. Zero disputed claims or missed payments.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5 hover:border-blue-300 transition-colors">
                  <div className="text-blue-700 font-bold flex items-center gap-1.5 text-sm">
                    <Check className="w-4 h-4 text-blue-600" /> Dynamic Dealer Tier Rates
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Wholesalers set custom discounts per retailer; rates sync in real-time right to the retail billing screen.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </Reveal>

        {/* ============================================================ */}
        {/* ROW 2: AI VOICE-TO-BILL ENGINE (7 COLS) & WHATSAPP AUTOMATION (5 COLS) */}
        {/* ============================================================ */}
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* KILLER FEATURE: MULTILINGUAL AI VOICE COUNTER (7 COLS) */}
          <Reveal className="lg:col-span-7 flex flex-col">
            <div className="flex-1 rounded-[2.5rem] bg-white/90 backdrop-blur-2xl p-7 sm:p-9 shadow-xl border border-white/90 relative overflow-hidden flex flex-col justify-between group">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold shadow-xs border border-blue-500/20">
                      <Mic className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono tracking-widest text-blue-600 font-bold uppercase block">
                        AI Voice-to-Bill Engine
                      </span>
                      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                        Speak in Hinglish. Bill in 1 Second.
                      </h3>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" /> Real-time Speech AI
                  </span>
                </div>

                <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6 max-w-xl">
                  No typing, no searching codes during peak counter rush. Hold your counter mic and speak items naturally
                  in Hindi, Hinglish, or regional dialects. OBIX matches inventory, applies GST, and prepares the invoice
                  instantaneously.
                </p>

                {/* Interactive Preset Dialect Buttons */}
                <div className="space-y-2 mb-5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Click a dialect sample to test live counter recognition:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {VOICE_PRESETS.map((preset) => {
                      const Icon = preset.icon;
                      const isSelected = activeVoicePreset.id === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleVoiceSimulate(preset)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/25 scale-[1.02]'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 border border-slate-200/80'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Spoken Audio Simulation Strip with Live Waveform */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-xs mb-5">
                  <div className="flex items-center justify-between text-slate-500 pb-2 mb-2 border-b border-slate-200">
                    <span className="flex items-center gap-2 text-blue-600 font-semibold">
                      <Volume2 className="w-4 h-4" /> Spoken Counter Audio ({activeVoicePreset.dialect})
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                      {isSimulatingVoice ? 'Transcribing...' : '99.2% Phonetic Match'}
                    </span>
                  </div>
                  <div className="text-slate-800 text-sm italic font-medium flex items-center gap-3">
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="w-1 h-3 bg-blue-600 rounded-full animate-pulse" />
                      <span className="w-1 h-6 bg-blue-600 rounded-full animate-pulse [animation-delay:120ms]" />
                      <span className="w-1 h-4 bg-blue-600 rounded-full animate-pulse [animation-delay:240ms]" />
                      <span className="w-1 h-7 bg-blue-600 rounded-full animate-pulse [animation-delay:80ms]" />
                      <span className="w-1 h-3 bg-blue-600 rounded-full animate-pulse [animation-delay:180ms]" />
                    </div>
                    <span className="text-slate-900 font-semibold">&ldquo;{voiceSpoken}&rdquo;</span>
                  </div>
                </div>

                {/* Live Parsed POS Cart Table */}
                <div className="bg-slate-50/90 rounded-2xl p-4 sm:p-5 border border-slate-200/80 text-xs">
                  <div className="flex items-center justify-between text-slate-500 border-b border-slate-200 pb-2 mb-3 font-semibold text-[11px]">
                    <span>AI-MATCHED ITEMS IN CART</span>
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> READY FOR INSTANT PRINT
                    </span>
                  </div>
                  <div className="space-y-2">
                    {activeVoicePreset.parsedItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200/70 text-slate-800 shadow-2xs hover:border-blue-300 transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{item.name}</span>
                            {item.batch && (
                              <span className="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200 font-mono">
                                Batch {item.batch}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {item.qty} × ₹{item.unitPrice.toFixed(2)} • HSN {item.hsn} • GST {item.gst}%
                          </div>
                        </div>
                        <div className="text-slate-900 font-extrabold text-sm font-mono">
                          ₹{(item.qty * item.unitPrice).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Subtotal & Action Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 text-[11px] block font-medium">Net Payable (Incl. Tax)</span>
                      <span className="text-xl font-extrabold text-slate-900 font-mono">₹{voiceTotals.total.toFixed(2)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptPrinted(true);
                        setTimeout(() => setReceiptPrinted(false), 3000);
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      {receiptPrinted ? 'Printed to 3" ESC/POS!' : 'Generate Thermal Receipt'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Understands Indian shop slang, abbreviations &amp; brands
                </span>
                <span className="text-slate-400 font-medium">Under 200ms Latency</span>
              </div>
            </div>
          </Reveal>

          {/* KILLER FEATURE: WHATSAPP CHAT-TO-INVOICE & DISPATCH (5 COLS) */}
          <Reveal delay={120} className="lg:col-span-5 flex flex-col">
            <div className="flex-1 rounded-[2.5rem] bg-white/90 backdrop-blur-2xl border border-white/90 p-7 sm:p-9 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
              <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center font-bold shadow-xs border border-emerald-500/20">
                    <MessageSquare className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono tracking-widest text-emerald-700 font-bold uppercase block">
                      WhatsApp Automation
                    </span>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900">Chat to Instant Tax Invoice</h3>
                  </div>
                </div>

                <p className="text-slate-600 text-sm leading-relaxed mb-5">
                  Customers send messy WhatsApp order texts. Stop manual re-entry. OBIX extracts items in 1 click and
                  automatically returns an official GST PDF bill with UPI QR code to the customer&apos;s chat.
                </p>

                {/* Scenario Switcher Tabs */}
                <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
                  {WHATSAPP_SCENARIOS.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => {
                        setActiveWaScenario(sc);
                        setReplySent(true);
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        activeWaScenario.id === sc.id
                          ? 'bg-emerald-600 text-white font-bold shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/80'
                      }`}
                    >
                      {sc.category}
                    </button>
                  ))}
                </div>

                {/* Simulated Dual-Message WhatsApp Chat Thread */}
                <div className="bg-[#efeae2] rounded-2xl p-4 border border-slate-200/80 space-y-3 mb-5 shadow-inner">
                  {/* Chat Contact Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-300/60 text-xs font-semibold text-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                        {activeWaScenario.customerName[0]}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block leading-tight">{activeWaScenario.customerName}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{activeWaScenario.phone}</span>
                      </div>
                    </div>
                    <span className="text-emerald-700 font-bold text-[10px] bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                      Verified Store Bot
                    </span>
                  </div>

                  {/* 1. Customer's Raw Incoming Order Message */}
                  <div className="bg-white border border-slate-200 text-slate-800 p-3 rounded-2xl rounded-tl-xs text-xs leading-relaxed shadow-2xs max-w-[90%]">
                    <p className="font-medium text-slate-900">&ldquo;{activeWaScenario.incomingMessage}&rdquo;</p>
                    <div className="text-[10px] text-slate-400 font-mono text-right mt-1">11:42 AM • Sent by customer</div>
                  </div>

                  {/* 2. Store's Automatic Response with Itemized PDF Invoice */}
                  {replySent && (
                    <div className="bg-[#d9fdd3] border border-emerald-300/70 text-slate-900 p-3.5 rounded-2xl rounded-tr-xs text-xs leading-relaxed shadow-2xs ml-auto max-w-[95%] space-y-2 animate-in fade-in duration-200">
                      <p className="text-[11px] font-bold text-emerald-950">
                        ✓ Order Confirmed! Tax Invoice attached below:
                      </p>
                      
                      {/* Item list */}
                      <div className="bg-white/80 p-2 rounded-xl text-[11px] space-y-1 font-mono">
                        {activeWaScenario.parsedSummary.items.map((it, i) => (
                          <div key={i} className="flex justify-between text-slate-700">
                            <span>{it.qty} {it.name}</span>
                            <span className="font-bold text-slate-900">₹{it.price.toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="pt-1 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                          <span>Total Due:</span>
                          <span className="text-emerald-700">₹{activeWaScenario.parsedSummary.total.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* PDF Attachment Pill */}
                      <div className="bg-white p-2 rounded-xl border border-emerald-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-[10px]">
                            PDF
                          </div>
                          <div className="text-[10px] font-bold text-slate-800">
                            <div>{activeWaScenario.parsedSummary.pdfName}</div>
                            <div className="text-slate-400 font-normal">GST Invoice • 142 KB</div>
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                          Auto-Sent
                        </span>
                      </div>

                      <div className="text-[10px] text-emerald-800 font-mono text-right flex items-center justify-end gap-1">
                        <span>11:42 AM</span>
                        <span className="text-blue-500 font-bold">✓✓ Read</span>
                      </div>
                    </div>
                  )}

                  {/* Interactive Action Button */}
                  <button
                    type="button"
                    onClick={handleExtractChat}
                    disabled={isExtractingChat}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <Sparkles className={`w-4 h-4 ${isExtractingChat ? 'animate-spin' : ''}`} />
                    {isExtractingChat ? 'Extracting & Generating PDF...' : 'Re-extract Message to Bill (Test)'}
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                <span>Sends directly from store&apos;s own business WhatsApp number</span>
                <span className="text-emerald-700 font-bold font-mono">100% Automated</span>
              </div>
            </div>
          </Reveal>

        </div>

        {/* ============================================================ */}
        {/* ROW 3: AI DISTRIBUTOR BILL OCR (6 COLS) & ZERO-DOWNTIME OFFLINE MESH (6 COLS) */}
        {/* ============================================================ */}
        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* KILLER FEATURE: AI PURCHASE INVOICE SCANNER (OCR) (6 COLS) */}
          <Reveal delay={180} className="lg:col-span-6 flex flex-col">
            <div className="flex-1 rounded-[2.5rem] bg-white/90 backdrop-blur-2xl border border-white/90 p-7 sm:p-9 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-violet-500/15 text-violet-700 flex items-center justify-center font-bold shadow-xs border border-violet-500/20">
                    <ScanText className="w-6 h-6 text-violet-600" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono tracking-widest text-violet-700 font-bold uppercase block">
                      AI Vision OCR Engine
                    </span>
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900">Distributor Bill Auto-Scan</h3>
                  </div>
                </div>

                <p className="text-slate-600 text-sm leading-relaxed mb-5">
                  Entering 50-item distributor bills manually takes 45 minutes. Snap a photo of any wholesale paper invoice
                  — OBIX extracts supplier GSTIN, HSN codes, batch numbers, expiry dates, and wholesale costs in 3 seconds.
                </p>

                {/* Sample Switcher */}
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setOcrSample('pharma')}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      ocrSample === 'pharma'
                        ? 'bg-violet-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Pharma Wholesale (Cipla / SunPharma)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOcrSample('fmcg')}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      ocrSample === 'fmcg'
                        ? 'bg-violet-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    FMCG Distributor (Metro / Anand)
                  </button>
                </div>

                {/* Interactive Laser Scan Preview */}
                <div className="bg-slate-50/95 rounded-2xl p-5 border border-slate-200/80 text-xs space-y-3.5 shadow-xs relative overflow-hidden">
                  {/* Clean Top Accent Rim */}
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500" />

                  {/* Laser Scan Beam across invoice items below header */}
                  <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes invoice-laser-scan {
                      0% { top: 3.25rem; opacity: 0; }
                      15% { opacity: 0.85; }
                      85% { opacity: 0.85; }
                      100% { top: calc(100% - 2.5rem); opacity: 0; }
                    }
                    .animate-invoice-laser-scan {
                      animation: invoice-laser-scan 3.5s ease-in-out infinite;
                    }
                  `}} />
                  <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-violet-500 to-transparent shadow-[0_0_8px_rgba(139,92,246,0.6)] animate-invoice-laser-scan pointer-events-none" />

                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 relative z-10">
                    <span className="text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      {ocrSample === 'pharma' ? 'DISTRIBUTOR: CIPLA PHARMA LTD' : 'DISTRIBUTOR: METRO CASH & CARRY'}
                    </span>
                    <span className="text-violet-700 font-bold bg-violet-50 px-2 py-0.5 rounded border border-violet-200 text-[10px] flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI VISION PARSED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                      <span className="text-slate-400 block text-[10px]">Supplier GSTIN:</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {ocrSample === 'pharma' ? '24AABCC1234D1Z8' : '27AAACM1234F1Z5'}
                      </span>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                      <span className="text-slate-400 block text-[10px]">Margin Profit Detected:</span>
                      <span className="font-bold text-emerald-700 font-mono">+32.4% Avg Margin</span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/70 space-y-2 text-[11px] shadow-2xs">
                    {ocrSample === 'pharma' ? (
                      <>
                        <div className="flex justify-between text-slate-800 font-medium">
                          <span>Dolo 650 (Batch DL82)</span>
                          <span className="text-emerald-700 font-semibold font-mono">Exp: 09/2028 • Cost: ₹23.50 (MRP ₹34)</span>
                        </div>
                        <div className="flex justify-between text-slate-800 font-medium">
                          <span>Azithral 500 (Batch AZ19)</span>
                          <span className="text-emerald-700 font-semibold font-mono">Exp: 06/2027 • Cost: ₹84.00 (MRP ₹119)</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between text-slate-800 font-medium">
                          <span>Fortune Oil 1L (Batch B2409)</span>
                          <span className="text-emerald-700 font-semibold font-mono">Exp: 04/2027 • Cost: ₹112 (MRP ₹145)</span>
                        </div>
                        <div className="flex justify-between text-slate-800 font-medium">
                          <span>Parle-G 100g (Batch P049)</span>
                          <span className="text-emerald-700 font-semibold font-mono">Exp: 08/2027 • Cost: ₹8.40 (MRP ₹10)</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <span className="text-slate-500 font-medium">Inventory Stock Added:</span>
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> +240 Units Auto-Synced to Stock
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                <span>Auto-updates Purchase Register, FEFO Expiry &amp; Supplier Udhar</span>
                <span className="text-violet-700 font-bold">Zero Data Entry</span>
              </div>
            </div>
          </Reveal>

          {/* KILLER FEATURE: OFFLINE MESH & MULTI-DEVICE SYNC (6 COLS) */}
          <Reveal delay={240} className="lg:col-span-6 flex flex-col">
            <div className="flex-1 rounded-[2.5rem] bg-white/90 backdrop-blur-2xl border border-white/90 p-7 sm:p-9 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-xs border transition-all ${
                      isOfflineMode
                        ? 'bg-amber-50 text-amber-600 border-amber-300'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-300'
                    }`}>
                      {isOfflineMode ? <WifiOff className="w-6 h-6 text-amber-600" /> : <Wifi className="w-6 h-6 text-emerald-600" />}
                    </div>
                    <div>
                      <span className={`text-[11px] font-mono tracking-widest font-bold uppercase block ${
                        isOfflineMode ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        Zero Internet Downtime
                      </span>
                      <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                        Offline Mesh &amp; Cloud Re-Sync
                      </h3>
                    </div>
                  </div>

                  {/* Interactive Simulator Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleOffline}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      isOfflineMode
                        ? 'bg-amber-500 text-white border-amber-600 shadow-md animate-pulse'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    }`}
                  >
                    {isOfflineMode ? '⚡ Simulating OFFLINE' : '● Online Mode'}
                  </button>
                </div>

                <p className="text-slate-600 text-sm leading-relaxed mb-5">
                  Counter billing cannot halt when broadband cuts out during evening peak sales. OBIX keeps billing, printing,
                  and scanning with 0ms delay offline, then automatically reconciles cloud balances the second internet returns.
                </p>

                {/* Multi-Device Mesh Nodes Display */}
                <div className="bg-slate-50/90 rounded-2xl p-5 border border-slate-200/80 text-xs space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      CONNECTED STORE DEVICES (4 ACTIVE)
                    </span>
                    <span className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded border ${
                      isOfflineMode
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}>
                      {syncStatus === 'synced' && '✓ CLOUD MESH SYNCED'}
                      {syncStatus === 'local_cached' && '⚡ LOCAL CACHE BUFFER (100% WORKING)'}
                      {syncStatus === 'syncing' && '⟳ AUTO-RECONCILING LEDGER...'}
                    </span>
                  </div>

                  {/* 3 Active Nodes */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                      <Laptop className="w-4 h-4 mx-auto text-slate-700 mb-1" />
                      <div className="font-bold text-slate-900">Counter PC</div>
                      <div className="text-[10px] text-emerald-600 font-semibold">Billing Ready</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                      <Smartphone className="w-4 h-4 mx-auto text-slate-700 mb-1" />
                      <div className="font-bold text-slate-900">Android App</div>
                      <div className="text-[10px] text-emerald-600 font-semibold">Live POS</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                      <Printer className="w-4 h-4 mx-auto text-slate-700 mb-1" />
                      <div className="font-bold text-slate-900">ESC/POS 3&quot;</div>
                      <div className="text-[10px] text-emerald-600 font-semibold">Paired BT</div>
                    </div>
                  </div>

                  {/* Sync Event Banner */}
                  <div className={`p-3 rounded-xl border text-[11px] flex items-center justify-between transition-all ${
                    isOfflineMode
                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                      : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  }`}>
                    <span>
                      {isOfflineMode
                        ? 'Local SQLite / IndexedDB storing bills. Thermal printing works seamlessly.'
                        : 'Server latency < 15ms. Multi-device live inventory auto-balanced.'}
                    </span>
                    <span className="font-bold font-mono shrink-0 ml-2">
                      {isOfflineMode ? '0 Data Loss' : 'Cloud Mirror'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                <span>Automatic conflict-free CRDT resolution</span>
                <span className="text-amber-700 font-bold font-mono">99.99% Shop Uptime</span>
              </div>
            </div>
          </Reveal>

        </div>

      </div>
    </section>
  );
}
