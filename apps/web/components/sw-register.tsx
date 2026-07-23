'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/register-sw';

/** Mounted once in the root layout — registers the offline-mode service worker. */
export function SwRegister() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
