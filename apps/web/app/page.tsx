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
    const token = localStorage.getItem('access_token');
    if (token) {
      router.replace('/select-business');
      return;
    }
    // Mobile visitors skip the marketing page entirely and land straight on login.
    if (!window.matchMedia(DESKTOP_BREAKPOINT).matches) {
      router.replace('/login');
      return;
    }
    setShowLanding(true);
  }, [router]);

  if (!showLanding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm">Loading OrderFlow...</p>
      </div>
    );
  }

  return <LandingPage />;
}
