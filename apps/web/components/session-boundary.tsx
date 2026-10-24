'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { restoreSession } from '@/lib/session-store';

/**
 * In the native app, holds the pages back until the saved login session has been restored from
 * durable storage, so no page decides "not signed in" from an empty localStorage. On the web it
 * renders straight away.
 */
export function SessionBoundary({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(() => typeof window === 'undefined' || !Capacitor.isNativePlatform());

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    // restoreSession never rejects, but a hung native call must not leave a blank screen forever.
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
    Promise.race([restoreSession(), timeout]).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  return ready ? <>{children}</> : null;
}
