'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Capacitor } from '@capacitor/core';
import { isTokenExpired } from '@/lib/auth';

const LandingPage = dynamic(() => import('@/components/landing/landing-page').then((m) => m.LandingPage), { ssr: false });

export default function Home() {
  const router = useRouter();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    // A stale/expired token used to still trigger the dashboard redirect
    // below, which would then fail its own auth check and bounce to
    // /login — so opening the home link looked like it "opened to login."
    // Checking expiry here means an expired session just shows the normal
    // home page instead of chaining through a doomed redirect.
    if (token && !isTokenExpired(token)) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.role === 'super_admin' || u.email === 'admin@orderflow.com') {
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
      router.push('/login');
      return;
    }
    setShowLanding(true);
  }, []);

  if (!showLanding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm">Loading OBIX...</p>
      </div>
    );
  }

  return <LandingPage />;
}
