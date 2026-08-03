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
    const checkAuth = async () => {
      const isCustomer = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('customerMode') === '1';
      let token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

      if (!token && isCustomer) {
        const isTakeaway = typeof window !== 'undefined' && window.location.pathname.includes('/orders/takeaway');
        if (isTakeaway) {
          const businessIdParam = new URLSearchParams(window.location.search).get('businessId');
          if (businessIdParam) {
            try {
              const api = (await import('@/lib/api-client')).default;
              const res = await api.post('/auth/takeaway-guest-login', { businessId: businessIdParam });
              localStorage.setItem('access_token', res.data.access_token);
              localStorage.setItem('user', JSON.stringify(res.data.user));
              token = res.data.access_token;
            } catch (err) {
              console.error('Takeaway guest login failed', err);
              router.push('/login');
              return;
            }
          }
        } else {
          const tableId = new URLSearchParams(window.location.search).get('id');
          if (tableId) {
            try {
              const api = (await import('@/lib/api-client')).default;
              const res = await api.post('/auth/table-guest-login', { tableId });
              localStorage.setItem('access_token', res.data.access_token);
              localStorage.setItem('user', JSON.stringify(res.data.user));
              token = res.data.access_token;
            } catch (err) {
              console.error('Table guest login failed', err);
              router.push('/login');
              return;
            }
          }
        }
      }

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
    };

    checkAuth();
  }, [router]);

  return { businessId, ready };
}
