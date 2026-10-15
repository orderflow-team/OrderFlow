'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { verifyMfaLogin } from '@/lib/mfa';

interface MfaChallengeFormProps {
  mfaToken: string;
  /** Receives the same payload a normal sign-in returns (tokens and user). */
  onVerified: (data: any) => void | Promise<void>;
  onCancel: () => void;
}

/** Second step of sign-in: the 6-digit code from the authenticator app, or a one-time recovery code. */
export function MfaChallengeForm({ mfaToken, onVerified, onCancel }: MfaChallengeFormProps) {
  const [useRecovery, setUseRecovery] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await verifyMfaLogin(mfaToken, useRecovery ? { recoveryCode: value.trim() } : { code: value.replace(/\s+/g, '') });
      await onVerified(data);
    } catch (err: any) {
      const status = err.response?.status;
      setError(err.response?.data?.message || err.message || 'Could not verify the code');
      // The challenge lasts five minutes; once it is gone the password step has to be repeated.
      if (status === 401 && /expired/i.test(err.response?.data?.message ?? '')) onCancel();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Two-factor authentication">
      <div className="text-center space-y-1">
        <p className="text-slate-800 font-bold">Two-factor authentication</p>
        <p className="text-slate-600 text-sm">
          {useRecovery
            ? 'Enter one of your recovery codes. Each works once.'
            : 'Enter the 6-digit code from your authenticator app.'}
        </p>
      </div>
      <Input
        autoFocus
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode={useRecovery ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        maxLength={useRecovery ? 16 : 7}
        placeholder={useRecovery ? 'xxxxx-xxxxx' : '123 456'}
        aria-label={useRecovery ? 'Recovery code' : 'Authentication code'}
        className="h-14 rounded-full px-5 text-center text-lg tracking-widest"
      />
      {error && (
        <div role="alert" className="text-rose-700 bg-rose-500/15 p-3 rounded-2xl ring-1 ring-rose-400/30 text-sm font-semibold">
          {error}
        </div>
      )}
      <Button type="submit" disabled={loading || value.trim().length < 6} className="w-full h-14 rounded-full">
        {loading ? 'Checking…' : 'Verify and sign in'}
      </Button>
      <div className="flex items-center justify-between text-sm font-semibold">
        <button
          type="button"
          onClick={() => {
            setUseRecovery((v) => !v);
            setValue('');
            setError('');
          }}
          className="text-sky-700 hover:text-sky-800"
        >
          {useRecovery ? 'Use the authenticator app' : 'Use a recovery code'}
        </button>
        <button type="button" onClick={onCancel} className="text-slate-600 hover:text-slate-800">
          Back
        </button>
      </div>
    </form>
  );
}
