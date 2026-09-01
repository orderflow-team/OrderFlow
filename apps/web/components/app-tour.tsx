'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Sparkles, Search, ShoppingCart, CheckCircle2, Package, Pill, BellRing,
  Users, UserPlus, Wallet, FileText, Warehouse, Truck, UserRound, Zap,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

interface TourCard {
  bg: string;
  fg: string;
  /** Literal bg-* class matching fg's color, for the Next button — Tailwind can't
   *  resolve a bg class derived from fg's text-* string at runtime, so this is
   *  spelled out explicitly rather than string-replaced. */
  accentBg: string;
  icon: typeof Sparkles;
  eyebrow: string;
  headline: string;
  body: string;
  /** Small 3-icon animated mini-diagram for cards that show a process, not just a fact. */
  flow?: [typeof Sparkles, typeof Sparkles, typeof Sparkles];
}

function getCards(isPharmacy: boolean, isSalesman: boolean, hasInventory: boolean): TourCard[] {
  const itemWord = isPharmacy ? 'medicine' : 'product';
  const catalogWord = isPharmacy ? 'Medicines' : 'Products';

  if (isSalesman) {
    return [
      {
        bg: 'bg-tile-lavender', fg: 'text-tile-lavender-fg', accentBg: 'bg-tile-lavender-fg', icon: Sparkles,
        eyebrow: 'Welcome', headline: "Hey there 👋", body: 'A 20-second look at what you\'ll use every day.',
      },
      {
        bg: 'bg-tile-peach', fg: 'text-tile-peach-fg', accentBg: 'bg-tile-peach-fg', icon: UserRound,
        eyebrow: 'Visits', headline: 'Check in anywhere', body: 'Log a visit the moment you walk into a shop.',
      },
      {
        bg: 'bg-tile-sky', fg: 'text-tile-sky-fg', accentBg: 'bg-tile-sky-fg', icon: Users,
        eyebrow: 'Clients', headline: 'Know every shop', body: 'Contacts and order history for every retailer you visit.',
      },
      {
        bg: 'bg-tile-mint', fg: 'text-tile-mint-fg', accentBg: 'bg-tile-mint-fg', icon: ShoppingCart,
        eyebrow: 'Orders', headline: 'Order on the spot', body: 'Take what a shop wants right there — no paper, no re-entry.',
        flow: [UserRound, ShoppingCart, CheckCircle2],
      },
      {
        bg: 'bg-tile-lavender', fg: 'text-tile-lavender-fg', accentBg: 'bg-tile-lavender-fg', icon: CheckCircle2,
        eyebrow: 'Ready', headline: "That's it! 🎉", body: 'Replay this anytime from your dashboard.',
      },
    ];
  }

  const cards: TourCard[] = [
    {
      bg: 'bg-tile-lavender', fg: 'text-tile-lavender-fg', accentBg: 'bg-tile-lavender-fg', icon: Sparkles,
      eyebrow: 'Welcome', headline: 'Hey there 👋', body: "Swipe through — the basics take about 30 seconds.",
    },
    {
      bg: 'bg-tile-peach', fg: 'text-tile-peach-fg', accentBg: 'bg-tile-peach-fg', icon: ShoppingCart,
      eyebrow: 'New Order', headline: 'Sell in seconds', body: 'Search, scan, or just say what they want.',
      flow: [Search, ShoppingCart, CheckCircle2],
    },
    {
      bg: 'bg-tile-lavender', fg: 'text-tile-lavender-fg', accentBg: 'bg-tile-lavender-fg', icon: isPharmacy ? Pill : Package,
      eyebrow: catalogWord, headline: 'Your whole catalog', body: hasInventory
        ? `Every ${itemWord}, its price, and its stock — always current.`
        : `Every ${itemWord} and its price, ready to sell.`,
    },
    {
      bg: 'bg-tile-sky', fg: 'text-tile-sky-fg', accentBg: 'bg-tile-sky-fg', icon: Users,
      eyebrow: 'Clients', headline: 'Know your customers', body: 'Orders and balances saved automatically — nothing to type twice.',
      flow: [UserPlus, Users, CheckCircle2],
    },
    {
      bg: 'bg-tile-mint', fg: 'text-tile-mint-fg', accentBg: 'bg-tile-mint-fg', icon: Wallet,
      eyebrow: 'Billing', headline: 'Get paid, stay tidy', body: 'Invoices, payments, and your ledger — one tap apart.',
      flow: [FileText, Wallet, CheckCircle2],
    },
    ...(hasInventory
      ? [{
          bg: 'bg-tile-peach', fg: 'text-tile-peach-fg', accentBg: 'bg-tile-peach-fg', icon: Warehouse,
          eyebrow: 'Inventory', headline: 'Never run dry', body: 'Stock levels, purchase orders, and low-stock alerts — handled.',
          flow: [Warehouse, Truck, BellRing] as [typeof Sparkles, typeof Sparkles, typeof Sparkles],
        }]
      : []),
    {
      bg: 'bg-tile-lavender', fg: 'text-tile-lavender-fg', accentBg: 'bg-tile-lavender-fg', icon: CheckCircle2,
      eyebrow: 'Ready', headline: "You're all set 🎉", body: 'Press N anytime for a new order. Replay this from your dashboard.',
    },
  ];

  return cards;
}

