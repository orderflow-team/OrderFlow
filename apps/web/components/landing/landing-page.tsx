"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Package,
  Receipt,
  Users,
  UserCog,
  CreditCard,
  UtensilsCrossed,
  ChefHat,
  Calculator,
  Truck,
  UserRound,
  UserPlus,
  Store,
  PackagePlus,
  Banknote,
  BarChart3,
  CheckCircle2,
  Printer,
  Sparkles,
  Zap,
  ArrowRight,
  Menu,
  X,
  Play,
  Download,
  Mic,
  Volume2,
  MessageSquare,
  Phone,
  Mail,
  ShieldCheck,
  Heart,
  ArrowUpRight,
  ChevronRight,
  Headphones,
  ArrowUp,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "./reveal";
import { TerminalPreview } from "./terminal-preview";
import { BentoGrid } from "./bento-grid";
import { HardwareBar } from "./hardware-bar";
import { PricingSection } from "./pricing-section";
import { FaqSection } from "./faq-section";
import { StepVisualizer } from "./step-visualizer";
import { ContactSection } from "./contact-section";
import { KillerFeaturesShowcase } from "./killer-features-showcase";
import { GooglePlayButton } from "./google-play-button";
import { ObixAppMockup } from "./obix-app-mockup";
import { ObixMark } from "@/components/obix-logo";
import { API_BASE_URL } from "@/lib/api-client";
import { TrendingUp } from "lucide-react";

const OrbitScene = dynamic(
  () => import("./orbit-scene").then((m) => ({ default: m.OrbitScene })),
  { ssr: false },
);
const FlowPath = dynamic(() => import("./flow-path").then((m) => ({ default: m.FlowPath })), {
  ssr: false,
});

const GLASS_SHEEN =
  "shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-1px_1px_rgba(255,255,255,0.15),0_20px_45px_-15px_rgba(15,23,42,0.25)]";

interface StepDef {
  title: string;
  copy: string;
  icon: LucideIcon;
  color: string;
}

const STEPS: StepDef[] = [
  {
    title: "Create your account",
    icon: UserPlus,
    color: "#0ea5e9",
    copy: "Sign up with an email and password — or skip the password and sign in with a one-time code instead.",
  },
  {
    title: "Pick your business type",
    icon: Store,
    color: "#8b5cf6",
    copy: "Grocery, restaurant, pharmacy, wholesale, salesman-led, or custom — OBIX shows only the screens that business type needs.",
  },
  {
    title: "Add what you sell",
    icon: PackagePlus,
    color: "#10b981",
    copy: "Products, menu items, or medicines, with pricing, stock, and categories set up in minutes.",
  },
  {
    title: "Take orders, send bills",
    icon: Banknote,
    color: "#f97316",
    copy: "Dine-in, takeaway, or a walk-in sale — every order becomes a GST-ready invoice with one tap.",
  },
  {
    title: "Bring in your team",
    icon: UserCog,
    color: "#06b6d4",
    copy: "Give a cashier, waiter, or cook their own login, scoped to exactly the screen their job needs.",
  },
  {
    title: "Watch it add up",
    icon: BarChart3,
    color: "#f43f5e",
    copy: "Sales, stock, and dues, tracked live on a dashboard built around how you actually run the counter.",
  },
];

interface RoleDef {
  label: string;
  icon: LucideIcon;
  copy: string;
}

const ROLES: RoleDef[] = [
  {
    label: "Manager",
    icon: UserCog,
    copy: "Runs the whole shop day-to-day, including hiring and full financial reporting.",
  },
  {
    label: "Cashier",
    icon: CreditCard,
    copy: "Fast barcode orders and billing — nothing else cluttering the screen.",
  },
  {
    label: "Waiter",
    icon: UtensilsCrossed,
    copy: "Table status and order taking so a dine-in shift never touches the back office.",
  },
  {
    label: "Cook",
    icon: ChefHat,
    copy: "Just the live Kitchen Order Ticket (KOT) display screen — nothing to get lost in.",
  },
  {
    label: "Accountant",
    icon: Calculator,
    copy: "GST reports, supplier dues, and billing ledgers without stock management clutter.",
  },
  {
    label: "Delivery",
    icon: Truck,
    copy: "Today's dispatch orders, address tags, and cash collection status.",
  },
  {
    label: "Salesman",
    icon: UserRound,
    copy: "Route visit logs and mobile customer order collection on field calls.",
  },
];

