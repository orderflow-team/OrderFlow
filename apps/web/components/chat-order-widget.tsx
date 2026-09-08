'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Bot,
  ShoppingCart,
  BarChart3,
  RotateCcw,
  Building2,
  Users,
  TrendingUp,
  AlertTriangle,
  Wallet,
  Receipt,
  Package,
  Layers,
  FileSpreadsheet,
  Sparkles,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

const EXAMPLE_BY_CATEGORY: Record<string, { item: string; named: string }> = {
  restaurant: { item: '2 masala chai and a gulab jamun for table 3 — or say "takeaway"', named: '2 masala chai and a gulab jamun' },
  grocery: { item: '1kg rice, 2 packets atta and a bottle of oil', named: '1kg rice and a bottle of oil' },
  retail: { item: '2 t-shirts and a pair of socks', named: '2 t-shirts' },
  pharmacy: { item: '2 paracetamol tablets and a bottle of cough syrup', named: '2 paracetamol tablets' },
  wholesale: { item: '5 boxes of soap and 10 packets of biscuits', named: '5 boxes of soap' },
  salesman: { item: '3 cartons of detergent', named: '3 cartons of detergent' },
};

function orderGreetingFor(category: string | null) {
  const { item, named } = (category && EXAMPLE_BY_CATEGORY[category]) || { item: 'rice, sugar and a packet of tea', named: 'rice and sugar' };
  return `👋 **Welcome to Obix Order Assistant!**\n\nTell me what you'd like to order, e.g.:\n• "${item}"\n• "Order for Neel, ${named}"\n• "Takeaway order for 2 tea"`;
}

const REPORT_GREETING =
  `👋 **Welcome to Obix Report Assistant!**\n\nAsk me for any live financial or business intelligence report in natural language:\n\n` +
  `• 🏢 **Supplier Balances:** "Remaining payment of supplier" or "Top suppliers"\n` +
  `• 👥 **Customer Dues:** "Customer dues report" or "Outstanding balances"\n` +
  `• 📈 **Sales Intelligence:** "Today's sales", "Weekly sales", or "Monthly revenue"\n` +
  `• 💰 **Profit & Loss:** "Profit report", "Net margins", or "Top profit products"\n` +
  `• 💸 **Expenses:** "Expense breakdown" or "Recent purchase expenses"\n` +
  `• 🧾 **GST & Tax:** "GST report" or "GSTR 1 summary"\n` +
  `• 📦 **Inventory Health:** "Low stock alert", "Stock valuation", or "Dead stock"`;

interface EditingOrderInfo {
  id: string;
  orderNumber: string;
}

interface PendingCustomer {
  customerName: string | null;
  phone: string | null;
}

type AssistantMode = 'order' | 'report';

