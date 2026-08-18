'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Sparkles, Mic, Package, Pill, Users, Receipt, Zap, LayoutDashboard,
  UserRound, ShoppingCart, CheckCircle2,
} from 'lucide-react';

interface TourStep {
  icon: typeof Sparkles;
  iconBg: string;
  iconFg: string;
  title: string;
  body: string;
}

function getTourSteps(isPharmacy: boolean, isSalesman: boolean, hasInventory: boolean): TourStep[] {
  if (isSalesman) {
    return [
      {
        icon: Sparkles, iconBg: 'bg-tile-lavender-icon', iconFg: 'text-tile-lavender-fg',
        title: 'Welcome to OBIX',
        body: "Here's the 30-second version of what you'll use every day.",
      },
      {
        icon: UserRound, iconBg: 'bg-tile-lavender-icon', iconFg: 'text-tile-lavender-fg',
        title: 'Log Visit',
        body: 'Check in at a shop when you arrive — it keeps a record of every stop on your route.',
      },
      {
        icon: Users, iconBg: 'bg-tile-peach-icon', iconFg: 'text-tile-peach-fg',
        title: 'Clients',
        body: "Your assigned retailers, their contact details, and what they've ordered before.",
      },
      {
        icon: ShoppingCart, iconBg: 'bg-tile-sky-icon', iconFg: 'text-tile-sky-fg',
        title: 'Orders',
        body: "Record what a shop wants right there during your visit — no need to write it down and enter it later.",
      },
      {
        icon: CheckCircle2, iconBg: 'bg-tile-mint-icon', iconFg: 'text-tile-mint-fg',
        title: "That's it",
        body: 'You can replay this tour anytime from the button on your dashboard.',
      },
    ];
  }

  return [
    {
      icon: Sparkles, iconBg: 'bg-tile-lavender-icon', iconFg: 'text-tile-lavender-fg',
      title: 'Welcome to OBIX',
      body: "Here's a quick look at the basics — about a minute, then you're on your own.",
    },
    {
      icon: Mic, iconBg: 'bg-tile-peach-icon', iconFg: 'text-tile-peach-fg',
      title: 'New Order, fast',
      body: 'Tap "New Order" to record a sale. In a hurry? Hit the mic icon and just say what the customer wants instead of typing it in.',
    },
    {
      icon: isPharmacy ? Pill : Package, iconBg: 'bg-tile-lavender-icon', iconFg: 'text-tile-lavender-fg',
      title: isPharmacy ? 'Medicines' : 'Products',
      body: hasInventory
        ? `Keep your ${isPharmacy ? 'medicine' : 'product'} catalog and stock levels up to date. Low-stock and expiry alerts show up right on your dashboard, and in your notifications.`
        : `Keep your ${isPharmacy ? 'medicine' : 'product'} catalog up to date — prices, units, and categories all live here.`,
    },
    {
      icon: Users, iconBg: 'bg-tile-sky-icon', iconFg: 'text-tile-sky-fg',
      title: 'Clients & Billing',
      body: "Every customer's order history and outstanding balance lives on their profile. Collect payments and track what's owed from the Ledger.",
    },
    {
      icon: Zap, iconBg: 'bg-tile-mint-icon', iconFg: 'text-tile-mint-fg',
      title: 'Power tip',
      body: 'Press N anywhere on Orders, Products, or Customers to jump straight into a new one — no mouse needed.',
    },
    {
      icon: LayoutDashboard, iconBg: 'bg-tile-lavender-icon', iconFg: 'text-tile-lavender-fg',
      title: "That's the basics",
      body: 'Deeper reports, inventory tools, and settings are in the menu. Come back to this tour anytime from the button on your dashboard.',
    },
  ];
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
  const steps = getTourSteps(isPharmacy, isSalesman, hasInventory);
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const Icon = current.icon;

  const close = () => {
    onOpenChange(false);
    // Reset for next time it's reopened (manually, via the "Take a tour" button).
    setTimeout(() => setStep(0), 200);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        <div className="p-6 pb-4 flex flex-col items-center text-center gap-4">
          <div className={`${current.iconBg} ${current.iconFg} w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm`}>
            <Icon className="w-7 h-7" strokeWidth={2.25} />
          </div>
          <div className="space-y-1.5">
            <DialogTitle className="text-lg font-bold text-slate-800">{current.title}</DialogTitle>
            <DialogDescription className="text-sm text-slate-500 leading-relaxed">{current.body}</DialogDescription>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 pb-4">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-tile-lavender-fg' : 'w-1.5 bg-slate-200'}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 p-4 pt-0">
          {!isLast && (
            <Button type="button" variant="ghost" onClick={close} className="text-slate-400 hover:text-slate-600">
              Skip
            </Button>
          )}
          <div className="flex-1" />
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          <Button
            type="button"
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
            className="bg-tile-lavender-fg hover:brightness-95 text-white"
          >
            {isLast ? 'Got it' : 'Next'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
