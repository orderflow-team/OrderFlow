import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

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

/**
 * Whether Google sign-in can work here: always on the web; on native only when
 * the installed app includes the SocialLogin plugin (native 1.19+). Older
 * installs pick up new JS via OTA but not new plugins, and the web flow can't
 * complete inside the WebView, so they hide the button. Resolved after mount
 * so the static-exported HTML hydrates without a mismatch.
 */
export function useGoogleSignInSupport() {
  const [state, setState] = useState({ isNative: false, supported: true });
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    setState({ isNative, supported: !isNative || Capacitor.isPluginAvailable('SocialLogin') });
  }, []);
  return state;
}