/** Formats text with bold (*text* / **text**), bullet points, and currency badge highlights */
function FormattedMessage({ text, mode }: { text: string; mode: AssistantMode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = text.split('\n');

  return (
    <div className="relative group/msg">
      <div className="space-y-1.5 text-[13.5px] leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }

          const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('* ');
          const content = isBullet ? trimmed.replace(/^([•\-\*]\s*)/, '') : trimmed;

          // Parse **bold** or *bold* and ₹ amounts
          const parts = content.split(/(\*\*.*?\*\*|\*.*?\*|₹[\d,]+(?:\.\d+)?)/g);

          return (
            <div key={idx} className={`flex items-start gap-2 ${isBullet ? 'pl-2' : ''}`}>
              {isBullet && (
                <span className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                  mode === 'order' ? 'bg-emerald-500' : 'bg-indigo-500'
                }`} />
              )}
              <div className="flex-1 min-w-0">
                {parts.map((part, pIdx) => {
                  if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('*') && part.endsWith('*') && part.length > 2)) {
                    const clean = part.replace(/^\*+|\*+$/g, '');
                    return (
                      <strong key={pIdx} className="font-bold text-slate-900 dark:text-white">
                        {clean}
                      </strong>
                    );
                  }
                  if (part.startsWith('₹')) {
                    return (
                      <span
                        key={pIdx}
                        className="inline-flex items-center px-1.5 py-0.5 rounded font-bold font-mono text-[12px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                      >
                        {part}
                      </span>
                    );
                  }
                  return <span key={pIdx}>{part}</span>;
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleCopy}
        title="Copy response"
        className="opacity-0 group-hover/msg:opacity-100 transition-opacity absolute top-0 right-0 p-1 rounded-lg bg-slate-200/60 hover:bg-slate-300/80 text-slate-600 text-xs flex items-center gap-1 backdrop-blur-sm"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

export function ChatOrderWidget({ businessId, businessCategory }: { businessId: string | null; businessCategory?: string | null }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>('order');

  // Separate chat histories for Order vs Report mode
  const [orderMessages, setOrderMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: orderGreetingFor(businessCategory ?? null) },
  ]);
  const [reportMessages, setReportMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: REPORT_GREETING },
  ]);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [editingOrder, setEditingOrder] = useState<EditingOrderInfo | null>(null);
  const [pendingCustomer, setPendingCustomer] = useState<PendingCustomer | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeMessages = mode === 'order' ? orderMessages : reportMessages;

  useEffect(() => {
    const openAssistant = (e: any) => {
      setOpen(true);
      if (e?.detail?.mode === 'report') {
        setMode('report');
      } else if (e?.detail?.mode === 'order') {
        setMode('order');
      }
    };
    window.addEventListener('open-order-assistant', openAssistant);
    return () => window.removeEventListener('open-order-assistant', openAssistant);
  }, []);

  useEffect(() => {
    const handleSetActiveOrder = (e: CustomEvent<{ id: string | null; orderNumber?: string | null }>) => {
      if (e.detail.id && e.detail.orderNumber) {
        setEditingOrder({ id: e.detail.id, orderNumber: e.detail.orderNumber });
        setMode('order');
        setOpen(true);
      } else {
        setEditingOrder(null);
      }
    };
    window.addEventListener('set-active-order-id' as any, handleSetActiveOrder);
    return () => window.removeEventListener('set-active-order-id' as any, handleSetActiveOrder);
  }, []);

  useEffect(() => {
    if (businessCategory) {
      setOrderMessages((prev) =>
        prev.length === 1 && prev[0].role === 'assistant'
          ? [{ role: 'assistant', text: orderGreetingFor(businessCategory) }]
          : prev,
      );
    }
  }, [businessCategory]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(t);
    }
  }, [open, mode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [orderMessages, reportMessages, sending]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const sendQuery = async (queryText: string) => {
    if (!businessId || !queryText.trim() || sending) return;

    const text = queryText.trim();
    if (mode === 'order') {
      setOrderMessages((prev) => [...prev, { role: 'user', text }]);
    } else {
      setReportMessages((prev) => [...prev, { role: 'user', text }]);
    }
    setInput('');
    setSending(true);

    try {
      const res = await apiClient.post('/api/ai/chat-order', {
        businessId,
        message: text,
        orderId: mode === 'order' ? editingOrder?.id || undefined : undefined,
        pendingCustomer: mode === 'order' ? pendingCustomer || undefined : undefined,
      });

      const replyText = res.data.reply || 'No response received.';
      if (mode === 'order') {
        setOrderMessages((prev) => [...prev, { role: 'assistant', text: replyText }]);
        if ('pendingCustomer' in res.data) {
          setPendingCustomer(res.data.pendingCustomer);
        }
      } else {
        setReportMessages((prev) => [...prev, { role: 'assistant', text: replyText }]);
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message || (mode === 'order' ? '⚠️ Something went wrong processing that order.' : '⚠️ Could not generate report.');
      if (mode === 'order') {
        setOrderMessages((prev) => [...prev, { role: 'assistant', text: errorMsg }]);
      } else {
        setReportMessages((prev) => [...prev, { role: 'assistant', text: errorMsg }]);
      }
    } finally {
      setSending(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuery(input);
  };

  const handleClearHistory = () => {
    if (mode === 'order') {
      setOrderMessages([{ role: 'assistant', text: orderGreetingFor(businessCategory ?? null) }]);
      setEditingOrder(null);
      setPendingCustomer(null);
    } else {
      setReportMessages([{ role: 'assistant', text: REPORT_GREETING }]);
    }
  };

  const reportChips = [
    { label: '🏢 Supplier Dues', icon: Building2, query: 'remaining payment of supplier' },
    { label: '👥 Customer Dues', icon: Users, query: 'customer dues report' },
    { label: "📈 Today's Sales", icon: TrendingUp, query: "today's sales" },
    { label: '💰 Profit Report', icon: Wallet, query: 'profit report' },
    { label: '🧾 GST Report', icon: Receipt, query: 'gst report' },
    { label: '💸 Expenses', icon: Wallet, query: 'expense report' },
    { label: '⚠️ Low Stock', icon: AlertTriangle, query: 'low stock report' },
    { label: '📦 Stock Valuation', icon: Package, query: 'inventory valuation' },
    { label: '🔥 Top Products', icon: Layers, query: 'top products' },
    { label: '📋 All Reports', icon: FileSpreadsheet, query: 'all reports' },
  ];

  const orderChips = [
    { label: '+ Takeaway Order', query: 'takeaway order' },
    { label: '📋 What is on Menu?', query: "what's on the menu?" },
    { label: '🍽️ Table Status', query: 'table status' },
    { label: '📍 Shop Location', query: 'where is the shop located?' },
  ];

  if (!businessId) return null;

  return (
    <>
      {/* ── Backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm transition-opacity duration-200"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Chat Window ── */}
      <div
        className={[
          'fixed z-[70] flex flex-col bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 ease-out border border-slate-200/80 dark:border-slate-800',
          'inset-x-0 bottom-0 rounded-t-[2rem]',
          open ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none',
          'h-[88dvh]',
          'md:inset-x-auto md:bottom-24 md:right-6',
          'md:w-[440px] md:h-[620px] md:max-h-[85vh]',
          'md:rounded-[2.25rem] md:ring-1 md:ring-white/30 dark:md:ring-slate-700/50',
        ].join(' ')}
      >
        {/* Mobile Pull Tab */}
        <div className="md:hidden shrink-0 flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* ── Header ── */}
        <div
          className={`shrink-0 px-4 pt-3 pb-3 flex flex-col gap-3 text-white transition-all duration-300 md:rounded-t-[2.25rem] shadow-md ${
            mode === 'order'
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700'
              : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700'
          }`}
        >
          {/* Top Bar inside Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner border border-white/30">
                {mode === 'order' ? (
                  <ShoppingCart className="w-5 h-5 text-white" />
                ) : (
                  <BarChart3 className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-extrabold text-sm leading-tight text-white tracking-tight truncate">
                    {mode === 'order' ? 'Obix Order Assistant' : 'Obix Report Assistant'}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/25 text-white uppercase tracking-wider">
                    <Sparkles className="w-2.5 h-2.5" /> AI
                  </span>
                </div>
                <p className="text-[11px] text-white/80 leading-tight truncate mt-0.5">
                  {mode === 'order' ? 'Voice & Text POS Ordering' : 'Live Supplier, Dues & Business Reports'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleClearHistory}
                title="Reset conversation"
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/25 text-white/90 hover:text-white transition-all active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Close"
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/25 text-white/90 hover:text-white transition-all active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Segmented Tab Switcher ── */}
          <div className="bg-black/25 p-1 rounded-2xl flex items-center gap-1 border border-white/10 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setMode('order')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-extrabold transition-all duration-200 ${
                mode === 'order'
                  ? 'bg-white text-emerald-900 shadow-md scale-[1.02]'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Order Assistant</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('report')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-extrabold transition-all duration-200 ${
                mode === 'report'
                  ? 'bg-white text-indigo-900 shadow-md scale-[1.02]'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Report Assistant</span>
            </button>
          </div>
        </div>

        {/* ── Active Order Banner ── */}
        {mode === 'order' && editingOrder && (
          <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 font-medium">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="truncate">Active Order: <strong className="font-bold">#{editingOrder.orderNumber}</strong></span>
            </div>
            <button
              onClick={() => setEditingOrder(null)}
              className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1 rounded-lg transition-colors font-bold shrink-0 ml-2"
            >
              Start New Order
            </button>
          </div>
        )}

        {/* ── Pending Customer Banner ── */}
        {mode === 'order' && !editingOrder && pendingCustomer?.customerName && (
          <div className="shrink-0 bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-medium">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="truncate">
                Customer: <strong className="font-bold">{pendingCustomer.customerName}</strong>
                {pendingCustomer.phone ? ` (${pendingCustomer.phone})` : ''}
              </span>
            </div>
            <button
              onClick={() => setPendingCustomer(null)}
              className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors font-bold shrink-0 ml-2"
            >
              Clear
            </button>
          </div>
        )}

        {/* ── Quick Action Suggestion Chips ── */}
        <div className="shrink-0 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(mode === 'report' ? reportChips : orderChips).map((chip, idx) => {
            const Icon = (chip as any).icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => sendQuery(chip.query)}
                disabled={sending}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {Icon && <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Chat Messages Stream ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/30">
          {activeMessages.map((m, i) => (
            <div key={i} className={`flex items-end gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mb-1 shadow-sm ${
                    mode === 'order'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${
                  m.role === 'user'
                    ? mode === 'order'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-sm shadow-emerald-600/20'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-sm shadow-indigo-600/20'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 rounded-bl-sm'
                }`}
              >
                {m.role === 'assistant' ? (
                  <FormattedMessage text={m.text} mode={mode} />
                ) : (
                  <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap font-medium">{m.text}</p>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex items-end gap-2.5 justify-start">
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mb-1 shadow-sm ${
                  mode === 'order'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                }`}
              >
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center shadow-sm">
                <span className={`w-2 h-2 rounded-full animate-bounce [animation-delay:0ms] ${mode === 'order' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                <span className={`w-2 h-2 rounded-full animate-bounce [animation-delay:150ms] ${mode === 'order' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                <span className={`w-2 h-2 rounded-full animate-bounce [animation-delay:300ms] ${mode === 'order' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
              </div>
            </div>
          )}
        </div>

        {/* ── Input Bar ── */}
        <form
          onSubmit={handleSend}
          className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-3 pb-[calc(0.85rem+env(safe-area-inset-bottom))] flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                mode === 'order'
                  ? 'Type an order, e.g. 2 tea, 1 samosa for Table 3...'
                  : 'Ask a report, e.g. remaining payment of supplier...'
              }
              className={`w-full h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 text-[14px] text-slate-900 dark:text-slate-100 placeholder-slate-400 border border-transparent focus:border-slate-300 dark:focus:border-slate-600 focus:outline-none focus:ring-2 transition-all ${
                mode === 'order' ? 'focus:ring-emerald-500/40' : 'focus:ring-indigo-500/40'
              }`}
              disabled={sending}
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className={`h-11 w-11 flex items-center justify-center rounded-2xl text-white disabled:opacity-40 shrink-0 transition-all duration-200 shadow-md active:scale-95 ${
              mode === 'order'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/20'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/20'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* ── FAB Floating Assistant Launcher ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Order and Report Assistant"
        className={[
          'fixed z-50 rounded-full text-white backdrop-blur-md ring-2 ring-white/60 dark:ring-slate-700/60 shadow-xl transition-all duration-300 group',
          'bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 hover:scale-105 active:scale-95',
          'bottom-20 right-4 md:bottom-6 md:right-6',
          'flex items-center gap-2.5 px-4 py-3.5 md:px-5 md:py-3.5',
          open ? 'scale-0 opacity-0 md:scale-100 md:opacity-100' : 'scale-100 opacity-100',
        ].join(' ')}
      >
        <div className="relative flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-white animate-pulse" />
        </div>
        <span className="text-xs font-extrabold tracking-wide text-white hidden sm:inline">
          AI Assistant
        </span>
      </button>
    </>
  );
}
