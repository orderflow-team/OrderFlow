'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const LandingPage = dynamic(() => import('@/components/landing/landing-page').then((m) => m.LandingPage), { ssr: false });

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
            router.push('/admin');
            return;
          }
        } catch (e) {}
      }
      router.push('/dashboard');
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
