'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { isTokenExpired } from '@/lib/auth';
import { refreshSession } from '@/lib/api-client';
import { LandingPage } from '@/components/landing/landing-page';

// The landing page is rendered on the server (and in the static export) so
// crawlers get real content. Signed-in users and the native app are redirected
// after hydration; an overlay covers the landing page while that happens.
export function HomeClient() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const goToApp = () => {
      setRedirecting(true);
      try {
        const u = JSON.parse(localStorage.getItem('user') || 'null');
        if (u && (u.role === 'super_admin' || u.email === 'admin.cleverminds@gmail.com')) {
          router.push('/admin');
          return;
        }
      } catch {
        // fall through to the default landing page
      }
      router.push('/dashboard');
    };
    const goToLogin = () => {
      // The marketing landing page is only useful to web visitors — someone
      // opening the installed Android app has already signed up, so send them
      // straight to sign-in instead (they can reach /signup from there too).
      if (Capacitor.isNativePlatform()) {
        setRedirecting(true);
        router.push('/login');
      }
    };

    const token = localStorage.getItem('access_token');
    const hasRefreshToken = !!localStorage.getItem('refresh_token');

    if (token && !isTokenExpired(token)) {
      goToApp();
      return;
    }

    // Access tokens last an hour, so reopening the app later than that always
    // finds an expired one. That is not a logout: the refresh token (which
    // outlives it) mints a new pair. Only wipe the session if the server
    // itself rejects the refresh token — never because the phone had no signal yet.
    if (hasRefreshToken) {
      setRedirecting(true);
      refreshSession().then((outcome) => {
        if (cancelled) return;
        if (outcome === 'refreshed') {
          goToApp();
        } else if (outcome === 'unavailable') {
          // Offline start: stay signed in and open the app; its requests retry on their own.
          if (localStorage.getItem('user')) goToApp();
          else goToLogin();
        } else {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          setRedirecting(false);
          goToLogin();
        }
      });
      return () => {
        cancelled = true;
      };
    }

    if (token) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    }
    goToLogin();
  // Runs once on launch; the router object is not a trigger for re-checking the session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <LandingPage />
      {redirecting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-50">
          <p className="text-slate-400 text-sm">Loading OBIX...</p>
        </div>
      )}
    </>
  );
}
