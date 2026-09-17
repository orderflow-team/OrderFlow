'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { getPostLoginPath } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

interface GoogleAuthButtonProps {
  mode?: 'signin' | 'signup';
  className?: string;
  onError?: (err: string) => void;
}

declare global {
  interface Window {
    google?: any;
  }
}

export function GoogleAuthButton({ mode = 'signin', className = '', onError }: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const hiddenBtnRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  const handleCredentialResponse = async (response: any) => {
    if (!response?.credential) {
      onError?.('Google authentication failed: No credential received');
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post('/auth/google', { idToken: response.credential });

      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));

      if (res.data.isNewUser || !res.data.user?.businessId) {
        router.push('/select-business');
      } else {
        router.push(getPostLoginPath(res.data.user.role, res.data.user.email));
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Google sign-in failed. Please try again.';
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadScript = () => {
      if (window.google?.accounts?.id) {
        initGoogle();
        return;
      }

      const existing = document.getElementById('google-jssdk');
      if (existing) {
        existing.addEventListener('load', initGoogle);
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-jssdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.body.appendChild(script);
    };

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;

      try {
        window.google.accounts.id.initialize({
          client_id: clientId || 'demo-client-id.apps.googleusercontent.com',
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (hiddenBtnRef.current) {
          window.google.accounts.id.renderButton(hiddenBtnRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            width: '100%',
          });
        }
        setSdkReady(true);
      } catch (e) {
        console.warn('Google SDK init skipped/failed:', e);
      }
    };

    loadScript();
  }, [clientId]);

  const triggerGooglePrompt = () => {
    if (loading) return;

    if (!clientId) {
      // Graceful demo notice if Client ID is not yet placed in env
      const promptEmail = window.prompt(
        'Google Client ID is not configured yet in environment.\n\nFor testing: enter your Google email to simulate verification, or configure NEXT_PUBLIC_GOOGLE_CLIENT_ID.',
      );
      if (promptEmail && promptEmail.includes('@')) {
        // Fallback test helper
        setLoading(true);
        apiClient
          .post('/auth/otp/request', { email: promptEmail.trim().toLowerCase() })
          .then(() => {
            alert('A verification OTP has been sent to ' + promptEmail);
          })
          .catch((e) => onError?.(e.response?.data?.message || 'Failed'))
          .finally(() => setLoading(false));
      }
      return;
    }

    if (window.google?.accounts?.id) {
      try {
        // Try triggering native rendered button click or prompt
        const button = hiddenBtnRef.current?.querySelector('div[role="button"]') as HTMLElement | null;
        if (button) {
          button.click();
        } else {
          window.google.accounts.id.prompt();
        }
      } catch {
        window.google.accounts.id.prompt();
      }
    }
  };

  return (
    <div className={`w-full relative ${className}`}>
      {/* Hidden container for standard Google button rendering to satisfy popup policies */}
      <div ref={hiddenBtnRef} className="hidden" aria-hidden="true" />

      <button
        type="button"
        onClick={triggerGooglePrompt}
        disabled={loading}
        className="w-full h-14 rounded-full bg-white/70 hover:bg-white/90 active:scale-[0.98] backdrop-blur-md text-slate-800 font-semibold text-sm sm:text-base ring-1 ring-slate-200/80 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.05)] transition-all flex items-center justify-center gap-3 px-5 group disabled:opacity-60 cursor-pointer"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
        ) : (
          <svg className="w-5 h-5 shrink-0 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>{mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}</span>
      </button>
    </div>
  );
}
