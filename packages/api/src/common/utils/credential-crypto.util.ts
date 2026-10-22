import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Lets an owner view a staff login's current password.
 *
 * New ciphertext is always written with CREDENTIAL_ENCRYPTION_KEY, which must
 * be a secret of its own: if it shared JWT_SECRET, one leaked secret would
 * both forge login tokens and unlock every stored staff password, and rotating
 * JWT_SECRET would strand the ciphertext.
 *
 * Decryption also accepts the keys older rows may have been written with, so
 * the dedicated key can be introduced without a flag day:
 *   1. CREDENTIAL_ENCRYPTION_KEY           (current)
 *   2. CREDENTIAL_ENCRYPTION_KEY_PREVIOUS  (optional, comma-separated; the key(s) you rotated away from)
 *   3. JWT_SECRET                          (legacy: rows written before the dedicated key existed)
 * `npm run rotate:credential-key` re-encrypts old rows with the current key.
 *
 * Outside production, JWT_SECRET is still used for new ciphertext when no
 * dedicated key is set, so local development needs no extra variable.
 * assertCredentialKeyConfigured() enforces the dedicated key in production.
 */
function toKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

function primarySecret(): string {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY or JWT_SECRET must be set to store/reveal staff passwords');
  }
  return secret;
}

/** Every secret a stored value might have been encrypted with, current key first, de-duplicated. */
function candidateSecrets(): string[] {
  const secrets = [
    primarySecret(),
    ...(process.env.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS ?? '').split(',').map((s) => s.trim()),
    process.env.JWT_SECRET ?? '',
  ].filter((s) => s.length > 0);
  return Array.from(new Set(secrets));
}

function decryptWith(payload: string, secret: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, toKey(secret), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, toKey(primarySecret()), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptPassword(payload: string): string {
  let lastError: unknown;
  for (const secret of candidateSecrets()) {
    try {
      return decryptWith(payload, secret);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/** True when `payload` decrypts, but only with a key other than the current one. */
export function needsReencryption(payload: string): boolean {
  try {
    decryptWith(payload, primarySecret());
    return false;
  } catch {
    decryptPassword(payload); // throws if no known key opens it at all
    return true;
  }
}

/**
 * Production must use a dedicated credential key that differs from JWT_SECRET.
 * Called once at startup so a misconfigured deploy fails immediately instead of
 * the first time an owner creates or reveals a staff login.
 */
export function assertCredentialKeyConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  const key = env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY must be set in production (a long random value, different from JWT_SECRET). ' +
        'Existing staff passwords keep working: they are read with JWT_SECRET until you run `npm run rotate:credential-key`.',
    );
  }
  if (key === env.JWT_SECRET) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must differ from JWT_SECRET.');
  }
  if (key.length < 24) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be at least 24 characters.');
  }
}
