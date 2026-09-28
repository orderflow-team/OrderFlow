'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { ObixMark } from '@/components/obix-logo';
import { GoogleAuthButton } from '@/components/google-auth-button';

/**
 * Opened in the phone's browser by app builds without native Google sign-in
 * (lib/native-google-auth.ts browserGoogleSignIn). Google's popup works here,
 * so the user signs in as on the website, and the token is attached to the
 * app's pending session instead of logging this browser in.
 */
export default function GoogleAppSignInPage() {
  return (
    <Suspense fallback={null}>
      <GoogleAppSignIn />
    </Suspense>
  );
}

function GoogleAppSignIn() {
  const sessionId = useSearchParams().get('session') || '';
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError('This link is incomplete. Go back to the OBIX app and tap "Continue with Google" again.');
      return;
    }
    apiClient
      .get(`/auth/google/app-session/${sessionId}`)
      .then((res) => setCode(res.data.code))
      .catch((err) => setError(err.response?.data?.message || 'This sign-in link has expired. Go back to the app and try again.'));
  }, [sessionId]);

  const attachToApp = async (authPayload: { idToken?: string; accessToken?: string }) => {
    await apiClient.post(`/auth/google/app-session/${sessionId}/complete`, authPayload);
    setDone(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-xl ring-1 ring-slate-200">
        <div className="flex flex-col items-center text-center space-y-3">
          <ObixMark className="w-14 h-14" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Sign in to the OBIX app</h1>
        </div>

        {error ? (
          <p className="mt-6 text-center text-sm font-medium text-red-600">{error}</p>
        ) : done ? (
          <div className="mt-6 flex flex-col items-center text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <p className="font-semibold text-slate-800">You're signed in.</p>
            <p className="text-sm text-slate-600">Go back to the OBIX app — it will continue automatically. You can close this tab.</p>
          </div>
        ) : !code ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        ) : (
          <>
            <p className="mt-6 text-center text-sm text-slate-600">Check that the OBIX app on your phone shows this code:</p>
            <p className="mt-2 text-center font-mono text-3xl font-bold tracking-[0.3em] text-slate-800">
              {code.slice(0, 3)} {code.slice(3)}
            </p>
            <p className="mt-3 mb-6 text-center text-xs text-slate-500">
              Only continue if you opened this page from the OBIX app just now. If someone sent you this link, close it.
            </p>
            <GoogleAuthButton mode="signin" onCredential={attachToApp} onError={setError} />
          </>
        )}
      </div>
    </div>
  );
}
