// Offline signing for OTA releases. Must stay byte-for-byte compatible with
// packages/api/src/common/utils/ota-signature.util.ts (server check) and
// apps/web/lib/ota-signature.ts (the check inside the app).
import { createHash, createPrivateKey, sign } from 'node:crypto';

export const otaSigningMessage = (platform, version, checksum) => `obix-ota-v1\n${platform}\n${version}\n${checksum}`;

export const sha256Hex = (buffer) => createHash('sha256').update(buffer).digest('hex');

/** Accepts the PKCS#8 PEM itself (newlines may be written as a literal \n) or the PEM base64-encoded on one line. */
function loadPrivateKey(raw) {
  let pem = raw.trim().replace(/\\n/g, '\n');
  if (!pem.includes('BEGIN')) pem = Buffer.from(pem, 'base64').toString('utf8');
  return createPrivateKey(pem);
}

/**
 * Returns the base64 signature for a release, or null when no key is configured
 * and OTA_ALLOW_UNSIGNED=1 (only for a development server that does not enforce signing).
 */
export function signRelease({ platform, version, checksum }, env = process.env) {
  const raw = env.OTA_SIGNING_PRIVATE_KEY;
  if (!raw) {
    if (env.OTA_ALLOW_UNSIGNED === '1') {
      console.warn('WARNING: publishing an UNSIGNED release (OTA_ALLOW_UNSIGNED=1). Apps that enforce signatures will ignore it.');
      return null;
    }
    console.error(
      'Missing OTA_SIGNING_PRIVATE_KEY. Releases are signed with the offline OTA key; generate one with\n' +
        '  node scripts/ota-keygen.mjs\n' +
        'or set OTA_ALLOW_UNSIGNED=1 to publish unsigned to a development server.',
    );
    process.exit(1);
  }
  return sign('sha256', Buffer.from(otaSigningMessage(platform, version, checksum), 'utf8'), {
    key: loadPrivateKey(raw),
    dsaEncoding: 'ieee-p1363',
  }).toString('base64');
}
