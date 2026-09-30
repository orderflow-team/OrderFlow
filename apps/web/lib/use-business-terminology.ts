'use client';

import { useEffect, useState } from 'react';
import apiClient from './api-client';
import { getCached } from './offline-db';
import { CustomBusinessSettings, getBusinessTerminology } from './business-modules';
import { useBusiness } from './use-business';
import { getCachedBusinessCategory } from './auth';

type Terms = ReturnType<typeof getBusinessTerminology>;

/** "Memberships" -> "Membership"; multi-word labels ("Parts & Services") are left as-is. */
export const singularLabel = (label: string) =>
  /[\s&/]/.test(label) || !/[^s]s$/i.test(label) ? label : label.slice(0, -1);

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
    let fresh = false; // the API answered — the saved copy must not overwrite it
    // Only Others businesses use custom wording — one later switched to a
    // standard category still carries its old settings, which must not apply.
    const apply = (category: string | null | undefined, settings?: CustomBusinessSettings | null) => {
      if (!cancelled) setTerms(category === 'others' && settings?.terminology ? getBusinessTerminology(settings) : null);
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

  return terms;
}
