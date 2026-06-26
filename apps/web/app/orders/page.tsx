'use client';

import { useBusiness } from '@/lib/use-business';
import { getCachedBusinessCategory } from '@/lib/auth';
import { GenericOrders } from './generic-orders';
import { RestaurantOrders } from './restaurant-orders';
import { useEffect, useState } from 'react';

export default function OrdersPage() {
  const { businessId, ready } = useBusiness();
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && businessId) {
      setCategory(getCachedBusinessCategory(businessId));
    }
  }, [businessId]);

  if (!ready || category === null) {
    return <div className="p-10 text-center text-slate-500">Loading...</div>;
  }

  if (category.toLowerCase() === 'restaurant') {
    return <RestaurantOrders />;
  }

  return <GenericOrders />;
}