export function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroFade, setHeroFade] = useState(0);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [scrollActiveStep, setScrollActiveStep] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [heroActiveMode, setHeroActiveMode] = useState<"pos" | "voice" | "whatsapp">("pos");
  const [heroView, setHeroView] = useState<"pos" | "kot" | "voice">("pos");
  const [printAnim, setPrintAnim] = useState(false);
  const [voiceSimulating, setVoiceSimulating] = useState(false);

  // ── Social proof toast state ─────────────────────────────────────────────
  const TOASTS = [
    { name: "Ramesh Kirana",   city: "Surat",     action: "created an order",          amount: "₹2,340",  icon: "🛒" },
    { name: "Meena Pharmacy", city: "Ahmedabad",  action: "added medicines via OCR",   amount: "48 items", icon: "💊" },
    { name: "Shree Cafe",     city: "Vadodara",   action: "sent a WhatsApp invoice",   amount: "₹680",    icon: "☕" },
    { name: "Raja Wholesale", city: "Mumbai",     action: "recorded a payment",        amount: "₹14,200", icon: "💰" },
    { name: "Sunil Medicals", city: "Pune",       action: "printed a thermal bill",    amount: "₹920",    icon: "🖨️" },
    // { name: "Priya Boutique", city: "Jaipur",     action: "billed via Voice AI",       amount: "₹3,100",  icon: "🎤" },
  ];
  const [toastIndex, setToastIndex]   = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [statCount, setStatCount]     = useState({ counters: 0, billed: 0, rating: 0, states: 0 });
  const statsRef = useRef<HTMLDivElement>(null);

  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const activeStepIndex = hoveredStep ?? scrollActiveStep;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = stepRefs.current.findIndex((el) => el === entry.target);
            if (idx !== -1) setScrollActiveStep(idx);
          }
        });
      },
      { rootMargin: "-20% 0px -20% 0px", threshold: 0.1 },
    );
    stepRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = heroRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.7)));
        setHeroFade(ratio);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── Toast cycling ────────────────────────────────────────────────────────
  useEffect(() => {
    const initial = setTimeout(() => {
      setToastVisible(true);
      const interval = setInterval(() => {
        setToastVisible(false);
        setTimeout(() => {
          setToastIndex((i) => (i + 1) % TOASTS.length);
          setToastVisible(true);
        }, 600);
      }, 5000);
      return () => clearInterval(interval);
    }, 3000);
    return () => clearTimeout(initial);
  }, []);

  // ── Stats count-up when bar scrolls into view ────────────────────────────
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || statsVisible) return;
        setStatsVisible(true);
        const duration = 1800;
        const start = Date.now();
        const tick = () => {
          const p = Math.min(1, (Date.now() - start) / duration);
          const ease = 1 - Math.pow(1 - p, 3);
          setStatCount({
            counters: Math.round(ease * 500),
            billed:   Math.round(ease * 12),
            rating:   parseFloat((ease * 4.9).toFixed(1)),
            states:   Math.round(ease * 3),
          });
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [statsVisible]);

  const triggerPrintTest = () => {
    setPrintAnim(true);
    setTimeout(() => setPrintAnim(false), 2500);
  };

  const triggerVoiceSimulation = () => {
    setVoiceSimulating(true);
    setTimeout(() => setVoiceSimulating(false), 1200);
  };

  return (
    <div className="bg-slate-50 relative overflow-x-hidden">
      {/* Background Ambient Blobs — echo the logo's blue-to-emerald gradient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="drift-a absolute top-1/2 left-1/2 w-[70vw] h-[70vw] max-w-[60rem] max-h-[60rem] rounded-full bg-blue-300/35 blur-3xl" />
        <div className="drift-b absolute -top-1/4 -left-1/4 w-[50vw] h-[50vw] max-w-[42rem] max-h-[42rem] rounded-full bg-sky-300/40 blur-3xl" />
        <div className="drift-c absolute -bottom-1/4 -right-1/4 w-[50vw] h-[50vw] max-w-[42rem] max-h-[42rem] rounded-full bg-emerald-300/35 blur-3xl" />
      </div>

      {/* Header Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-50/90 border-b border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between px-6 sm:px-10 py-3.5 max-w-[100rem] mx-auto gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <ObixMark className="w-9 h-9" />
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              OBIX
            </span>
          </Link>

          {/* Desktop Navigation - Clean, user-friendly, no wrapping */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-7 text-sm font-semibold text-slate-600">
            <a
              href="#onboarding"
              className="hover:text-blue-600 transition-colors whitespace-nowrap"
            >
              Onboarding
            </a>
            <a
              href="#terminals"
              className="hover:text-blue-600 transition-colors whitespace-nowrap"
            >
              Terminals
            </a>
            <a
              href="#exclusive-features"
              className="hover:text-blue-600 transition-colors whitespace-nowrap text-slate-800 font-bold"
            >
              Connect &amp; AI
            </a>
            <a
              href="#hardware"
              className="hover:text-blue-600 transition-colors whitespace-nowrap"
            >
              Hardware
            </a>
            <a
              href="#pricing"
              className="hover:text-blue-600 transition-colors whitespace-nowrap"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="hover:text-blue-600 transition-colors whitespace-nowrap"
            >
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <GooglePlayButton size="sm" variant="dark" className="hidden 2xl:inline-flex" />
            <Link
              href="/login"
              className="hidden sm:inline-block whitespace-nowrap text-sm font-semibold text-slate-700 hover:text-slate-950 px-3.5 py-2 rounded-xl hover:bg-slate-200/50 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="hidden sm:inline-flex items-center justify-center whitespace-nowrap text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-full transition-all shadow-sm shadow-blue-600/25 hover:scale-[1.02]"
            >
              Get started free
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-200/60 cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileNavOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden bg-slate-900 text-white px-6 py-6 border-b border-slate-800 space-y-4 font-semibold text-sm animate-in slide-in-from-top duration-200">
            <a
              href="#exclusive-features"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-emerald-400 font-bold"
            >
              ⚡ AI Exclusives (Voice / WhatsApp / OCR)
            </a>
            <a
              href="#terminals"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 hover:text-blue-400"
            >
              Terminals
            </a>
            <a
              href="#features"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 hover:text-blue-400"
            >
              Features
            </a>
            <a
              href="#hardware"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 hover:text-blue-400"
            >
              Hardware Ecosystem
            </a>
            <a
              href="#roles"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 hover:text-blue-400"
            >
              Staff Roles
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-emerald-400 font-bold"
            >
              Pricing Plans
            </a>
            <a
              href="#faq"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 hover:text-blue-400"
            >
              FAQ
            </a>
            <div className="pt-2">
              <GooglePlayButton variant="glass" size="sm" className="w-full justify-center" />
            </div>
            <div className="pt-4 border-t border-slate-800 flex gap-4">
              <Link
                href="/login"
                className="px-4 py-2 bg-slate-800 rounded-xl text-center w-full"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-emerald-500 text-slate-950 font-bold rounded-xl text-center w-full"
              >
                Sign up
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <main
        ref={heroRef}
        className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 grid lg:grid-cols-12 gap-8 items-center min-h-[calc(100vh-80px)] py-12"
      >
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-500/15 via-emerald-500/15 to-violet-500/15 border border-emerald-500/30 text-emerald-900 text-xs font-extrabold uppercase tracking-wider shadow-sm">
            <span className="relative flex h-2 w-2 mr-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            OBIX 2.0 • AI-Powered Counter POS &amp; WhatsApp Billing
          </div>

          <h1 className="text-5xl sm:text-6xl xl:text-7xl font-extrabold tracking-tight text-slate-950 leading-[1.08]">
            <span className="whitespace-nowrap">Orders in. Stock out.</span>
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
              Paid up.
            </span>
          </h1>

          <p className="text-lg text-slate-600 font-medium leading-relaxed max-w-xl">
            The all-in-one counter platform engineered with Voice-to-Bill AI, instant WhatsApp order parsing, and wholesale bill OCR. Real-time inventory and GST compliance for grocery, restaurant, pharmacy, and wholesale.
          </p>

          {/* Interactive Feature Switcher that dynamically drives the live mobile phone mockup */}
          <div className="pt-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Test Live Counter In Screen:
            </p>
            <div className="inline-flex p-1.5 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/90 shadow-sm gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setHeroActiveMode("pos")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  heroActiveMode === "pos"
                    ? "bg-slate-900 text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <Store className="w-3.5 h-3.5 text-blue-400" /> Counter POS
              </button>
              <button
                type="button"
                onClick={() => setHeroActiveMode("voice")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  heroActiveMode === "voice"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <Mic className="w-3.5 h-3.5 text-amber-300 animate-pulse" /> Voice-to-Bill AI
              </button>
              <button
                type="button"
                onClick={() => setHeroActiveMode("whatsapp")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  heroActiveMode === "whatsapp"
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-200" /> WhatsApp Bills
              </button>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className={`inline-flex items-center justify-center h-14 px-8 rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-semibold text-base transition-all ring-1 ring-white/20 shadow-lg shadow-blue-600/25 hover:scale-[1.02] ${GLASS_SHEEN}`}
            >
              Get started free <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-white/80 hover:bg-white backdrop-blur-md text-slate-800 font-semibold text-base ring-1 ring-slate-200 transition-all shadow-sm hover:scale-[1.02]"
            >
              Sign in to Counter
            </Link>
            <GooglePlayButton />
          </div>

          <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-slate-700 font-semibold border-t border-slate-200/80">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 backdrop-blur-xs border border-slate-100 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>100% GST Compliant</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 backdrop-blur-xs border border-slate-100 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Thermal 2&quot; &amp; 3&quot; ESC/POS</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 backdrop-blur-xs border border-slate-100 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>AI Voice &amp; WhatsApp Bills</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 backdrop-blur-xs border border-slate-100 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Offline Cash &amp; Cloud Sync</span>
            </div>
          </div>
        </div>

        {/* Hero Interactive App Showcase Frame */}
        <div
          className="lg:col-span-6 relative h-[540px] sm:h-[620px]"
          style={{
            opacity: 1 - heroFade * 0.9,
            transform: `translateY(${heroFade * 40}px) scale(${1 - heroFade * 0.08})`,
          }}
        >
          <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
            <OrbitScene />
          </div>

          {/* Authentic Obix App Frame Replicating Real Mobile & Tablet UI */}
          <div className="relative z-10 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <ObixAppMockup
              defaultScreen="dashboard"
              externalMode={heroActiveMode}
              onModeChange={setHeroActiveMode}
            />
          </div>

          {/* Floating Authentic Live Status Badges */}
          <div className="hidden sm:flex absolute top-12 -left-2 sm:-left-6 z-20 bg-white/95 backdrop-blur-xl p-3.5 rounded-2xl shadow-xl border border-slate-200/90 text-xs font-semibold text-slate-800 items-center gap-3 ring-1 ring-white/80 hover:scale-105 transition-all">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-900 font-bold flex items-center gap-1.5">
                <span>Order #ORD-1060</span>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">Confirmed</span>
              </div>
              <div className="text-[11px] text-slate-500 font-normal">
                Pravinbhai • ₹188.40 (3 items)
              </div>
            </div>
          </div>

          <div className="hidden sm:flex absolute -bottom-4 right-0 sm:-right-4 z-20 bg-white/95 backdrop-blur-xl p-3.5 rounded-2xl shadow-xl border border-slate-200/90 text-xs font-semibold text-slate-800 items-center gap-3 ring-1 ring-white/80 hover:scale-105 transition-all">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-900 font-bold flex items-center gap-1.5">
                <span>Stock Balance</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">Optimal</span>
              </div>
              <div className="text-[11px] text-slate-500 font-normal">
                1,240 In Stock • 18 Low Stock
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── #1 Live Stats / Trust Numbers Bar ──────────────────────────── */}
      <div
        ref={statsRef}
        className="relative z-10 border-t border-b border-slate-200/80 bg-white/70 backdrop-blur-md"
      >
        <div className="max-w-[100rem] mx-auto px-6 sm:px-10 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            {
              value: statCount.counters > 0 ? `${statCount.counters}+` : "—",
              label: "Active Counters",
              sub: "across India",
              color: "text-blue-600",
              bg: "bg-blue-50",
              border: "border-blue-100",
            },
            {
              value: statCount.billed > 0 ? `₹${statCount.billed}Cr+` : "—",
              label: "Total Billed",
              sub: "on platform",
              color: "text-emerald-600",
              bg: "bg-emerald-50",
              border: "border-emerald-100",
            },
            {
              value: statCount.rating > 0 ? `${statCount.rating}★` : "—",
              label: "Play Store Rating",
              sub: "by shop owners",
              color: "text-amber-500",
              bg: "bg-amber-50",
              border: "border-amber-100",
            },
            {
              value: statCount.states > 0 ? `${statCount.states}` : "—",
              label: "States Active",
              sub: "Gujarat · Rajasthan · Maharashtra",
              color: "text-violet-600",
              bg: "bg-violet-50",
              border: "border-violet-100",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center gap-1 p-4 rounded-2xl border ${stat.border} ${stat.bg} transition-all duration-300`}
            >
              <span className={`text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight ${stat.color}`}>
                {stat.value}
              </span>
              <span className="text-sm font-bold text-slate-800">{stat.label}</span>
              <span className="text-[11px] text-slate-400 font-medium">{stat.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Simple Onboarding Roadmap Section - Immediately Below Hero */}
      <section
        id="onboarding"
        className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-20 sm:py-24 border-t border-slate-200/80 bg-gradient-to-b from-slate-50/40 via-white to-transparent"
      >
        <Reveal>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3 shadow-2xs">
            <UserPlus className="w-3.5 h-3.5" /> Simple Onboarding • Ready in 2 Minutes
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 max-w-2xl">
            From sign-up to your first sale.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-2xl">
            Zero complicated setup. This is the exact order things happen — just what the next 10 minutes look like.
          </p>

          {/* Quick 3-Step Express Boarding Strip */}
          <div className="mt-8 mb-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-blue-100 shadow-sm flex items-start gap-3.5 hover:border-blue-300 transition-all">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md shadow-blue-500/20">
                1
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">30-Second Instant Sign Up</div>
                <p className="text-xs text-slate-500 mt-0.5">Mobile OTP or Google account. No credit card, no hardware purchase required.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-purple-100 shadow-sm flex items-start gap-3.5 hover:border-purple-300 transition-all">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md shadow-purple-500/20">
                2
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Pick Your Counter Type</div>
                <p className="text-xs text-slate-500 mt-0.5">Kirana, Restaurant KOT, Pharmacy Rx, or Wholesale with auto-loaded catalogs.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-emerald-100 shadow-sm flex items-start gap-3.5 hover:border-emerald-300 transition-all">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md shadow-emerald-500/20">
                3
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Ring 1st Bill &amp; Print ESC/POS</div>
                <p className="text-xs text-slate-500 mt-0.5">1-click thermal receipt or WhatsApp invoice sent directly to customer phone.</p>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="mt-8 grid lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 relative">
            <div
              className="absolute left-6 top-2 bottom-2 w-px bg-slate-200"
              aria-hidden="true"
            />
            <ol className="space-y-10 pb-24">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const active = activeStepIndex === i;
                return (
                  <Reveal key={step.title} delay={i * 80}>
                    <li
                      ref={(el) => {
                        stepRefs.current[i] = el;
                      }}
                      className="relative flex gap-6 pl-0 cursor-default"
                      onMouseEnter={() => setHoveredStep(i)}
                      onMouseLeave={() =>
                        setHoveredStep((cur) => (cur === i ? null : cur))
                      }
                    >
                      <div
                        className={`relative z-10 shrink-0 w-12 h-12 rounded-2xl bg-white flex items-center justify-center ring-1 transition-all duration-300 ${
                          active ? "ring-2 scale-110" : "ring-white/60"
                        } ${GLASS_SHEEN}`}
                        style={
                          active
                            ? {
                                color: step.color,
                                boxShadow: `0 0 0 2px ${step.color}55`,
                              }
                            : undefined
                        }
                      >
                        <Icon
                          className={`w-5 h-5 ${active ? "" : "text-blue-700"}`}
                          strokeWidth={2.25}
                        />
                      </div>
                      <div className="pt-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-extrabold text-blue-800 bg-blue-500/15 px-2 py-0.5 rounded-md border border-blue-500/30 tabular-nums font-mono">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <h3 className="text-lg font-bold text-slate-900">
                            {step.title}
                          </h3>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-600 leading-relaxed max-w-lg">
                          {step.copy}
                        </p>
                      </div>
                    </li>
                  </Reveal>
                );
              })}
            </ol>
          </div>

          <Reveal
            delay={200}
            className="hidden lg:block lg:col-span-5 sticky top-28 w-full"
          >
            <StepVisualizer activeIndex={activeStepIndex} />
          </Reveal>
        </div>
      </section>

      {/* Killer Differentiators Exclusive to OBIX */}
      <KillerFeaturesShowcase />

      {/* Terminal Showcase Section */}
      <section
        id="terminals"
        className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80"
      >
        <Reveal>
          <div className="max-w-3xl mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
              <Store className="w-3.5 h-3.5" /> Counter By Industry • Specialized POS Modes
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-950 leading-[1.12]">
              Built for how your shop counter{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 bg-clip-text text-transparent">
                actually runs.
              </span>
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
              Kirana barcode rush, restaurant kitchen KOTs, pharmacy batch expiry tracking, wholesale tiered credit, or field salesman van delivery — select your business type below to test the live interactive counter layout.
            </p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <TerminalPreview />
        </Reveal>
      </section>

      {/* Bento Grid Feature Showcase Section */}
      <section
        id="features"
        className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80"
      >
        <Reveal>
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-bold tracking-[0.2em] text-blue-700 uppercase mb-3">
              Core Capabilities
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
              Everything in one app. Zero guesswork.
            </h2>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <BentoGrid />
        </Reveal>
      </section>

      {/* Hardware Ecosystem Section */}
      <section
        id="hardware"
        className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80"
      >
        <Reveal>
          <HardwareBar />
        </Reveal>
      </section>

      {/* Role-Based Logins Section */}
      <section
        id="roles"
        className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80"
      >
        <Reveal>
          <p className="text-xs font-bold tracking-[0.2em] text-emerald-700 uppercase mb-3">
            Scoped Role Security
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 max-w-2xl">
            Give the right person the right screen.
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl">
            Every login sees exactly what their job needs — nothing borrowed
            from an admin screen they shouldn&apos;t be in.
          </p>
        </Reveal>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ROLES.map((r, i) => {
            const Icon = r.icon;
            return (
              <Reveal key={r.label} delay={i * 60}>
                <div
                  className={`h-full rounded-3xl bg-white/70 backdrop-blur-xl ring-1 ring-white/80 p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white ${GLASS_SHEEN}`}
                >
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4 bg-slate-900/5 text-slate-700">
                    <Icon className="w-5 h-5" strokeWidth={2.25} />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-1.5">
                    {r.label}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {r.copy}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80"
      >
        <Reveal>
          <PricingSection />
        </Reveal>
      </section>

      {/* FAQ Section */}
      <section
        id="faq"
        className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80"
      >
        <Reveal>
          <FaqSection />
        </Reveal>
      </section>

      {/* CTA Footer Banner */}
      <section className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 pb-24">
        <Reveal>
          <div
            className={`rounded-[2.5rem] bg-slate-900 px-8 py-16 sm:px-16 sm:py-20 text-center relative overflow-hidden ${GLASS_SHEEN}`}
          >
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white relative z-10">
              Run your shop from{" "}
              <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                one screen
              </span>
              , starting today.
            </h2>
            <p className="mt-4 text-slate-400 text-base max-w-xl mx-auto relative z-10">
              Join hundreds of retail counters, cafes, pharmacies, and
              distributors streamlining their daily operations.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4 relative z-10">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-400 hover:to-emerald-400 text-slate-950 font-bold text-base transition-colors shadow-lg shadow-blue-500/25"
              >
                Get started free
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-base ring-1 ring-white/20 transition-colors"
              >
                Sign in
              </Link>
              <GooglePlayButton variant="dark" />
            </div>
          </div>
        </Reveal>
      </section>

      {/* Contact Section */}
      <section
        id="contact"
        className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80"
      >
        <Reveal>
          <ContactSection />
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 bg-slate-900 text-slate-400 py-16 sm:py-20">
        <div className="max-w-[100rem] mx-auto px-6 sm:px-10">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10 lg:gap-12 pb-14 border-b border-slate-800">
            {/* Col 1: Brand (Span 2) */}
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <ObixMark className="w-8 h-8 text-white" />
                <span className="font-bold text-lg text-white tracking-tight">OBIX 360</span>
              </div>
              <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
                All-in-one order billing, inventory management, and POS platform for modern Indian retail, restaurants, pharmacies, and wholesale distributors.
              </p>
              <div className="pt-2">
                <GooglePlayButton size="sm" variant="dark" />
              </div>
            </div>

            {/* Col 2: Terminals */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Terminals
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a href="#terminals" className="hover:text-white transition-colors">
                    Grocery &amp; Kirana
                  </a>
                </li>
                <li>
                  <a href="#terminals" className="hover:text-white transition-colors">
                    Restaurant &amp; Cafe
                  </a>
                </li>
                <li>
                  <a href="#terminals" className="hover:text-white transition-colors">
                    Pharmacy &amp; Chemist
                  </a>
                </li>
                <li>
                  <a href="#terminals" className="hover:text-white transition-colors">
                    Wholesale B2B
                  </a>
                </li>
                <li>
                  <Link href="/salesman" className="hover:text-white transition-colors">
                    Field Salesman
                  </Link>
                </li>
                <li>
                  <a href="#terminals" className="hover:text-white transition-colors">
                    Garments &amp; Apparel
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Features */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Features
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    OBIX Connect
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Voice-to-Bill
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    WhatsApp Invoicing
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Distributor Bill OCR
                  </a>
                </li>
                <li>
                  <a href="#hardware" className="hover:text-white transition-colors">
                    ESC/POS Thermal Print
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Offline Mesh Sync
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 4: Platform */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Platform
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link href="/login" className="hover:text-white transition-colors">
                    Web Terminal
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-white transition-colors">
                    Create Free Account
                  </Link>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white transition-colors">
                    Pricing Plans
                  </a>
                </li>
                <li>
                  <a href="#hardware" className="hover:text-white transition-colors">
                    Hardware Ecosystem
                  </a>
                </li>
                <li>
                  <a href="#roles" className="hover:text-white transition-colors">
                    Staff Roles (RBAC)
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">
                    Hardware &amp; FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 5: Company & Legal */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Support &amp; Legal
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a href="#contact" className="hover:text-white transition-colors">
                    Contact &amp; Helpdesk
                  </a>
                </li>
                <li>
                  <Link href="/privacy-policy" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-white transition-colors">
                    Data Sovereign Policy
                  </Link>
                </li>
                <li>
                  <a href="#contact" className="hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="mailto:support@obix360.com" className="hover:text-white transition-colors">
                    support@obix360.com
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              &copy; {new Date().getFullYear()} OBIX 360 Technologies Pvt Ltd. All rights reserved.
            </div>

            <div className="flex flex-wrap items-center gap-6 font-medium">
              <Link href="/privacy-policy" className="hover:text-slate-300 transition-colors">
                Privacy
              </Link>
              <a href="#contact" className="hover:text-slate-300 transition-colors">
                Terms
              </a>
              <a href="#contact" className="hover:text-slate-300 transition-colors">
                Security
              </a>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="hover:text-slate-300 transition-colors cursor-pointer"
              >
                Back to top ↑
              </button>
            </div>
          </div>
        </div>
      </footer>
      {/* ── #2a Floating Social Proof Toasts ───────────────────────────── */}
      <div
        className={`fixed bottom-6 left-4 sm:left-6 z-[100] transition-all duration-500 ${
          toastVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl p-3.5 flex items-center gap-3 max-w-[270px] sm:max-w-[300px] ring-1 ring-white/80">
          <div className="text-2xl shrink-0 leading-none">{TOASTS[toastIndex].icon}</div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-slate-900 truncate">
              {TOASTS[toastIndex].name}
              <span className="text-slate-400 font-medium"> · {TOASTS[toastIndex].city}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {TOASTS[toastIndex].action}
              <span className="ml-1 font-bold text-slate-700">{TOASTS[toastIndex].amount}</span>
            </div>
          </div>
          <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </div>

      {/* ── #2b Floating WhatsApp CTA Button ───────────────────────────── */}
      <a
        href="https://wa.me/919876543210?text=Hi%2C%20I%20want%20to%20try%20OBIX%20for%20my%20shop"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-4 sm:right-6 z-[100] flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20c05c] text-white font-bold text-sm px-4 py-3 rounded-full shadow-xl shadow-emerald-600/30 hover:scale-105 transition-all duration-200 group"
        aria-label="Chat with us on WhatsApp"
      >
        {/* WhatsApp SVG icon */}
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white shrink-0" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span className="hidden sm:inline">Chat on WhatsApp</span>
        {/* Tooltip on mobile */}
        <span className="sm:hidden text-[11px]">WhatsApp</span>
      </a>
    </div>
  );
}
