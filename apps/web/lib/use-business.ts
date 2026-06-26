'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

/** Shared guard: every module page needs a logged-in user with a businessId. */
export function useBusiness() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }
    const user = getCurrentUser();
    if (!user?.businessId) {
      router.push('/dashboard');
      return;
    }
    setBusinessId(user.businessId);
    setReady(true);
  }, [router]);

  return { businessId, ready };
}
