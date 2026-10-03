import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * True only inside the Capacitor mobile app, never on the website. Starts false
 * so server and first client render match, then flips after mount.
 */
export function useIsNativeApp(): boolean {
  const [isNative, setIsNative] = useState(false);
  useEffect(() => {
    try { setIsNative(Capacitor.isNativePlatform()); } catch { setIsNative(false); }
  }, []);
  return isNative;
}
