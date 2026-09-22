'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Mounted once in the root layout. lib/api-client.ts's 401 interceptor can't
 * call useRouter() directly (it's a plain module, not a component), so it
 * dispatches this event instead — router.push() is required here rather than
 * window.location.href because a hard navigation to a nested route doesn't
 * resolve correctly inside Capacitor's local WebViewAssetLoader (it silently
 * falls back to serving the root page for any path it can't resolve exactly).
 */
export function AuthRedirectListener() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => {
      if (pathname !== '/login' && pathname !== '/signup') {
        router.push('/login');
      }
    };
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, [router, pathname]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origError = console.error;
      console.error = (...args: any[]) => {
        const str = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        if (/no match|client side error|speech recognition/i.test(str)) {
          // Log benign speech recognition timeout as warning to prevent Next.js full-screen dev overlay
          console.warn('[Benign Speech Notice]', ...args);
          return;
        }
        origError.apply(console, args);
      };
    }
  }, []);

  return null;
}
