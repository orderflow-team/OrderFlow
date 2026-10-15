/**
 * Verifies the offline signature on an OTA release before the app applies it.
 *
 * Must match packages/api/src/common/utils/ota-signature.util.ts and
 * scripts/ota-signing.mjs: ECDSA P-256 / SHA-256, signature as raw r||s, public
 * key as base64 DER SubjectPublicKeyInfo, over `obix-ota-v1\n<platform>\n<version>\n<checksum>`.
 *
 * The public key is compiled into the app (NEXT_PUBLIC_OTA_PUBLIC_KEY). The check
 * runs in the bundle that is already installed, so a bundle that fails it never
 * gets the chance to replace the key or the check.
 */
export interface SignedRelease {
  platform: string;
  version: string;
  checksum: string;
  signature: string | null | undefined;
}

export const otaSigningMessage = (platform: string, version: string, checksum: string) =>
  `obix-ota-v1\n${platform}\n${version}\n${checksum}`;

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64.trim());
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function verifyOtaRelease(release: SignedRelease, publicKeySpkiBase64: string): Promise<boolean> {
  if (!release.signature) return false;
  try {
    const key = await crypto.subtle.importKey(
      'spki',
      base64ToBytes(publicKeySpkiBase64),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      base64ToBytes(release.signature),
      new TextEncoder().encode(otaSigningMessage(release.platform, release.version, release.checksum)),
    );
  } catch {
    return false;
  }
}

/** Platforms a signed release may carry for a device on `channelPlatform`: its own channel or the shared base ("android-direct" -> "android"). */
export function acceptablePlatforms(channelPlatform: string): string[] {
  return Array.from(new Set([channelPlatform, channelPlatform.split('-')[0]]));
}
