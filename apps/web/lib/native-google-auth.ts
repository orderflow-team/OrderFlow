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
