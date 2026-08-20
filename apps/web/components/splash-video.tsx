'use client';

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

// Safety net in case the video fails to load/play on a device — never leave
// the user staring at the splash forever.
const MAX_DISPLAY_MS = 6000;

/**
 * Bridges the gap between the native splash (the X logo, held open via
 * capacitor.config.ts's launchAutoHide: false) and the app actually being
 * rendered. Android's default behavior hides the native splash the instant
 * the WebView paints its first frame — well before the Next.js bundle has
 * hydrated — which showed as a black screen. This mounts as the very first
 * thing in the tree, immediately calls SplashScreen.hide() (so the native
 * splash hands off directly to this, no gap), and plays the same loading
 * animation until it ends or the app has had enough time to be ready.
 */
export function SplashVideo() {
  const [visible, setVisible] = useState(
    () => typeof window !== 'undefined' && Capacitor.isNativePlatform(),
  );
  const hiddenNativeSplash = useRef(false);

  useEffect(() => {
    if (!visible) return;
    if (!hiddenNativeSplash.current) {
      hiddenNativeSplash.current = true;
      SplashScreen.hide().catch(() => {});
    }
    const timeout = setTimeout(() => setVisible(false), MAX_DISPLAY_MS);
    return () => clearTimeout(timeout);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
      <video
        autoPlay
        muted
        playsInline
        onEnded={() => setVisible(false)}
        onError={() => setVisible(false)}
        className="w-full h-full object-contain"
      >
        <source src="/Loading_animation_of_letter_X_202608201629.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
