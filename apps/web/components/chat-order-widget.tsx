'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const EXAMPLE_BY_CATEGORY: Record<string, string> = {
  restaurant: '2 masala chai and a gulab jamun for table 3 — or say "takeaway"',
  grocery: '1kg rice, 2 packets atta and a bottle of oil',
  retail: '2 t-shirts and a pair of socks',
  pharmacy: '2 paracetamol tablets and a bottle of cough syrup',
  wholesale: '5 boxes of soap and 10 packets of biscuits',
  salesman: '3 cartons of detergent',
};

function greetingFor(category: string | null) {
  const example = (category && EXAMPLE_BY_CATEGORY[category]) || 'rice, sugar and a packet of tea';
  return `Tell me what to order, e.g. "${example}".`;
}

export function ChatOrderWidget({ businessId, businessCategory }: { businessId: string | null; businessCategory?: string | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: greetingFor(businessCategory ?? null) },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (businessCategory) {
      setMessages((prev) =>
        prev.length === 1 && prev[0].role === 'assistant'
          ? [{ role: 'assistant', text: greetingFor(businessCategory) }]
          : prev,
      );
    }
  }, [businessCategory]);

  useEffect(() => {
    if (open) {
      // Small delay so the sheet animation finishes before scrolling/focusing
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Prevent body scroll when sheet is open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !input.trim() || sending) return;

    const text = input.trim();
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);
    try {
      const res = await apiClient.post('/api/ai/chat-order', { businessId, message: text });
      setMessages((prev) => [...prev, { role: 'assistant', text: res.data.reply }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: err.response?.data?.message || 'Something went wrong placing that order.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (!businessId) return null;

  return (
    <>
      {/* ── Backdrop (covers everything including bottom nav) ── */}
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Chat panel ── */}
      <div
        className={[
          'fixed z-[70] flex flex-col bg-white transition-transform duration-300 ease-out',
          // Mobile: full-width bottom sheet, slides up
          'inset-x-0 bottom-0 rounded-t-2xl shadow-2xl',
          open ? 'translate-y-0' : 'translate-y-full',
          // Mobile height: uses dvh so keyboard doesn't clip it
          'h-[88dvh]',
          // Desktop: floating panel, always positioned, visibility toggled
          'md:inset-x-auto md:bottom-24 md:right-6',
          'md:w-[380px] md:h-[500px] md:max-h-[80vh]',
          'md:rounded-2xl md:ring-1 md:ring-slate-200',
          open ? 'md:opacity-100 md:pointer-events-auto' : 'md:opacity-0 md:pointer-events-none md:translate-y-4',
        ].join(' ')}
      >
        {/* Drag handle – mobile only */}
        <div className="md:hidden shrink-0 flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="shrink-0 bg-emerald-600 text-white px-4 py-3 flex items-center gap-3 md:rounded-t-2xl">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">Order Assistant</p>
            <p className="text-[11px] text-emerald-100 leading-tight">AI-powered ordering</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
          {messages.map((m, i) => (
            <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mb-0.5">
                  <Bot className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-sm'
                    : 'bg-white text-slate-700 ring-1 ring-slate-200 rounded-bl-sm'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-end gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mb-0.5">
                <Bot className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="bg-white ring-1 ring-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="shrink-0 bg-white border-t border-slate-100 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What would you like to order?"
            // 16px prevents iOS keyboard zoom
            className="flex-1 h-11 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-[16px] md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-transparent transition-colors"
            disabled={sending}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="h-11 w-11 flex items-center justify-center rounded-xl bg-emerald-600 text-white disabled:opacity-40 shrink-0 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* ── FAB – hidden on mobile when sheet is open ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Order Assistant"
        className={[
          'fixed z-50 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white',
          'shadow-lg shadow-emerald-900/30 flex items-center justify-center transition-all duration-200',
          'bottom-20 right-4 md:bottom-6 md:right-6',
          // Hide FAB on mobile while sheet is open (X is in header)
          open ? 'scale-0 opacity-0 md:scale-100 md:opacity-100' : 'scale-100 opacity-100',
        ].join(' ')}
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    </>
  );
}
