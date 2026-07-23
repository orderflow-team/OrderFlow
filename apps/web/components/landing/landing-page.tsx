'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Fraunces } from 'next/font/google';
import Link from 'next/link';
import {
  ShoppingCart,
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
  type LucideIcon,
} from 'lucide-react';
import { Reveal } from './reveal';
import { TerminalPreview } from './terminal-preview';
import { BentoGrid } from './bento-grid';
import { HardwareBar } from './hardware-bar';
import { FaqSection } from './faq-section';
import { StepVisualizer } from './step-visualizer';
import { ContactSection } from './contact-section';

const OrbitScene = dynamic(() => import('./orbit-scene').then((m) => m.OrbitScene), { ssr: false });
const FlowPath = dynamic(() => import('./flow-path').then((m) => m.FlowPath), { ssr: false });

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
});

const GLASS_SHEEN =
  'shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-1px_1px_rgba(255,255,255,0.15),0_20px_45px_-15px_rgba(15,23,42,0.25)]';

interface StepDef {
  title: string;
  copy: string;
  icon: LucideIcon;
  color: string;
}

const STEPS: StepDef[] = [
  { title: 'Create your account', icon: UserPlus, color: '#0ea5e9', copy: 'Sign up with an email and password — or skip the password and sign in with a one-time code instead.' },
  { title: 'Pick your business type', icon: Store, color: '#8b5cf6', copy: 'Grocery, restaurant, pharmacy, wholesale, salesman-led, or custom — OrderFlow shows only the screens that business type needs.' },
  { title: 'Add what you sell', icon: PackagePlus, color: '#10b981', copy: 'Products, menu items, or medicines, with pricing, stock, and categories set up in minutes.' },
  { title: 'Take orders, send bills', icon: Banknote, color: '#f97316', copy: 'Dine-in, takeaway, or a walk-in sale — every order becomes a GST-ready invoice with one tap.' },
  { title: 'Bring in your team', icon: UserCog, color: '#06b6d4', copy: 'Give a cashier, waiter, or cook their own login, scoped to exactly the screen their job needs.' },
  { title: 'Watch it add up', icon: BarChart3, color: '#f43f5e', copy: 'Sales, stock, and dues, tracked live on a dashboard built around how you actually run the counter.' },
];

interface RoleDef {
  label: string;
  icon: LucideIcon;
  copy: string;
}

const ROLES: RoleDef[] = [
  { label: 'Manager', icon: UserCog, copy: 'Runs the whole shop day-to-day, including hiring and full financial reporting.' },
  { label: 'Cashier', icon: CreditCard, copy: 'Fast barcode orders and billing — nothing else cluttering the screen.' },
  { label: 'Waiter', icon: UtensilsCrossed, copy: 'Table status and order taking so a dine-in shift never touches the back office.' },
  { label: 'Cook', icon: ChefHat, copy: 'Just the live Kitchen Order Ticket (KOT) display screen — nothing to get lost in.' },
  { label: 'Accountant', icon: Calculator, copy: 'GST reports, supplier dues, and billing ledgers without stock management clutter.' },
  { label: 'Delivery', icon: Truck, copy: "Today's dispatch orders, address tags, and cash collection status." },
  { label: 'Salesman', icon: UserRound, copy: 'Route visit logs and mobile customer order collection on field calls.' },
];

