import * as crypto from 'crypto';

/**
 * Detached signature over an OTA release, made with an OFFLINE private key.
 *
 * The bundle URL and its checksum both come from this API, so a checksum alone
 * only proves the download was not corrupted: whoever controls the API, its
 * object storage, or a super-admin token could publish a bundle and a matching
 * checksum, and every installed app would run that JavaScript. The signature is
 * made on the release machine with a key the server never holds, and the apps
 * carry the matching public key, so none of those compromises can publish code.
 *
 * Algorithm: ECDSA P-256 / SHA-256, signature as raw r||s (IEEE P1363), which is
 * what the WebCrypto verifier in apps/web/lib/ota-signature.ts expects. The key
 * is exchanged as base64 of the DER SubjectPublicKeyInfo.
 *
 * The signed text binds the platform and version to the checksum, so a valid
 * signature for one release cannot be re-labelled as another.
 */
export function otaSigningMessage(platform: string, version: string, checksum: string): string {
  return `obix-ota-v1\n${platform}\n${version}\n${checksum}`;
}

export function publicKeyFromBase64(spkiBase64: string): crypto.KeyObject {
  return crypto.createPublicKey({ key: Buffer.from(spkiBase64, 'base64'), format: 'der', type: 'spki' });
}

export function verifyOtaSignature(
  input: { platform: string; version: string; checksum: string; signature: string },
  publicKeySpkiBase64: string,
): boolean {
  try {
    return crypto.verify(
      'sha256',
      Buffer.from(otaSigningMessage(input.platform, input.version, input.checksum), 'utf8'),
      { key: publicKeyFromBase64(publicKeySpkiBase64), dsaEncoding: 'ieee-p1363' },
      Buffer.from(input.signature, 'base64'),
    );
  } catch {
    return false;
  }
}
