'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import apiClient from '@/lib/api-client';

export default function LoginPage() {
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.2),rgba(255,255,255,0))] p-4 selection:bg-emerald-500/30">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-700 relative z-10">
        <div className="flex flex-col items-center mb-8 space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 transform transition-transform hover:scale-105 hover:rotate-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-white">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-4">OrderFlow</h1>
          <p className="text-slate-600 text-sm font-medium">Sign in to manage your business</p>
        </div>

        <Card className="border-slate-200 bg-white shadow-xl p-2 rounded-3xl">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</CardTitle>
            <CardDescription className="text-slate-600 font-medium">
              {mode === 'password' ? 'Enter your credentials to access your account' : "We'll email you a one-time code"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1 mb-6 relative z-20">
              <button
                type="button"
                onClick={() => setMode('password')}
                className={`py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer touch-manipulation ${
                  mode === 'password' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setMode('otp')}
                className={`py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer touch-manipulation ${
                  mode === 'otp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Email OTP
              </button>
            </div>

            {mode === 'password' ? <PasswordLoginForm /> : <OtpLoginForm />}

            <p className="text-center text-sm text-slate-500 mt-6">
              Don't have an account?{' '}
              <a href="/signup" className="font-semibold text-emerald-600 hover:text-emerald-700">
                Sign up
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      <Input
        placeholder="name@example.com"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="bg-slate-50 border-slate-300 text-slate-900 font-medium placeholder:text-slate-500 focus-visible:ring-emerald-600 focus-visible:border-emerald-600 focus-visible:bg-white h-12 rounded-xl transition-all shadow-sm"
      />
      <div className="relative">
        <Input
          placeholder="••••••••"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="pr-10 bg-slate-50 border-slate-300 text-slate-900 font-medium placeholder:text-slate-500 focus-visible:ring-emerald-600 focus-visible:border-emerald-600 focus-visible:bg-white h-12 rounded-xl transition-all shadow-sm"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-3.5 h-5 w-5 text-slate-500 hover:text-emerald-600 transition-colors focus:outline-none"
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
        <div className="flex items-center space-x-2 text-rose-700 bg-rose-100 p-3 rounded-xl border border-rose-200 text-sm animate-in slide-in-from-top-2">
          <p className="font-semibold">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-12 mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
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
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'request') {
    return (
      <form onSubmit={handleRequest} className="space-y-5">
        <Input
          placeholder="name@example.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="bg-slate-50 border-slate-300 text-slate-900 font-medium placeholder:text-slate-500 focus-visible:ring-emerald-600 focus-visible:border-emerald-600 focus-visible:bg-white h-12 rounded-xl transition-all shadow-sm"
        />
        {error && (
          <div className="flex items-center space-x-2 text-rose-700 bg-rose-100 p-3 rounded-xl border border-rose-200 text-sm">
            <p className="font-semibold">{error}</p>
          </div>
        )}
        <Button
          type="submit"
          className="w-full h-12 mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send Code'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerify} className="space-y-5">
      <p className="text-sm text-slate-500">
        Enter the 6-digit code we sent to <span className="font-semibold text-slate-700">{email}</span>.
      </p>
      {devCode && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Dev mode (no email provider configured yet): your code is <span className="font-mono font-bold">{devCode}</span>
        </p>
      )}
      <Input
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
        maxLength={6}
        className="text-center text-xl font-mono tracking-widest bg-slate-50 border-slate-300 h-12 rounded-xl transition-all shadow-sm"
      />
      {error && (
        <div className="flex items-center space-x-2 text-rose-700 bg-rose-100 p-3 rounded-xl border border-rose-200 text-sm">
          <p className="font-semibold">{error}</p>
        </div>
      )}
      <Button
        type="submit"
        className="w-full h-12 mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
        disabled={loading}
      >
        {loading ? 'Verifying...' : 'Verify & Sign In'}
      </Button>
      <button
        type="button"
        onClick={() => setStep('request')}
        className="w-full text-sm text-slate-500 hover:text-slate-700"
      >
        Use a different email
      </button>
    </form>
  );
}
