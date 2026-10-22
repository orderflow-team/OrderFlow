import apiClient from './api-client';

/** What the sign-in routes return, instead of tokens, for an account with two-factor authentication. */
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

export function isMfaChallenge(data: unknown): data is MfaChallenge {
  const d = data as Partial<MfaChallenge> | null | undefined;
  return !!d && d.mfaRequired === true && typeof d.mfaToken === 'string' && d.mfaToken.length > 0;
}

export interface MfaProof {
  code?: string;
  recoveryCode?: string;
}

/** Exchanges the challenge plus an authenticator code (or a recovery code) for the real session. */
export async function verifyMfaLogin(mfaToken: string, proof: MfaProof) {
  const { data } = await apiClient.post('/auth/mfa/verify', { mfaToken, ...proof });
  return data;
}

/** The API answers a gated super admin with this message on every route except the MFA setup ones. */
export const MFA_SETUP_REQUIRED_MESSAGE = 'MFA_SETUP_REQUIRED';