export function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroFade, setHeroFade] = useState(0);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [scrollActiveStep, setScrollActiveStep] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [heroView, setHeroView] = useState<'pos' | 'kot'>('pos');
  const [printAnim, setPrintAnim] = useState(false);

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
      { rootMargin: '-20% 0px -20% 0px', threshold: 0.1 },
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
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const triggerPrintTest = () => {
    setPrintAnim(true);
    setTimeout(() => setPrintAnim(false), 2500);
  };

  return (
    <div className={`${fraunces.variable} bg-slate-50 relative overflow-x-hidden`}>
      {/* Background Ambient Blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="drift-a absolute top-1/2 left-1/2 w-[70vw] h-[70vw] max-w-[60rem] max-h-[60rem] rounded-full bg-sky-300/35 blur-3xl" />
        <div className="drift-b absolute -top-1/4 -left-1/4 w-[50vw] h-[50vw] max-w-[42rem] max-h-[42rem] rounded-full bg-orange-300/40 blur-3xl" />
        <div className="drift-c absolute -bottom-1/4 -right-1/4 w-[50vw] h-[50vw] max-w-[42rem] max-h-[42rem] rounded-full bg-emerald-300/35 blur-3xl" />
      </div>

      {/* Header Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-50/85 border-b border-white/60">
        <div className="flex items-center justify-between px-6 sm:px-10 py-4 max-w-[100rem] mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 bg-gradient-to-tr from-emerald-600 to-teal-400 backdrop-blur-xl rounded-2xl flex items-center justify-center ring-1 ring-white/60 ${GLASS_SHEEN}`}
            >
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">OrderFlow</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#onboarding" className="hover:text-emerald-700 transition-colors">Onboarding</a>
            <a href="#terminals" className="hover:text-emerald-700 transition-colors">Terminals</a>
            <a href="#features" className="hover:text-emerald-700 transition-colors">Features</a>
            <a href="#hardware" className="hover:text-emerald-700 transition-colors">Hardware</a>
            <a href="#roles" className="hover:text-emerald-700 transition-colors">Staff Roles</a>
            <a href="#faq" className="hover:text-emerald-700 transition-colors">FAQ</a>
            <a href="#contact" className="hover:text-emerald-700 transition-colors">Contact</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:inline-block text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/signup"
              className={`text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 px-5 py-2.5 rounded-full transition-all ring-1 ring-white/10 ${GLASS_SHEEN}`}
            >
              Get started free
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-200/60 cursor-pointer"
            >
              {mobileNavOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden bg-slate-900 text-white px-6 py-6 border-b border-slate-800 space-y-4 font-semibold text-sm animate-in slide-in-from-top duration-200">
            <a href="#terminals" onClick={() => setMobileNavOpen(false)} className="block py-2 hover:text-emerald-400">Terminals</a>
            <a href="#features" onClick={() => setMobileNavOpen(false)} className="block py-2 hover:text-emerald-400">Features</a>
            <a href="#hardware" onClick={() => setMobileNavOpen(false)} className="block py-2 hover:text-emerald-400">Hardware Ecosystem</a>
            <a href="#roles" onClick={() => setMobileNavOpen(false)} className="block py-2 hover:text-emerald-400">Staff Roles</a>
            <a href="#faq" onClick={() => setMobileNavOpen(false)} className="block py-2 hover:text-emerald-400">FAQ</a>
            <a href="#contact" onClick={() => setMobileNavOpen(false)} className="block py-2 hover:text-emerald-400">Contact</a>
            <div className="pt-4 border-t border-slate-800 flex gap-4">
              <Link href="/login" className="px-4 py-2 bg-slate-800 rounded-xl text-center w-full">Sign in</Link>
              <Link href="/signup" className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-center w-full">Sign up</Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <main ref={heroRef} className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 grid lg:grid-cols-12 gap-8 items-center min-h-[calc(100vh-80px)] py-12">
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 text-xs font-extrabold uppercase tracking-wider shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-700" /> POS &amp; Counter Management Platform
          </div>

          <h1
            style={{ fontFamily: 'var(--font-fraunces)' }}
            className="text-5xl sm:text-6xl xl:text-7xl font-medium tracking-tight text-slate-900 leading-[1.04]"
          >
            Orders in.
            <br />
            Stock out.
            <br />
            <span className="italic text-emerald-700">Paid up.</span>
          </h1>

          <p className="text-lg text-slate-600 font-medium leading-relaxed max-w-xl">
            One screen for the whole counter — orders, real-time inventory, GST billing, and customers, kept in sync live for grocery, restaurant, pharmacy, and wholesale.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className={`inline-flex items-center justify-center h-14 px-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base transition-all ring-1 ring-white/20 shadow-lg shadow-emerald-600/25 ${GLASS_SHEEN}`}
            >
              Get started free <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-white/70 hover:bg-white/90 backdrop-blur-md text-slate-800 font-semibold text-base ring-1 ring-white/80 transition-all shadow-sm"
            >
              Sign in to Counter
            </Link>
          </div>

          <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-slate-500 font-medium border-t border-slate-200/80">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> GST Compliant</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Thermal Printer Ready</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Offline Cash Sync</span>
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

          {/* Interactive Hero POS Showcase Card */}
          <div className="relative z-10 top-1/2 -translate-y-1/2 rounded-3xl bg-slate-900/95 text-white p-6 sm:p-7 shadow-2xl border border-slate-800 backdrop-blur-xl">
            {/* Window Controls & View Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <span className="text-xs font-mono font-bold text-slate-200">RADHE SUPERMARKET • COUNTER #1</span>
              </div>
              
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
                <button
                  onClick={() => setHeroView('pos')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    heroView === 'pos' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  POS Billing
                </button>
                <button
                  onClick={() => setHeroView('kot')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    heroView === 'kot' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Kitchen KOT
                </button>
              </div>
            </div>

            {/* Dynamic Content View */}
            {heroView === 'pos' ? (
              <div className="mt-4 space-y-3 font-mono text-xs animate-in fade-in duration-200">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <div className="text-slate-200 font-semibold">Parle-G Gold 100g</div>
                    <div className="text-[11px] text-slate-500">10 x ₹12.00 • HSN 1905</div>
                  </div>
                  <div className="text-emerald-400 font-bold">₹120.00</div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <div className="text-slate-200 font-semibold">Amul Taaza Milk 1L Pouch</div>
                    <div className="text-[11px] text-slate-500">2 x ₹68.00 • HSN 0401</div>
                  </div>
                  <div className="text-emerald-400 font-bold">₹136.00</div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3 font-mono text-xs animate-in fade-in duration-200">
                <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/30">
                  <div className="text-amber-400 font-bold flex justify-between border-b border-amber-500/20 pb-1 mb-1">
                    <span>🔥 KOT #108 (Table 4)</span>
                    <span>02:15 mins ago</span>
                  </div>
                  <div className="text-slate-300 text-[11px] space-y-1">
                    <div>• 2x Paneer Butter Masala (Medium Spicy)</div>
                    <div>• 4x Butter Garlic Naan</div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Controls */}
            <div className="mt-5 pt-3 border-t border-slate-800 flex flex-wrap justify-between items-center gap-3">
              <div>
                <div className="text-[11px] text-slate-400 font-mono">Total Net Amount</div>
                <div className="text-xl font-bold text-emerald-400 font-mono">₹256.00</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerPrintTest}
                  className="px-3.5 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 hover:bg-emerald-400 transition-all cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  <Printer className="w-3.5 h-3.5" /> Thermal Print Test
                </button>
              </div>
            </div>

            {/* Simulated Receipt Pop-out Animation */}
            {printAnim && (
              <div className="mt-3 p-3 bg-emerald-500/20 text-emerald-300 rounded-xl text-xs font-mono border border-emerald-500/40 flex items-center gap-2 animate-in slide-in-from-top duration-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Printing 2-inch ESC/POS thermal receipt to local printer...</span>
              </div>
            )}
          </div>

          {/* Floating Live Badges */}
          <div className="absolute top-6 -left-4 z-20 bg-slate-900/95 backdrop-blur-xl p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 text-xs font-semibold text-white flex items-center gap-3 animate-bounce duration-[3000ms] ring-1 ring-white/10">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-100 font-bold">KOT #108 Fired</div>
              <div className="text-[10px] text-slate-400 font-normal">Table 4 Kitchen Display Synced</div>
            </div>
          </div>

          <div className="absolute -bottom-2 right-4 z-20 bg-slate-900/95 backdrop-blur-xl p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 text-xs font-semibold text-white flex items-center gap-3 ring-1 ring-white/10">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-100 font-bold">WhatsApp GST Bill</div>
              <div className="text-[10px] text-slate-400 font-normal">Sent to +91 98200XXXXX</div>
            </div>
          </div>
        </div>
      </main>

      {/* Onboarding Roadmap Section */}
      <section id="onboarding" className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80">
        <Reveal>
          <p className="text-xs font-bold tracking-[0.2em] text-emerald-700 uppercase mb-3">Simple Onboarding</p>
          <h2 style={{ fontFamily: 'var(--font-fraunces)' }} className="text-4xl font-medium text-slate-900 max-w-2xl">
            From sign-up to your first sale.
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-xl">
            This is the actual order things happen in — just what the next 10 minutes look like.
          </p>
        </Reveal>

        <div className="mt-14 grid lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 relative">
            <div className="absolute left-6 top-2 bottom-2 w-px bg-slate-200" aria-hidden="true" />
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
                      onMouseLeave={() => setHoveredStep((cur) => (cur === i ? null : cur))}
                    >
                      <div
                        className={`relative z-10 shrink-0 w-12 h-12 rounded-2xl bg-white flex items-center justify-center ring-1 transition-all duration-300 ${
                          active ? 'ring-2 scale-110' : 'ring-white/60'
                        } ${GLASS_SHEEN}`}
                        style={active ? { color: step.color, boxShadow: `0 0 0 2px ${step.color}55` } : undefined}
                      >
                        <Icon className={`w-5 h-5 ${active ? '' : 'text-emerald-700'}`} strokeWidth={2.25} />
                      </div>
                      <div className="pt-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-extrabold text-emerald-800 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30 tabular-nums font-mono">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-600 leading-relaxed max-w-lg">{step.copy}</p>
                      </div>
                    </li>
                  </Reveal>
                );
              })}
            </ol>
          </div>

          <Reveal delay={200} className="hidden lg:block lg:col-span-5 sticky top-28 w-full">
            <StepVisualizer activeIndex={activeStepIndex} />
          </Reveal>
        </div>
      </section>

      {/* Terminal Showcase Section */}
      <section id="terminals" className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80">
        <Reveal>
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-bold tracking-[0.2em] text-emerald-700 uppercase mb-3">Counter By Industry</p>
            <h2 style={{ fontFamily: 'var(--font-fraunces)' }} className="text-4xl font-medium text-slate-900">
              Built for how your shop counter actually runs.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Select your business type below to test the live interactive counter layout.
            </p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <TerminalPreview />
        </Reveal>
      </section>

      {/* Bento Grid Feature Showcase Section */}
      <section id="features" className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80">
        <Reveal>
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-bold tracking-[0.2em] text-emerald-700 uppercase mb-3">Core Capabilities</p>
            <h2 style={{ fontFamily: 'var(--font-fraunces)' }} className="text-4xl font-medium text-slate-900">
              Everything in one app. Zero guesswork.
            </h2>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <BentoGrid />
        </Reveal>
      </section>

      {/* Hardware Ecosystem Section */}
      <section id="hardware" className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80">
        <Reveal>
          <HardwareBar />
        </Reveal>
      </section>

      {/* Role-Based Logins Section */}
      <section id="roles" className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80">
        <Reveal>
          <p className="text-xs font-bold tracking-[0.2em] text-emerald-700 uppercase mb-3">Scoped Role Security</p>
          <h2 style={{ fontFamily: 'var(--font-fraunces)' }} className="text-4xl font-medium text-slate-900 max-w-2xl">
            Give the right person the right screen.
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl">
            Every login sees exactly what their job needs — nothing borrowed from an admin screen they shouldn&apos;t be in.
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
                  <h3 className="text-base font-bold text-slate-800 mb-1.5">{r.label}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{r.copy}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80">
        <Reveal>
          <FaqSection />
        </Reveal>
      </section>

      {/* CTA Footer Banner */}
      <section className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 pb-24">
        <Reveal>
          <div className={`rounded-[2.5rem] bg-slate-900 px-8 py-16 sm:px-16 sm:py-20 text-center relative overflow-hidden ${GLASS_SHEEN}`}>
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
            <h2 style={{ fontFamily: 'var(--font-fraunces)' }} className="text-4xl sm:text-5xl font-medium text-white relative z-10">
              Run your shop from <span className="italic text-emerald-400">one screen</span>, starting today.
            </h2>
            <p className="mt-4 text-slate-400 text-base max-w-xl mx-auto relative z-10">
              Join hundreds of retail counters, cafes, pharmacies, and distributors streamlining their daily operations.
            </p>
            <div className="mt-9 flex items-center justify-center gap-4 relative z-10">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base transition-colors shadow-lg shadow-emerald-500/25"
              >
                Get started free
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center h-14 px-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-base ring-1 ring-white/20 transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Contact Section */}
      <section id="contact" className="relative z-10 max-w-[100rem] mx-auto px-6 sm:px-10 py-24 border-t border-slate-200/80">
        <Reveal>
          <ContactSection />
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200 py-10 bg-slate-100/60">
        <div className="max-w-[100rem] mx-auto px-6 sm:px-10 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xs">
              O
            </div>
            <span className="font-bold text-slate-700 text-sm">OrderFlow</span>
            <span>&copy; {new Date().getFullYear()} OrderFlow Inc. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-semibold">
            <a href="#terminals" className="hover:text-slate-900">Terminals</a>
            <a href="#features" className="hover:text-slate-900">Features</a>
            <a href="#hardware" className="hover:text-slate-900">Hardware</a>
            <a href="#roles" className="hover:text-slate-900">Roles</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
            <a href="#contact" className="hover:text-slate-900">Contact</a>
            <Link href="/login" className="hover:text-slate-900">Sign in</Link>
            <Link href="/signup" className="text-emerald-700 hover:underline">Get Started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
