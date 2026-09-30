'use client';

import { useBusiness } from '@/lib/use-business';
import { getCachedBusinessCategory, setCachedBusinessCategory } from '@/lib/auth';
import apiClient from '@/lib/api-client';
import { GenericOrders } from './generic-orders';
import { RestaurantOrders } from './restaurant-orders';
import { useEffect, useState } from 'react';

export default function OrdersPage() {
  const { businessId, ready } = useBusiness();
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !businessId) return;
    const cached = getCachedBusinessCategory(businessId);
    if (cached !== null) {
      setCategory(cached);
      return;
    }
    // Nothing cached yet (fresh install, or this page opened before the
    // dashboard) — look it up instead of waiting on "Loading..." forever.
    apiClient
      .get<{ category: string | null }>(`/api/businesses/${businessId}`)
      .then((res) => {
        setCachedBusinessCategory(businessId, res.data.category);
        setCategory(res.data.category ?? '');
      })
      .catch(() => setCategory(''));
  }, [businessId]);

  if (!ready || category === null) {
    return <div className="p-10 text-center text-slate-500">Loading...</div>;
  }

  if (category.toLowerCase() === 'restaurant') {
    return <RestaurantOrders />;
  }

  return <GenericOrders />;
}
