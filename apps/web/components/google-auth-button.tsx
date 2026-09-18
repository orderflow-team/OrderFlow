'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { getPostLoginPath, setCurrentUser } from '@/lib/auth';
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
  const overlayBtnRef = useRef<HTMLDivElement>(null);
  const tokenClientRef = useRef<any>(null);
  const router = useRouter();

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  const handleSuccess = async (authPayload: { idToken?: string; accessToken?: string }) => {
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/google', authPayload);

      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      setCurrentUser(res.data.user);

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

    const initGoogle = () => {
      if (!window.google?.accounts) return;

      try {
        // 1. Initialize Google Identity Services for ID Token authentication
        if (window.google.accounts.id) {
          window.google.accounts.id.initialize({
            client_id: clientId || 'demo-client-id.apps.googleusercontent.com',
            callback: (res: any) => {
              if (res?.credential) {
                handleSuccess({ idToken: res.credential });
              } else {
                onError?.('Google authentication failed: No credential received');
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          // Render Google's native button directly into the invisible overlay
          if (overlayBtnRef.current) {
            overlayBtnRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(overlayBtnRef.current, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: mode === 'signup' ? 'signup_with' : 'continue_with',
              shape: 'pill',
              width: 380,
            });
          }
        }

        // 2. Also initialize OAuth2 Token Client for direct popup fallback
        if (window.google.accounts.oauth2 && clientId) {
          tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'openid email profile',
            callback: async (tokenRes: any) => {
              if (tokenRes.error) {
                onError?.(tokenRes.error_description || tokenRes.error);
                return;
              }
              if (tokenRes.access_token) {
                await handleSuccess({ accessToken: tokenRes.access_token });
              }
            },
            error_callback: (err: any) => {
              if (err?.message) {
                onError?.(err.message);
              }
            },
          });
        }
      } catch (e) {
        console.warn('Google SDK init skipped/failed:', e);
      }
    };

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

    loadScript();
  }, [clientId, mode]);

  const triggerGooglePrompt = () => {
    if (loading) return;

    if (!clientId) {
      onError?.('Google Client ID is not configured yet (NEXT_PUBLIC_GOOGLE_CLIENT_ID).');
      return;
    }

    // Try popup via token client first
    if (tokenClientRef.current) {
      try {
        tokenClientRef.current.requestAccessToken();
        return;
      } catch (e) {
        console.warn('tokenClient.requestAccessToken failed, falling back to One Tap:', e);
      }
    }

    // Fall back to One Tap prompt
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  };

  return (
    <div className={`w-full relative overflow-hidden rounded-full ${className}`}>
      {/* Invisible overlay of Google's native button:
          Any tap or click lands directly on Google's iframe for immediate popup response */}
      <div
        ref={overlayBtnRef}
        className="absolute inset-0 w-full h-full opacity-0 hover:opacity-[0.01] z-20 cursor-pointer flex items-center justify-center overflow-hidden scale-110 pointer-events-auto"
        aria-hidden="true"
      />

      {/* Styled custom button visible underneath */}
      <button
        type="button"
        onClick={triggerGooglePrompt}
        disabled={loading}
        className="w-full h-14 rounded-full bg-white/70 hover:bg-white/90 active:scale-[0.98] backdrop-blur-md text-slate-800 font-semibold text-sm sm:text-base ring-1 ring-slate-200/80 shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.8),0_4px_12px_rgba(0,0,0,0.05)] transition-all flex items-center justify-center gap-3 px-5 group disabled:opacity-60 cursor-pointer relative z-10"
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
