'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Sparkles, Mic, Package, Pill, Users, Receipt, Zap, LayoutDashboard,
  UserRound, ShoppingCart, CheckCircle2, Search, ListPlus, Send,
  UserPlus, Wallet, FileText, Warehouse, Truck, BellRing,
} from 'lucide-react';

interface TourStep {
  module: string;
  icon: typeof Sparkles;
  iconBg: string;
  iconFg: string;
  title: string;
  body: string;
}

function getTourSteps(isPharmacy: boolean, isSalesman: boolean, hasInventory: boolean): TourStep[] {
  const itemWord = isPharmacy ? 'medicine' : 'product';
  const catalogWord = isPharmacy ? 'Medicines' : 'Products';

  if (isSalesman) {
    return [
      {
        module: 'Welcome', icon: Sparkles, iconBg: 'bg-tile-lavender-icon', iconFg: 'text-tile-lavender-fg',
        title: 'Welcome to OBIX',
        body: "Here's the 30-second version of what you'll use every day.",
      },
      {
        module: 'Visits', icon: UserRound, iconBg: 'bg-tile-lavender-icon', iconFg: 'text-tile-lavender-fg',
        title: 'Log Visit',
        body: 'Check in at a shop when you arrive — it keeps a record of every stop on your route.',
      },
      {
        module: 'Clients', icon: Users, iconBg: 'bg-tile-peach-icon', iconFg: 'text-tile-peach-fg',
        title: 'Clients',
        body: "Your assigned retailers, their contact details, and what they've ordered before.",
      },
      {
        module: 'Orders', icon: ShoppingCart, iconBg: 'bg-tile-sky-icon', iconFg: 'text-tile-sky-fg',
        title: 'Orders',
        body: 'Record what a shop wants right there during your visit — no need to write it down and enter it later.',
      },
      {
        module: 'Done', icon: CheckCircle2, iconBg: 'bg-tile-mint-icon', iconFg: 'text-tile-mint-fg',
        title: "That's it",
        body: 'You can replay this tour anytime from the button on your dashboard.',
      },
    ];
  }

  const steps: TourStep[] = [
    {
      module: 'Welcome', icon: Sparkles, iconBg: 'bg-tile-lavender-icon', iconFg: 'text-tile-lavender-fg',
      title: 'Welcome to OBIX',
      body: `A step-by-step look at every module — New Order, ${catalogWord}, Clients, Billing${hasInventory ? ', and Inventory' : ''}. About two minutes.`,
    },

    // --- New Order ---
    {
      module: 'New Order', icon: ShoppingCart, iconBg: 'bg-tile-peach-icon', iconFg: 'text-tile-peach-fg',
      title: 'Step 1 — Start a sale',
      body: 'Tap "New Order" on your dashboard (or press N anywhere on the Orders page) to open the order screen.',
    },
    {
      module: 'New Order', icon: Search, iconBg: 'bg-tile-peach-icon', iconFg: 'text-tile-peach-fg',
      title: 'Step 2 — Add items',
      body: 'Search by name, scan a barcode with a scanner gun, or tap the mic and just say what the customer wants.',
    },
    {
      module: 'New Order', icon: ListPlus, iconBg: 'bg-tile-peach-icon', iconFg: 'text-tile-peach-fg',
      title: 'Step 3 — Adjust the cart',
      body: 'Change quantity, unit, or price on any line before checkout — the total updates as you go.',
    },
    {
      module: 'New Order', icon: Send, iconBg: 'bg-tile-peach-icon', iconFg: 'text-tile-peach-fg',
      title: 'Step 4 — Submit',
      body: 'Tap "Submit Order" (or Ctrl+Enter) to save it. It shows up instantly in your Orders list, ready to bill.',
    },

    // --- Products / Medicines ---
    {
      module: catalogWord, icon: isPharmacy ? Pill : Package, iconBg: 'bg-tile-lavender-icon', iconFg: 'text-tile-lavender-fg',
      title: `Your ${catalogWord.toLowerCase()} catalog`,
      body: `Every ${itemWord} you sell lives here — name, price, unit, and ${hasInventory ? 'stock on hand' : 'category'}.`,
    },
    {
      module: catalogWord, icon: ListPlus, iconBg: 'bg-tile-lavender-icon', iconFg: 'text-tile-lavender-fg',
      title: 'Add or import',
      body: `Tap + to add one ${itemWord} at a time, or use Bulk Upload to import your whole catalog from a spreadsheet.`,
    },
    ...(hasInventory
      ? [{
          module: catalogWord, icon: BellRing, iconBg: 'bg-tile-lavender-icon', iconFg: 'text-tile-lavender-fg',
          title: 'Never run out',
          body: 'Set a reorder point per item — we notify you automatically once stock drops to or below it.',
        }]
      : []),

    // --- Clients ---
    {
      module: 'Clients', icon: Users, iconBg: 'bg-tile-sky-icon', iconFg: 'text-tile-sky-fg',
      title: 'Everyone you sell to',
      body: "Every customer's contact details, full order history, and outstanding balance in one profile.",
    },
    {
      module: 'Clients', icon: UserPlus, iconBg: 'bg-tile-sky-icon', iconFg: 'text-tile-sky-fg',
      title: 'Saved automatically',
      body: "Type a phone number and name while placing an order and we save them as a customer — no separate step needed.",
    },

    // --- Billing ---
    {
      module: 'Billing', icon: Wallet, iconBg: 'bg-tile-mint-icon', iconFg: 'text-tile-mint-fg',
      title: 'Collect payments',
      body: 'Mark an order fully paid, partially paid, or on credit — the Ledger keeps track either way.',
    },
    {
      module: 'Billing', icon: FileText, iconBg: 'bg-tile-mint-icon', iconFg: 'text-tile-mint-fg',
      title: 'Invoices',
      body: 'Every sale gets a proper invoice you can share straight to WhatsApp or print at the counter.',
    },
    {
      module: 'Billing', icon: Receipt, iconBg: 'bg-tile-mint-icon', iconFg: 'text-tile-mint-fg',
      title: 'The Ledger',
      body: "See who owes what at a glance from the Ledger tile, and chase overdue balances before they pile up.",
    },

    // --- Inventory (only if enabled) ---
    ...(hasInventory
      ? [
          {
            module: 'Inventory', icon: Warehouse, iconBg: 'bg-tile-peach-icon', iconFg: 'text-tile-peach-fg',
            title: 'Track your stock',
            body: 'The Inventory section (in the menu) shows exactly how much of each item you have on hand, updated with every sale.',
          },
          {
            module: 'Inventory', icon: Truck, iconBg: 'bg-tile-peach-icon', iconFg: 'text-tile-peach-fg',
            title: 'Purchase Orders',
            body: 'Raise a PO to a supplier when you need to restock — receiving it against a supplier updates your stock automatically.',
          },
          {
            module: 'Inventory', icon: BellRing, iconBg: 'bg-tile-peach-icon', iconFg: 'text-tile-peach-fg',
            title: 'Low-stock & expiry alerts',
            body: 'Anything low on stock or nearing its expiry date shows up right on your dashboard and in your notifications — nothing to check manually.',
          },
        ]
      : []),

    // --- Wrap up ---
    {
      module: 'Shortcuts', icon: Zap, iconBg: 'bg-tile-lavender-icon', iconFg: 'text-tile-lavender-fg',
      title: 'Power tip',
      body: 'Press N anywhere on Orders, Products, or Customers to jump straight into a new one — no mouse needed.',
    },
    {
      module: 'Done', icon: LayoutDashboard, iconBg: 'bg-tile-mint-icon', iconFg: 'text-tile-mint-fg',
      title: "That's every module",
      body: 'Deeper sales/tax reports and settings are in the menu. Come back to this tour anytime from the button on your dashboard.',
    },
  ];

  return steps;
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
  const isFirst = step === 0;
  const Icon = current.icon;
  // A new module starts here — used to insert a section divider label so a
  // long linear flow still reads as separate modules, not one undifferentiated list.
  const isNewModule = isFirst || current.module !== steps[step - 1].module;

  const close = () => {
    onOpenChange(false);
    // Reset for next time it's reopened (manually, via the "Take a tour" button).
    setTimeout(() => setStep(0), 200);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        <div className="p-6 pb-4 flex flex-col items-center text-center gap-4">
          {!isFirst && !isLast && isNewModule && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{current.module}</span>
          )}
          <div className={`${current.iconBg} ${current.iconFg} w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm`}>
            <Icon className="w-7 h-7" strokeWidth={2.25} />
          </div>
          <div className="space-y-1.5">
            <DialogTitle className="text-lg font-bold text-slate-800">{current.title}</DialogTitle>
            <DialogDescription className="text-sm text-slate-500 leading-relaxed">{current.body}</DialogDescription>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1 pb-4 px-6 flex-wrap">
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
