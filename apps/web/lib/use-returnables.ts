'use client';

import { useEffect, useState } from 'react';
import apiClient from './api-client';
import { getCached } from './offline-db';
import { CustomBusinessSettings, isReturnablesEnabled } from './business-modules';
import { useBusiness } from './use-business';
import { getCachedBusinessCategory } from './auth';

/**
 * Whether this business tracks returnable containers (water jars…) and pickup-vs-delivery prices.
 * Reads the saved profile first (instant, works offline), then refreshes from the API; false until
 * either answers, so screens for other business types never flash the extra controls.
 */
export function useReturnables(): boolean {
  const { businessId } = useBusiness();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    let fresh = false; // the API answered — the saved copy must not overwrite it
    const apply = (category: string | null | undefined, settings?: CustomBusinessSettings | null) => {
      if (!cancelled) setEnabled(isReturnablesEnabled(category, settings));
    };
    getCached<{ custom_settings?: CustomBusinessSettings }>(businessId, 'business-profile')
      .then((p) => p && !fresh && apply(getCachedBusinessCategory(businessId), p.custom_settings))
      .catch(() => {});
    apiClient
      .get<{ category: string | null; custom_settings?: CustomBusinessSettings }>(`/api/businesses/${businessId}`)
      .then((res) => {
        fresh = true;
        apply(res.data.category, res.data.custom_settings);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  return enabled;
}
