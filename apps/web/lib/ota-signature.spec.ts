import { describe, expect, it } from 'vitest';
import * as nodeCrypto from 'node:crypto';
import { acceptablePlatforms, otaSigningMessage, verifyOtaRelease } from './ota-signature';

// Signed the way scripts/ota-signing.mjs signs, so this also proves Node's signer and WebCrypto's verifier agree.
const keyPair = () => {
  const { publicKey, privateKey } = nodeCrypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return { privateKey, publicB64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64') };
};
const sign = (privateKey: nodeCrypto.KeyObject, platform: string, version: string, checksum: string) =>
  nodeCrypto
    .sign('sha256', Buffer.from(otaSigningMessage(platform, version, checksum), 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' })
    .toString('base64');

const release = { platform: 'android', version: '1.30.0', checksum: 'a'.repeat(64) };

describe('otaSigningMessage', () => {
  it('matches the message the API and the release script use', () => {
    expect(otaSigningMessage('android', '1.30.0', 'abc')).toBe('obix-ota-v1\nandroid\n1.30.0\nabc');
  });
});

describe('verifyOtaRelease', () => {
  it('accepts a signature made by the matching private key', async () => {
    const { privateKey, publicB64 } = keyPair();
    const signature = sign(privateKey, release.platform, release.version, release.checksum);

    expect(await verifyOtaRelease({ ...release, signature }, publicB64)).toBe(true);
  });

  it('rejects a release signed by a different key', async () => {
    const attacker = keyPair();
    const trusted = keyPair();
    const signature = sign(attacker.privateKey, release.platform, release.version, release.checksum);

    expect(await verifyOtaRelease({ ...release, signature }, trusted.publicB64)).toBe(false);
  });

  it.each([
    ['checksum', { checksum: 'b'.repeat(64) }],
    ['version', { version: '1.31.0' }],
    ['platform', { platform: 'ios' }],
  ])('rejects a valid signature replayed with a different %s', async (_name, change) => {
    const { privateKey, publicB64 } = keyPair();
    const signature = sign(privateKey, release.platform, release.version, release.checksum);

    expect(await verifyOtaRelease({ ...release, ...change, signature }, publicB64)).toBe(false);
  });

  it('rejects a missing, empty or malformed signature without throwing', async () => {
    const { publicB64 } = keyPair();

    expect(await verifyOtaRelease({ ...release, signature: null }, publicB64)).toBe(false);
    expect(await verifyOtaRelease({ ...release, signature: '' }, publicB64)).toBe(false);
    expect(await verifyOtaRelease({ ...release, signature: '%%%not-base64%%%' }, publicB64)).toBe(false);
    expect(await verifyOtaRelease({ ...release, signature: 'AAAA' }, publicB64)).toBe(false);
  });

  it('rejects when the configured public key is unusable', async () => {
    const { privateKey } = keyPair();
    const signature = sign(privateKey, release.platform, release.version, release.checksum);

    expect(await verifyOtaRelease({ ...release, signature }, 'not-a-key')).toBe(false);
  });
});

describe('acceptablePlatforms', () => {
  it('allows the device channel and its base platform', () => {
    expect(acceptablePlatforms('android-direct')).toEqual(['android-direct', 'android']);
    expect(acceptablePlatforms('android-playstore')).toEqual(['android-playstore', 'android']);
  });

  it('does not duplicate a bare platform', () => {
    expect(acceptablePlatforms('android')).toEqual(['android']);
  });
});
