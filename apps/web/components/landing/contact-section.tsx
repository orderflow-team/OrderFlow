'use client';

import { useState } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CONTACT_URL } from '@/lib/mailer-client';

const GLASS_SHEEN =
  'shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-1px_1px_rgba(255,255,255,0.15),0_20px_45px_-15px_rgba(15,23,42,0.25)]';

const BUSINESS_CATEGORIES = [
  { value: 'grocery', label: 'Grocery Store' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'salesman', label: 'Salesman Order Collection' },
  { value: 'other', label: 'Other' },
];

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function ContactSection() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(CONTACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, businessCategory, message }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to send message');
      }

      setStatus('success');
      setName('');
      setEmail('');
      setBusinessCategory('');
      setMessage('');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="grid lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-5">
        <p className="text-xs font-bold tracking-[0.2em] text-emerald-700 uppercase mb-3">Get In Touch</p>
        <h2 style={{ fontFamily: 'var(--font-fraunces)' }} className="text-4xl font-medium text-slate-900 max-w-md">
          Questions before you sign up?
        </h2>
        <p className="mt-4 text-lg text-slate-600 max-w-md">
          Tell us about your business and what you&apos;re trying to solve — we&apos;ll get back to you by email.
        </p>
        <div className="mt-6 flex items-center gap-3 text-sm text-slate-500 font-medium">
          <Mail className="w-4 h-4 text-emerald-600" />
          <span>We usually reply within one business day.</span>
        </div>
      </div>

      <div
        className={`lg:col-span-7 rounded-[2.5rem] bg-white/70 backdrop-blur-xl ring-1 ring-white/80 p-7 sm:p-9 ${GLASS_SHEEN}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-12 rounded-2xl px-4"
            />
            <Input
              type="email"
              placeholder="you@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 rounded-2xl px-4"
            />
          </div>

          <Select value={businessCategory} onValueChange={setBusinessCategory}>
            <SelectTrigger className="h-12 w-full rounded-2xl px-4 justify-between">
              <SelectValue>
                {(value: string) =>
                  BUSINESS_CATEGORIES.find((c) => c.value === value)?.label ?? 'Select your business category'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <textarea
            placeholder="What are you looking to do?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={4}
            className="w-full rounded-2xl border border-transparent bg-white/35 backdrop-blur-md px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none transition-all focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:bg-white/55 resize-none"
          />

          {status === 'success' && (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-500/15 p-3 rounded-2xl ring-1 ring-emerald-400/30 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Thanks — your message has been sent. We&apos;ll be in touch soon.</span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-rose-700 bg-rose-500/15 p-3 rounded-2xl ring-1 ring-rose-400/30 text-sm font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'submitting' || !businessCategory}
            className={`inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all ring-1 ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed ${GLASS_SHEEN}`}
          >
            {status === 'submitting' ? 'Sending...' : (
              <>
                Send message <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
