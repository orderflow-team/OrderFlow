'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

/**
 * Keeps the static native splash visible until the web app has hydrated, then
 * dismisses it immediately. There is intentionally no web animation layer.
 */
export function DismissNativeSplash() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(() => {});
    }
  }, []);

  return null;
}
