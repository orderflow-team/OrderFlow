'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { ShieldCheck, ShieldAlert, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import apiClient from '@/lib/api-client';
import { getCurrentUser, getPostLoginPath } from '@/lib/auth';

interface MfaStatus {
  enabled: boolean;
  required: boolean;
  recoveryCodesRemaining: number;
}

const errorText = (err: any, fallback: string) => err?.response?.data?.message || err?.message || fallback;

/** Two-factor authentication: turn it on with an authenticator app, keep recovery codes, turn it off. */
export default function SecurityPage() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loadError, setLoadError] = useState('');
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const user = typeof window === 'undefined' ? null : getCurrentUser();
  const homePath = getPostLoginPath(user?.role, user?.email);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get<MfaStatus>('/auth/mfa/status');
      setStatus(data);
    } catch (err: any) {
      setLoadError(errorText(err, 'Could not load your security settings.'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (err: any) {
      setError(errorText(err, 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const startSetup = () =>
    run(async () => {
      const { data } = await apiClient.post<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup');
      const qr = await QRCode.toDataURL(data.otpauthUrl, { margin: 1, width: 220 });
      setSetup({ secret: data.secret, qr });
      setCode('');
    });

  const confirmSetup = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const { data } = await apiClient.post<{ recoveryCodes: string[] }>('/auth/mfa/enable', { code: code.replace(/\s+/g, '') });
      setRecoveryCodes(data.recoveryCodes);
      setSetup(null);
      setCode('');
      await load();
    });
  };

  const proofBody = () => {
    const v = proof.trim();
    // Recovery codes contain a dash or letters; authenticator codes are six digits.
    return /^\d{6}$/.test(v.replace(/\s+/g, '')) ? { code: v.replace(/\s+/g, '') } : { recoveryCode: v };
  };

  const regenerate = () =>
    run(async () => {
      const { data } = await apiClient.post<{ recoveryCodes: string[] }>('/auth/mfa/recovery-codes', proofBody());
      setRecoveryCodes(data.recoveryCodes);
      setProof('');
      await load();
    });

  const disable = () =>
    run(async () => {
      await apiClient.post('/auth/mfa/disable', proofBody());
      setProof('');
      setNotice('Two-factor authentication is off.');
      await load();
    });

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText((recoveryCodes ?? []).join('\n'));
      setNotice('Recovery codes copied.');
    } catch {
      setNotice('Could not copy. Select the codes and copy them by hand.');
    }
  };

  const downloadCodes = () => {
    const blob = new Blob([`OBIX 360 recovery codes\nEach code works once.\n\n${(recoveryCodes ?? []).join('\n')}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'obix-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto w-full max-w-lg space-y-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-slate-800">Security</h1>
          <Link href={homePath} className="text-sm font-semibold text-sky-700 hover:text-sky-800">
            Back to the app
          </Link>
        </div>

        {loadError && (
          <p role="alert" className="rounded-2xl bg-rose-500/15 p-3 text-sm font-semibold text-rose-700">
            {loadError}
          </p>
        )}
        {status?.required && !status.enabled && (
          <p role="alert" className="flex gap-2 rounded-2xl bg-amber-500/15 p-3 text-sm font-semibold text-amber-800">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            Two-factor authentication is required for this account. Set it up to continue.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5" /> Two-factor authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            {!status && !loadError && <p>Loading…</p>}

            {recoveryCodes && (
              <div className="space-y-3" aria-label="Recovery codes">
                <p className="font-semibold text-slate-800">Save these recovery codes now.</p>
                <p>They are the only way in if you lose your phone, and they are shown only once. Each code works one time.</p>
                <ul className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3 font-mono text-sm">
                  {recoveryCodes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button type="button" onClick={copyCodes} className="gap-1">
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                  <Button type="button" onClick={downloadCodes} className="gap-1">
                    <Download className="h-4 w-4" /> Download
                  </Button>
                  <Button type="button" onClick={() => setRecoveryCodes(null)}>
                    I have saved them
                  </Button>
                </div>
              </div>
            )}

            {status && !status.enabled && !setup && !recoveryCodes && (
              <>
                <p>
                  Ask for a code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password…) every time you
                  sign in, so a stolen password is not enough.
                </p>
                <Button type="button" onClick={startSetup} disabled={busy}>
                  Set up
                </Button>
              </>
            )}

            {setup && (
              <form onSubmit={confirmSetup} className="space-y-3">
                <p>1. Scan this code with your authenticator app.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup.qr} alt="QR code to add this account to your authenticator app" width={220} height={220} className="rounded-xl bg-white" />
                <p>
                  Cannot scan it? Enter this key by hand: <code className="break-all font-mono font-semibold">{setup.secret}</code>
                </p>
                <p>2. Enter the 6-digit code the app shows.</p>
                <Input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123 456"
                  aria-label="Authentication code"
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy || code.replace(/\s+/g, '').length !== 6}>
                    Turn on
                  </Button>
                  <Button type="button" onClick={() => setSetup(null)} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {status?.enabled && !recoveryCodes && (
              <div className="space-y-3">
                <p className="font-semibold text-emerald-700">On. {status.recoveryCodesRemaining} recovery codes left.</p>
                <p>To get new recovery codes{status.required ? '' : ' or to turn this off'}, enter a code from your app or a recovery code.</p>
                <Input
                  value={proof}
                  onChange={(e) => setProof(e.target.value)}
                  placeholder="123 456 or xxxxx-xxxxx"
                  autoComplete="one-time-code"
                  aria-label="Authentication or recovery code"
                />
                <div className="flex gap-2">
                  <Button type="button" onClick={regenerate} disabled={busy || proof.trim().length < 6}>
                    New recovery codes
                  </Button>
                  {!status.required && (
                    <Button type="button" onClick={disable} disabled={busy || proof.trim().length < 6}>
                      Turn off
                    </Button>
                  )}
                </div>
                {status.required && <p className="text-xs text-slate-500">This account must keep two-factor authentication on.</p>}
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-2xl bg-rose-500/15 p-3 font-semibold text-rose-700">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="font-semibold text-emerald-700">
                {notice}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