function MiniFlow({ icons, fg }: { icons: [typeof Sparkles, typeof Sparkles, typeof Sparkles]; fg: string }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      {icons.map((Icon, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl bg-white ring-1 ring-black/5 ${fg} flex items-center justify-center shadow-sm`}>
            <Icon className="w-4 h-4" strokeWidth={2.5} />
          </div>
          {i < icons.length - 1 && (
            <div className="flex gap-0.5">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="w-1 h-1 rounded-full bg-white/80 animate-pulse"
                  style={{ animationDelay: `${d * 200}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function AppTour({
  open,
  onOpenChange,
  isPharmacy,
  isSalesman,
  hasInventory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPharmacy: boolean;
  isSalesman: boolean;
  hasInventory: boolean;
}) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<'next' | 'back'>('next');
  const touchX = useRef<number | null>(null);
  const cards = getCards(isPharmacy, isSalesman, hasInventory);
  const card = cards[step];
  const isLast = step === cards.length - 1;
  const isFirst = step === 0;
  const Icon = card.icon;

  const goNext = () => {
    setDir('next');
    if (isLast) close();
    else setStep((s) => s + 1);
  };
  const goBack = () => {
    if (isFirst) return;
    setDir('back');
    setStep((s) => s - 1);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(() => setStep(0), 200);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) goNext();
    else goBack();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden border-none outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [&_*]:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none [&_*]:focus-visible:ring-0 shadow-2xl">
        {/* Progress bar — Instagram-story style segments. Right padding keeps
            clear of DialogContent's built-in close (X) button, which doubles
            as this tour's "skip" affordance. */}
        <div className="flex gap-1 pl-3 pr-10 pt-3">
          {cards.map((_, i) => (
            <span key={i} className="h-1 flex-1 rounded-full bg-black/10 overflow-hidden">
              <span
                className={`block h-full rounded-full bg-slate-800/70 transition-all duration-300 ${i <= step ? 'w-full' : 'w-0'}`}
              />
            </span>
          ))}
        </div>

        <div
          className={`${card.bg} relative overflow-hidden outline-none border-none ring-0`}
          style={{ WebkitTapHighlightColor: 'transparent' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Tap zones for click/tap-to-advance, story-style */}
          {!isFirst && (
            <button
              type="button"
              aria-label="Previous"
              onClick={goBack}
              tabIndex={-1}
              className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 border-none select-none"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            />
          )}
          <button
            type="button"
            aria-label="Next"
            onClick={goNext}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-pointer outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 border-none select-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          />

          {/* pointer-events-none on the whole card so the tap-zone buttons above
              always receive clicks/taps regardless of paint order — nothing in
              here needs to be independently clickable. */}
          <div
            key={step}
            className={`relative pointer-events-none px-7 pt-9 pb-8 flex flex-col items-center text-center gap-3 ${
              dir === 'next' ? 'animate-in fade-in slide-in-from-right-6' : 'animate-in fade-in slide-in-from-left-6'
            } duration-300`}
          >
            {/* Big soft watermark icon for depth */}
            <Icon className={`absolute -top-4 -right-4 w-28 h-28 ${card.fg} opacity-[0.08] rotate-12`} strokeWidth={1.5} />

            <span className={`text-[10px] font-bold uppercase tracking-widest ${card.fg} opacity-70`}>{card.eyebrow}</span>

            <div className={`w-16 h-16 rounded-2xl bg-white ring-1 ring-black/5 ${card.fg} flex items-center justify-center shadow-md animate-in zoom-in duration-300`}>
              <Icon className="w-7 h-7" strokeWidth={2.25} />
            </div>

            <div className="space-y-1">
              <DialogTitle className="text-2xl font-extrabold text-slate-800 text-balance">{card.headline}</DialogTitle>
              <DialogDescription className="text-sm text-slate-600 leading-relaxed max-w-[26ch] mx-auto">{card.body}</DialogDescription>
            </div>

            {card.flow && <MiniFlow icons={card.flow} fg={card.fg} />}

            {isFirst && (
              <span className="text-[11px] font-semibold text-slate-500/80 mt-1 flex items-center gap-1">
                Tap or swipe to continue <ChevronRight className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>

        {/* Bottom nav — visible controls alongside the tap/swipe zones above */}
        <div className="flex items-center justify-between p-3 bg-white">
          <button
            type="button"
            onClick={goBack}
            disabled={isFirst}
            aria-label="Back"
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-0 transition-colors outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-semibold text-slate-400">{step + 1} / {cards.length}</span>
          <button
            type="button"
            onClick={goNext}
            aria-label={isLast ? 'Finish' : 'Next'}
            className={`h-9 px-4 rounded-full flex items-center justify-center gap-1 text-sm font-bold text-white transition-colors ${card.accentBg} hover:brightness-95 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {isLast ? (
              <>Got it <Zap className="w-3.5 h-3.5" /></>
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
