'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { isTokenExpired } from '@/lib/auth';
import { LandingPage } from '@/components/landing/landing-page';

// The landing page is rendered on the server (and in the static export) so
// crawlers get real content. Signed-in users and the native app are redirected
// after hydration; an overlay covers the landing page while that happens.
export function HomeClient() {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    // A stale/expired token used to still trigger the dashboard redirect
    // below, which would then fail its own auth check and bounce to
    // /login — so opening the home link looked like it "opened to login."
    // Checking expiry here means an expired session just shows the normal
    // home page instead of chaining through a doomed redirect.
    if (token && !isTokenExpired(token)) {
      setRedirecting(true);
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.role === 'super_admin' || u.email === 'admin.cleverminds@gmail.com') {
            setRedirecting(true);
            router.push('/admin');
            return;
          }
        } catch (e) {}
      }
      router.push('/dashboard');
      return;
    }
    if (token) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
    // The marketing landing page is only useful to web visitors — someone
    // opening the installed Android app has already signed up, so send them
    // straight to sign-in instead (they can reach /signup from there too).
    if (Capacitor.isNativePlatform()) {
      setRedirecting(true);
      router.push('/login');
    }
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
