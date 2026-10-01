'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { ObixMark } from '@/components/obix-logo';
import { GoogleAuthButton } from '@/components/google-auth-button';
import { APP_SIGNIN_STATE_PREFIX, googleAccountChooserUrl } from '@/lib/google-app-signin';

/**
 * Opened in the phone's browser by app builds without native Google sign-in
 * (lib/native-google-auth.ts browserGoogleSignIn). It sends the browser
 * straight to Google's account chooser (a full-page redirect, which always
 * shows — unlike One Tap, which Google may suppress). Google returns to
 * /login with an ID token in the URL fragment; /login hands that back here,
 * the token is attached to the app's pending session, and the tab closes to
 * return the user to the app.
 */
export default function GoogleAppSignInPage() {
  return (
    <Suspense fallback={null}>
      <GoogleAppSignIn />
    </Suspense>
  );
}

function GoogleAppSignIn() {
  const querySession = useSearchParams().get('session') || '';
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');
  const [showButton, setShowButton] = useState(false);
  const [done, setDone] = useState(false);
  // Shown here and in the app. The user must confirm they match before we go
  // to Google: otherwise anyone could send a victim a link to a session the
  // attacker started, and collect the victim's login when they sign in.
  const [confirmCode, setConfirmCode] = useState('');

  const attachToApp = async (id: string, authPayload: { idToken?: string; accessToken?: string }) => {
    await apiClient.post(`/auth/google/app-session/${id}/complete`, authPayload);
    setDone(true);
    // Chrome lets a tab that another app opened close itself, which drops the
    // user straight back into OBIX. If it doesn't, the message below remains.
    setTimeout(() => window.close(), 300);
  };

  useEffect(() => {
    // Back from Google's account chooser (via /login): #id_token=…&state=…
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const idToken = fragment.get('id_token');
    const state = fragment.get('state') || '';
    if (idToken && state.startsWith(APP_SIGNIN_STATE_PREFIX)) {
      const id = state.slice(APP_SIGNIN_STATE_PREFIX.length);
      setSessionId(id);
      history.replaceState(null, '', window.location.pathname);
      attachToApp(id, { idToken }).catch((err) =>
        setError(err.response?.data?.message || err.message || 'Google sign-in failed. Go back to the app and try again.'),
      );
      return;
    }
    if (fragment.get('error')) {
      setError('Google sign-in was cancelled. Go back to the app and try again.');
      return;
    }

    if (!querySession) {
      setError('This link is incomplete. Go back to the OBIX app and tap "Continue with Google" again.');
      return;
    }
    setSessionId(querySession);
    apiClient
      .get<{ code: string }>(`/auth/google/app-session/${querySession}`)
      .then((res) => setConfirmCode(res.data.code))
      .catch((err) => setError(err.response?.data?.message || 'This sign-in link has expired. Go back to the app and try again.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [querySession]);

  const continueToGoogle = () => {
    setConfirmCode('');
    const url = googleAccountChooserUrl(sessionId);
    if (url) {
      window.location.replace(url);
      // Only visible if the redirect is blocked for some reason.
      setTimeout(() => setShowButton(true), 4000);
    } else {
      setShowButton(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-xl ring-1 ring-slate-200">
        <div className="flex flex-col items-center text-center space-y-3">
          <ObixMark className="w-14 h-14" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Sign in to OBIX</h1>
        </div>

        {error ? (
          <p className="mt-6 text-center text-sm font-medium text-red-600">{error}</p>
        ) : done ? (
          <div className="mt-6 flex flex-col items-center text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <p className="font-semibold text-slate-800">You're signed in.</p>
            <p className="text-sm text-slate-600">Returning to the OBIX app… If it doesn't open, switch back to it.</p>
          </div>
        ) : confirmCode ? (
          <div className="mt-6 flex flex-col items-center text-center space-y-4">
            <p className="text-sm text-slate-600">Check that the OBIX app on your phone shows this code:</p>
            <p className="font-mono text-3xl font-bold tracking-[0.3em] text-slate-900">
              {confirmCode.slice(0, 3)} {confirmCode.slice(3)}
            </p>
            <button
              type="button"
              onClick={continueToGoogle}
              className="w-full h-12 rounded-full bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
            >
              The codes match — continue
            </button>
            <p className="text-xs text-slate-500">
              If the codes don't match, or you didn't just tap &quot;Continue with Google&quot; in the OBIX app, close this page.
            </p>
          </div>
        ) : showButton && sessionId ? (
          <>
            <p className="mt-4 mb-6 text-center text-sm text-slate-600">Choose your Google account to continue.</p>
            <GoogleAuthButton mode="signin" onCredential={(payload) => attachToApp(sessionId, payload)} onError={setError} />
          </>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3 text-sm text-slate-600">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            <p>Opening Google…</p>
          </div>
        )}
      </div>
    </div>
  );
}
