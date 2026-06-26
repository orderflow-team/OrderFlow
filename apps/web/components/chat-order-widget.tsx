'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
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

  // The category usually arrives a beat after mount (fetched by the parent); refresh
  // the example in the untouched greeting once it's known instead of showing a generic one.
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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

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
      {open && (
        <div className="fixed bottom-40 md:bottom-24 right-4 md:right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[480px] max-h-[60vh] md:max-h-[80vh] bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 flex flex-col overflow-hidden">
          <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <span className="font-semibold text-sm">Order Assistant</span>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white text-slate-400 ring-1 ring-slate-200 rounded-xl px-3 py-2 text-sm">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-3 border-t border-slate-100 flex gap-2 shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What would you like to order?"
              className="flex-1 h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="h-10 w-10 flex items-center justify-center rounded-lg bg-emerald-600 text-white disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30 flex items-center justify-center transition-transform hover:scale-105"
        title="Order Assistant"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  );
}
