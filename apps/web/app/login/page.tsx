'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Package, ShoppingCart, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { getPostLoginPath, markJustLoggedIn } from '@/lib/auth';
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

export default function LoginPage() {
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 selection:bg-sky-500/30 relative overflow-hidden">
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
          <p className="text-slate-600 text-sm font-medium">Sign in to manage your business</p>
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
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Welcome back</h2>
          <p className="text-slate-600 font-medium text-sm mt-1 mb-6">
            {mode === 'password' ? 'Enter your credentials to access your account' : "We'll email you a one-time code"}
          </p>

          <div className="flex gap-1 bg-white/25 rounded-full p-1 mb-6 relative z-20 ring-1 ring-white/40 shadow-[inset_0_1px_3px_rgba(148,163,184,0.25)]">
            <button
              type="button"
              onClick={() => setMode('password')}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all cursor-pointer touch-manipulation ${
                mode === 'password'
                  ? `bg-sky-500/80 backdrop-blur-md text-white ${GLASS_SHEEN}`
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setMode('otp')}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all cursor-pointer touch-manipulation ${
                mode === 'otp'
                  ? `bg-violet-500/80 backdrop-blur-md text-white ${GLASS_SHEEN}`
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Email OTP
            </button>
          </div>

          {mode === 'password' ? <PasswordLoginForm /> : <OtpLoginForm />}

          <p className="text-center text-sm text-slate-600 mt-6">
            Don't have an account?{' '}
            <a href="/signup" className="font-semibold text-orange-600 hover:text-orange-700">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

const GLASS_INPUT =
  'bg-white/35 backdrop-blur-md border-transparent text-slate-800 font-medium placeholder:text-slate-500 h-14 rounded-full px-5 transition-all shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_3px_rgba(148,163,184,0.2)]';

function PasswordLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post('/auth/login', { email, password });

      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      markJustLoggedIn();
      router.push(getPostLoginPath(response.data.user.role, response.data.user.email));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <Input
        placeholder="name@example.com"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className={`${GLASS_INPUT} focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:bg-white/55`}
      />
      <div className="relative">
        <Input
          placeholder="••••••••"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={`pr-12 ${GLASS_INPUT} focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:bg-white/55`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 hover:text-sky-600 transition-colors focus:outline-none"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          )}
        </button>
      </div>

      <div className="flex justify-end -mt-1">
        <a href="/forgot-password" className="text-sm font-semibold text-sky-700 hover:text-sky-800">
          Forgot password?
        </a>
      </div>

      {error && (
        <div className="flex flex-col space-y-2 text-rose-700 bg-rose-500/15 backdrop-blur-sm p-3 rounded-2xl ring-1 ring-rose-400/30 text-sm animate-in slide-in-from-top-2">
          <p className="font-semibold">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        className={`w-full h-14 mt-2 rounded-full bg-sky-500/85 hover:bg-sky-500/95 backdrop-blur-md text-white font-semibold text-base ring-1 ring-white/40 transition-all active:scale-[0.98] shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.6),inset_0_-1px_1px_rgba(0,0,0,0.08),0_14px_28px_-8px_rgba(14,165,233,0.6)]`}
        disabled={loading}
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  );
}

function OtpLoginForm() {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post('/auth/otp/request', { email });
      setDevCode(response.data.devCode || '');
      setStep('verify');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post('/auth/otp/verify', { email, code });
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      markJustLoggedIn();
      router.push(getPostLoginPath(response.data.user.role, response.data.user.email));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'request') {
    return (
      <form onSubmit={handleRequest} className="space-y-4">
        <Input
          placeholder="name@example.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={`${GLASS_INPUT} focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:bg-white/55`}
        />
        {error && (
          <div className="flex items-center space-x-2 text-rose-700 bg-rose-500/15 backdrop-blur-sm p-3 rounded-2xl ring-1 ring-rose-400/30 text-sm">
            <p className="font-semibold">{error}</p>
          </div>
        )}
        <Button
          type="submit"
          className="w-full h-14 mt-2 rounded-full bg-violet-500/85 hover:bg-violet-500/95 backdrop-blur-md text-white font-semibold text-base ring-1 ring-white/40 transition-all active:scale-[0.98] shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.6),inset_0_-1px_1px_rgba(0,0,0,0.08),0_14px_28px_-8px_rgba(139,92,246,0.6)]"
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send Code'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="space-y-4">
      <p className="text-sm text-slate-600">
        Enter the 6-digit code we sent to <span className="font-semibold text-slate-800">{email}</span>.
      </p>
      {devCode && (
        <p className="text-xs text-amber-800 bg-amber-500/15 backdrop-blur-sm ring-1 ring-amber-400/30 rounded-2xl p-3">
          Dev mode (no email provider configured yet): your code is <span className="font-mono font-bold">{devCode}</span>
        </p>
      )}
      <Input
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        maxLength={6}
        className={`text-center text-xl font-mono tracking-widest ${GLASS_INPUT} focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:bg-white/55`}
      />
      {error && (
        <div className="flex items-center space-x-2 text-rose-700 bg-rose-500/15 backdrop-blur-sm p-3 rounded-2xl ring-1 ring-rose-400/30 text-sm">
          <p className="font-semibold">{error}</p>
        </div>
      )}
      <Button
        type="submit"
        className="w-full h-14 mt-2 rounded-full bg-violet-500/85 hover:bg-violet-500/95 backdrop-blur-md text-white font-semibold text-base ring-1 ring-white/40 transition-all active:scale-[0.98] shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.6),inset_0_-1px_1px_rgba(0,0,0,0.08),0_14px_28px_-8px_rgba(139,92,246,0.6)]"
        disabled={loading}
      >
        {loading ? 'Verifying...' : 'Verify & Sign In'}
      </Button>
      <button
        type="button"
        onClick={() => setStep('request')}
        className="w-full text-sm text-slate-600 hover:text-slate-800"
      >
        Use a different email
      </button>
    </form>
  );
}
