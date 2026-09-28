/**
 * Full-page Google account chooser for the app's browser sign-in
 * (app/google-app-signin). Google only redirects to URIs registered on the
 * OAuth client; https://obix360.com/login already is, so Google returns there
 * and /login forwards the fragment to /google-app-signin.
 */
export const APP_SIGNIN_STATE_PREFIX = 'obix-app:';

const REDIRECT_URI = 'https://obix360.com/login';

export function googleAccountChooserUrl(sessionId: string): string | null {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce,
    state: `${APP_SIGNIN_STATE_PREFIX}${sessionId}`,
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** Called on /login: forwards Google's response for an app sign-in back to its page. */
export function forwardAppSignInResponse(): boolean {
  if (typeof window === 'undefined') return false;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (!(fragment.get('state') || '').startsWith(APP_SIGNIN_STATE_PREFIX)) return false;
  window.location.replace(`/google-app-signin${window.location.hash}`);
  return true;
}
