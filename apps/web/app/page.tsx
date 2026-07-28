'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const LandingPage = dynamic(() => import('@/components/landing/landing-page').then((m) => m.LandingPage), { ssr: false });

const DESKTOP_BREAKPOINT = '(min-width: 1024px)';

export default function Home() {
  const router = useRouter();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (token) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.role === 'super_admin' || u.email === 'admin@orderflow.com') {
            window.location.href = '/admin';
            return;
          }
        } catch (e) {}
      }
      window.location.href = '/dashboard';
      return;
    }
    // Mobile visitors skip marketing landing page and go straight to login
    if (!window.matchMedia(DESKTOP_BREAKPOINT).matches) {
      window.location.href = '/login';
      return;
    }
    setShowLanding(true);
  }, []);

  if (!showLanding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm">Loading OrderFlow...</p>
      </div>
    );
  }

  return <LandingPage />;
}
