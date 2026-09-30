'use client';

import { useEffect, useState } from 'react';
import apiClient from './api-client';
import { getCached } from './offline-db';
import { CustomBusinessSettings, getBusinessTerminology } from './business-modules';
import { useBusiness } from './use-business';

type Terms = ReturnType<typeof getBusinessTerminology>;

/**
 * The business's own wording ("Members", "Bookings"…) when it was set up with
 * custom terminology (the Others wizard), or null for standard categories so
 * pages keep their category-specific defaults. Reads the saved profile first
 * (instant, works offline), then refreshes from the API.
 */
export function useBusinessTerminology(): Terms | null {
  const { businessId } = useBusiness();
  const [terms, setTerms] = useState<Terms | null>(null);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    const apply = (settings?: CustomBusinessSettings | null) => {
      if (!cancelled) setTerms(settings?.terminology ? getBusinessTerminology(settings) : null);
    };
    getCached<{ custom_settings?: CustomBusinessSettings }>(businessId, 'business-profile')
      .then((p) => p && apply(p.custom_settings))
      .catch(() => {});
    apiClient
      .get<{ custom_settings?: CustomBusinessSettings }>(`/api/businesses/${businessId}`)
      .then((res) => apply(res.data.custom_settings))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  return terms;
}
