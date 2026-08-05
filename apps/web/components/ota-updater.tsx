'use client';

import { useEffect } from 'react';
import { checkForOtaUpdate } from '@/lib/ota-updater';

/** Mounted once in the root layout — on native, stages a newer web bundle (if any) for the next app restart. No-ops on web. */
export function OtaUpdater() {
  useEffect(() => {
    checkForOtaUpdate();
  }, []);
  return null;
}
