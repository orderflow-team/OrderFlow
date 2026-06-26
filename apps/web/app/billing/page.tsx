'use client';

import { useEffect, useState } from 'react';
import { useBusiness } from '@/lib/use-business';
import { getCachedBusinessCategory } from '@/lib/auth';
import { getOptionalModulesForCategory } from '@/lib/business-modules';
import { RestaurantBilling } from './restaurant-billing';
import { StandardBilling } from './standard-billing';
import { AppShell } from '@/components/app-shell';

export default function BillingPage() {
  const { businessId, ready } = useBusiness();
  const [isRestaurant, setIsRestaurant] = useState<boolean | null>(null);

  useEffect(() => {
    if (ready && businessId) {
      const category = getCachedBusinessCategory(businessId);
      const optionalModules = getOptionalModulesForCategory(category);
      setIsRestaurant(optionalModules.includes('restaurant'));
    }
  }, [ready, businessId]);

  if (!ready || isRestaurant === null) return (
    <AppShell>
      <div className="p-6 text-slate-400">Loading Billing...</div>
    </AppShell>
  );

  return isRestaurant ? <RestaurantBilling /> : <StandardBilling />;
}
