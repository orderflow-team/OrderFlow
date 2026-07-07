import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Lets an owner view a staff login's current password. Derived from
 * CREDENTIAL_ENCRYPTION_KEY (falls back to JWT_SECRET so this works without
 * an extra env var in existing deployments) — set CREDENTIAL_ENCRYPTION_KEY
 * explicitly in production so rotating JWT_SECRET can't strand ciphertext.
 */
function getKey(): Buffer {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY or JWT_SECRET must be set to store/reveal staff passwords');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptPassword(payload: string): string {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
