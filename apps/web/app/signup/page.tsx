'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Package, ShoppingCart, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { ObixMark } from '@/components/obix-logo';

const BRAND_TILES = [
  { icon: Users, fg: 'text-tile-peach-fg' },
  { icon: Package, fg: 'text-tile-lavender-fg' },
  { icon: ShoppingCart, fg: 'text-tile-sky-fg' },
  { icon: Receipt, fg: 'text-tile-mint-fg' },
];

// Shared "liquid glass" treatment: a bright inset highlight along the top edge
// (simulating light catching the curved surface of the glass), a faint inset
// shade along the bottom (glass thickness), and a soft diffused drop shadow.
const GLASS_SHEEN =
  'shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-1px_1px_rgba(255,255,255,0.15),0_20px_45px_-15px_rgba(15,23,42,0.25)]';

const GLASS_INPUT =
  'bg-white/35 backdrop-blur-md border-transparent text-slate-800 font-medium placeholder:text-slate-500 h-14 rounded-full px-5 transition-all shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_3px_rgba(148,163,184,0.2)]';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/auth/signup', { fullName, email, password });
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      router.push('/select-business');
    } catch (err: any) {
      if (!err.response) {
        setError('Network error: Could not connect to the server');
      } else {
        const msg = err.response.data?.message;
        if (Array.isArray(msg)) {
          setError(msg.join(', '));
        } else if (typeof msg === 'string') {
          setError(msg);
        } else {
          setError('Could not create account');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 selection:bg-orange-500/30 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85vw] h-[75vh] max-w-[70rem] max-h-[45rem] min-w-[36rem] min-h-[28rem] rounded-full bg-sky-300/55 blur-3xl" />
        <div className="absolute -top-1/4 -left-1/4 w-[55vw] h-[55vw] max-w-[42rem] max-h-[42rem] min-w-[26rem] min-h-[26rem] rounded-full bg-orange-300/60 blur-3xl" />
        <div className="absolute -top-1/4 -right-1/4 w-[55vw] h-[55vw] max-w-[42rem] max-h-[42rem] min-w-[26rem] min-h-[26rem] rounded-full bg-violet-300/60 blur-3xl" />
      </div>
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-700 relative z-10">
        <div className="flex flex-col items-center mb-8 space-y-2">
          <ObixMark className="w-16 h-16 drop-shadow-[0_8px_20px_rgba(15,23,42,0.18)] transition-transform hover:scale-105" />
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 mt-4">OBIX</h1>
          <p className="text-[10px] tracking-[0.2em] text-slate-500 font-semibold uppercase">Order Billing Inventory eXperience</p>
          <p className="text-slate-600 text-sm font-medium">Create your account to get started</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {BRAND_TILES.map(({ icon: Icon, fg }, i) => (
              <div
                key={i}
                className={`w-10 h-10 rounded-full flex items-center justify-center bg-white/25 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/50 ${fg} ${GLASS_SHEEN}`}
              >
                <Icon className="w-4 h-4" strokeWidth={2.25} />
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-[2.5rem] bg-white/25 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/50 p-7 ${GLASS_SHEEN}`}>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Create account</h2>
          <p className="text-slate-600 font-medium text-sm mt-1 mb-6">You'll set up your business workspace right after.</p>

          <form onSubmit={handleSignup} className="space-y-4">
            <Input
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className={`${GLASS_INPUT} focus-visible:ring-2 focus-visible:ring-orange-400/70 focus-visible:bg-white/55`}
            />
            <Input
              placeholder="name@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`${GLASS_INPUT} focus-visible:ring-2 focus-visible:ring-orange-400/70 focus-visible:bg-white/55`}
            />
            <div className="relative">
              <Input
                placeholder="Password (min 6 characters)"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={`pr-12 ${GLASS_INPUT} focus-visible:ring-2 focus-visible:ring-orange-400/70 focus-visible:bg-white/55`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 hover:text-orange-600 transition-colors focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-rose-700 bg-rose-500/15 backdrop-blur-sm p-3 rounded-2xl ring-1 ring-rose-400/30 text-sm animate-in slide-in-from-top-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 flex-shrink-0"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <p className="font-semibold">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-14 mt-2 rounded-full bg-orange-500/85 hover:bg-orange-500/95 backdrop-blur-md text-white font-semibold text-base ring-1 ring-white/40 transition-all active:scale-[0.98] shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.6),inset_0_-1px_1px_rgba(0,0,0,0.08),0_14px_28px_-8px_rgba(251,146,60,0.6)]"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
          <p className="text-center text-sm text-slate-600 mt-6">
            Already have an account?{' '}
            <a href="/login" className="font-semibold text-sky-600 hover:text-sky-700">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
