'use client';

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

// Matches the GIF's own encoded length (4s) plus a small buffer — there's no
// "onEnded" event for an <img>, unlike the <video> this replaced, so a fixed
// timer is the only way to know when to stop showing it. Also the safety net
// if the image is ever slow/fails to load on a device.
const DISPLAY_MS = 4200;

/**
 * Bridges the gap between the native splash (the X logo, held open via
 * capacitor.config.ts's launchAutoHide: false) and the app actually being
 * rendered. Android's default behavior hides the native splash the instant
 * the WebView paints its first frame — well before the Next.js bundle has
 * hydrated — which showed as a black screen. This mounts as the very first
 * thing in the tree, immediately calls SplashScreen.hide() (so the native
 * splash hands off directly to this, no gap), and shows the same loading
 * animation for a fixed duration.
 *
 * A GIF rather than a video: a <video>'s autoplay can silently fall back to
 * a "tap to play" UI depending on the WebView and needed real workarounds to
 * avoid that (muted set imperatively, not just the JSX prop, etc.) — an
 * <img> GIF just always plays, no such policy to fight. Trades some file
 * size for that reliability and simplicity.
 */
export function SplashGif() {
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

    const timeout = setTimeout(() => setVisible(false), DISPLAY_MS);
    return () => clearTimeout(timeout);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- a GIF needs a
          real <img> for its animation to play; next/image would strip that. */}
      <img
        src="/splash-animation.gif"
        alt=""
        onError={() => setVisible(false)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
