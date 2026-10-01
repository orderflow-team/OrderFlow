import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import apiClient, { API_BASE_URL } from './api-client';

let initializedFor: string | null = null;

/**
 * Google sign-in for the Capacitor app via Android's Credential Manager.
 * Returns an ID token whose audience is the *web* client ID, so the backend
 * verifies it exactly like a token from the website's Google button.
 *
 * Requires an Android OAuth client (package com.obix.app + the upload key and
 * Play App Signing SHA-1s) in the same Google Cloud project as `webClientId`.
 */
export async function nativeGoogleSignIn(webClientId: string): Promise<string | null> {
  if (initializedFor !== webClientId) {
    await SocialLogin.initialize({ google: { webClientId, mode: 'online' } });
    initializedFor = webClientId;
  }

  const res = await SocialLogin.login({
    provider: 'google',
    options: { scopes: ['email', 'profile'] },
  });
  if (res.result.responseType !== 'online' || !res.result.idToken) {
    throw new Error('Google sign-in did not return an ID token.');
  }
  return res.result.idToken;
}

export interface GoogleLoginResult {
  access_token: string;
  refresh_token: string;
  user: any;
  isNewUser?: boolean;
}

const POLL_MS = 2000;

/**
 * Google sign-in for app builds without the native plugin (native < 1.19,
 * reachable only by OTA): Google's popup can't complete inside the WebView,
 * and those builds have no deep link to return to. So the app opens the
 * website's /google-app-signin page in the system browser, the user signs in
 * with Google there, and we poll the backend for the result with a secret
 * that never leaves this WebView (the server only gets its hash up front).
 * See AppGoogleHandoffService in the API.
 */
export async function browserGoogleSignIn(opts: {
  /** Receives the 6-digit code to show, so the user can match it on the browser page. */
  onStarted?: (code: string) => void;
  signal: AbortSignal;
}): Promise<GoogleLoginResult | null> {
  const secretBytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = Array.from(secretBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const secretHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');

  let data;
  try {
    ({ data } = await apiClient.post('/auth/google/app-session', { secretHash }));
  } catch (err: any) {
    // The backend half of this flow ships in a separate (VPS) deploy.
    if (err?.response?.status === 404) {
      throw new Error('Google sign-in in the app is being updated. Please sign in with email for now.');
    }
    throw err;
  }
  const { sessionId, code, expiresInSeconds } = data as { sessionId: string; code: string; expiresInSeconds: number };
  opts.onStarted?.(code);

  // The website is served from the same origin as the API (see VPS routing).
  window.open(`${API_BASE_URL.replace(/\/+$/, '')}/google-app-signin?session=${sessionId}`, '_system');

  const deadline = Date.now() + expiresInSeconds * 1000;
  while (Date.now() < deadline) {
    // Also check the moment the user returns to the app from the browser.
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVisible);
        resolve();
      };
      const onVisible = () => {
        if (document.visibilityState === 'visible') done();
      };
      const timer = setTimeout(done, POLL_MS);
      document.addEventListener('visibilitychange', onVisible);
    });
    if (opts.signal.aborted) return null;
    try {
      const res = await apiClient.post(`/auth/google/app-session/${sessionId}/claim`, { secret });
      if (res.data?.status === 'complete') {
        const { status: _status, ...login } = res.data;
        return login as GoogleLoginResult;
      }
    } catch (err: any) {
      // 404 = expired/unknown session; anything else (offline while the user
      // is in the browser) is worth retrying until the deadline.
      if (err?.response?.status === 404) break;
    }
  }
  throw new Error('Google sign-in timed out. Please try again.');
}

/**
 * Whether the backend half of the browser handoff is deployed. An unknown
 * session id gets our own "expired" 404 from the new API, versus Nest's
 * generic "Cannot GET" 404 from a backend that predates it.
 */
async function handoffBackendAvailable(): Promise<boolean> {
  try {
    await apiClient.get('/auth/google/app-session/availability-check');
    return true;
  } catch (err: any) {
    const message = String(err?.response?.data?.message ?? err?.message ?? '');
    return err?.response?.status === 404 && !/Cannot GET/i.test(message);
  }
}

/**
 * How Google sign-in works on this install: the website's own popup flow on
 * web, the native plugin on native 1.19+, and the browser handoff on older
 * native builds once the backend supports it. Until then those builds keep
 * the original web flow, exactly as before the handoff existed. Resolved
 * after mount so the static-exported HTML hydrates without a mismatch.
 */
export function useGoogleSignInMode(): 'web' | 'native' | 'browser' {
  const [mode, setMode] = useState<'web' | 'native' | 'browser'>('web');
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (Capacitor.isPluginAvailable('SocialLogin')) {
      setMode('native');
      return;
    }
    let cancelled = false;
    handoffBackendAvailable().then((available) => {
      if (!cancelled && available) setMode('browser');
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return mode;
}
