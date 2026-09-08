'use client';

import { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
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
  return `Tell me what to order, e.g. "${item}". You can also name who it's for, e.g. "order for Neel, ${named}".`;
}

const REPORT_GREETING =
  `👋 Ask me for any live business or financial report! For example:\n` +
  `• "Remaining payment of supplier" or "Supplier dues"\n` +
  `• "Customer dues" or "Pending balances"\n` +
  `• "Today's sales summary"\n` +
  `• "Low stock report" or "Inventory alert"\n` +
  `• "Financial summary"`;

interface EditingOrderInfo {
  id: string;
  orderNumber: string;
}

interface PendingCustomer {
  customerName: string | null;
  phone: string | null;
}

type AssistantMode = 'order' | 'report';

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
  }, [orderMessages, reportMessages]);

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
        err.response?.data?.message || (mode === 'order' ? 'Something went wrong placing that order.' : 'Could not generate report.');
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
    { label: 'Supplier Dues', icon: Building2, query: 'remaining payment of supplier' },
    { label: 'Customer Dues', icon: Users, query: 'customer dues report' },
    { label: "Today's Sales", icon: TrendingUp, query: "today's sales" },
    { label: 'Low Stock', icon: AlertTriangle, query: 'low stock report' },
    { label: 'Financials', icon: Wallet, query: 'financial summary' },
  ];

  const orderChips = [
    { label: '+ Takeaway', query: 'takeaway order' },
    { label: '📋 Menu', query: "what's on the menu?" },
    { label: '📍 Location', query: 'where is the shop located?' },
    { label: 'Table Status', query: 'table status' },
  ];

  if (!businessId) return null;

  return (
    <>
      {/* ── Backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Chat panel ── */}
      <div
        className={[
          'fixed z-[70] flex flex-col bg-white/50 backdrop-blur-3xl backdrop-saturate-150 glass-sheen-sm transition-transform duration-300 ease-out',
          'inset-x-0 bottom-0 rounded-t-2xl shadow-2xl',
          open ? 'translate-y-0' : 'translate-y-full',
          'h-[88dvh]',
          'md:inset-x-auto md:bottom-24 md:right-6',
          'md:w-[410px] md:h-[560px] md:max-h-[82vh]',
          'md:rounded-[2rem] md:ring-1 md:ring-white/60',
          open ? 'md:opacity-100 md:pointer-events-auto' : 'md:opacity-0 md:pointer-events-none md:translate-y-4',
        ].join(' ')}
      >
        {/* Drag handle – mobile only */}
        <div className="md:hidden shrink-0 flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div
          className={`shrink-0 px-4 py-3 flex flex-col gap-2.5 text-white transition-colors duration-300 md:rounded-t-[2rem] ${
            mode === 'order'
              ? 'bg-emerald-600/90 backdrop-blur-xl'
              : 'bg-indigo-600/90 backdrop-blur-xl'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">
                {mode === 'order' ? 'Obix Order Assistant' : 'Obix Report Assistant'}
              </p>
              <p className="text-[11px] opacity-90 leading-tight">
                {mode === 'order' ? 'AI Voice & Text Ordering' : 'Live Supplier & Business Reports'}
              </p>
            </div>
            <button
              onClick={handleClearHistory}
              title="Reset conversation"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="bg-black/20 p-1 rounded-xl flex items-center gap-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setMode('order')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                mode === 'order'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Order Assistant
            </button>
            <button
              type="button"
              onClick={() => setMode('report')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                mode === 'report'
                  ? 'bg-white text-indigo-800 shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Report Assistant
            </button>
          </div>
        </div>

        {/* Active Order Editing Banner */}
        {mode === 'order' && editingOrder && (
          <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-800 font-medium">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="truncate">Editing Order: <strong className="font-bold">#{editingOrder.orderNumber}</strong></span>
            </div>
            <button
              onClick={() => setEditingOrder(null)}
              className="text-[10px] text-amber-600 hover:text-amber-700 bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 rounded-full transition-colors font-bold shrink-0 ml-2"
            >
              Start New
            </button>
          </div>
        )}

        {/* Pending Customer Banner */}
        {mode === 'order' && !editingOrder && pendingCustomer?.customerName && (
          <div className="shrink-0 bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-800 font-medium">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="truncate">
                Next order for: <strong className="font-bold">{pendingCustomer.customerName}</strong>
                {pendingCustomer.phone ? ` (${pendingCustomer.phone})` : ''}
              </span>
            </div>
            <button
              onClick={() => setPendingCustomer(null)}
              className="text-[10px] text-emerald-600 hover:text-emerald-700 bg-emerald-500/20 hover:bg-emerald-500/30 px-2 py-0.5 rounded-full transition-colors font-bold shrink-0 ml-2"
            >
              Clear
            </button>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="shrink-0 bg-slate-50/70 border-b border-slate-200/50 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(mode === 'report' ? reportChips : orderChips).map((chip, idx) => {
            const Icon = (chip as any).icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => sendQuery(chip.query)}
                disabled={sending}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 ring-1 ring-slate-200/70 shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                {Icon && <Icon className="w-3 h-3 text-slate-500" />}
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {activeMessages.map((m, i) => (
            <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-0.5 ${
                    mode === 'order' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-indigo-500/15 text-indigo-600'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? mode === 'order'
                      ? 'bg-emerald-600/90 backdrop-blur-md text-white rounded-br-sm shadow-sm ring-1 ring-emerald-500/50'
                      : 'bg-indigo-600/90 backdrop-blur-md text-white rounded-br-sm shadow-sm ring-1 ring-indigo-500/50'
                    : 'bg-white/80 backdrop-blur-md text-slate-800 ring-1 ring-slate-200/60 rounded-bl-sm shadow-sm font-sans'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-end gap-2 justify-start">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-0.5 ${
                  mode === 'order' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-indigo-500/15 text-indigo-600'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-white/80 backdrop-blur-md ring-1 ring-slate-200/60 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSend}
          className="shrink-0 bg-white/40 border-t border-slate-200/50 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'order'
                ? 'e.g. 2 tea and 1 samosa for table 3...'
                : 'e.g. remaining payment of supplier / today sales...'
            }
            className="flex-1 h-11 rounded-full border border-transparent bg-white/60 backdrop-blur-md px-4 text-[16px] md:text-sm ring-1 ring-slate-200 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-400/70 text-slate-800 placeholder-slate-400"
            disabled={sending}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className={`h-11 w-11 flex items-center justify-center rounded-full text-white disabled:opacity-40 shrink-0 transition-opacity ring-1 shadow-sm ${
              mode === 'order'
                ? 'bg-emerald-600/90 ring-emerald-500/50 hover:bg-emerald-600'
                : 'bg-indigo-600/90 ring-indigo-500/50 hover:bg-indigo-600'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* ── FAB Button with Multi-Assistant Visual ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Order & Report Assistant"
        className={[
          'fixed z-50 w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 backdrop-blur-md ring-2 ring-white/50 glass-sheen-sm hover:brightness-105 text-white',
          'shadow-lg shadow-indigo-900/30 flex items-center justify-center transition-all duration-200',
          'bottom-20 right-4 md:bottom-6 md:right-6',
          open ? 'scale-0 opacity-0 md:scale-100 md:opacity-100' : 'scale-100 opacity-100',
        ].join(' ')}
      >
        <div className="relative">
          <MessageCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-white animate-pulse" />
        </div>
      </button>
    </>
  );
}
