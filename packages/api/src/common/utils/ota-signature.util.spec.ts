import * as crypto from 'crypto';
import { otaSigningMessage, verifyOtaSignature } from './ota-signature.util';

const keyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return { privateKey, publicB64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64') };
};
const sign = (privateKey: crypto.KeyObject, platform: string, version: string, checksum: string) =>
  crypto.sign('sha256', Buffer.from(otaSigningMessage(platform, version, checksum)), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64');

describe('ota-signature.util', () => {
  const release = { platform: 'android', version: '1.30.0', checksum: 'a'.repeat(64) };

  it('builds the exact message the release script and the app sign and verify', () => {
    expect(otaSigningMessage('android', '1.30.0', 'abc')).toBe('obix-ota-v1\nandroid\n1.30.0\nabc');
  });

  it('accepts a signature made by the matching private key', () => {
    const { privateKey, publicB64 } = keyPair();
    const signature = sign(privateKey, release.platform, release.version, release.checksum);

    expect(verifyOtaSignature({ ...release, signature }, publicB64)).toBe(true);
  });

  it('rejects a signature from a different key', () => {
    const attacker = keyPair();
    const trusted = keyPair();
    const signature = sign(attacker.privateKey, release.platform, release.version, release.checksum);

    expect(verifyOtaSignature({ ...release, signature }, trusted.publicB64)).toBe(false);
  });

  it.each([
    ['checksum', { checksum: 'b'.repeat(64) }],
    ['version', { version: '1.31.0' }],
    ['platform', { platform: 'android-playstore' }],
  ])('rejects a valid signature replayed with a different %s', (_name, change) => {
    const { privateKey, publicB64 } = keyPair();
    const signature = sign(privateKey, release.platform, release.version, release.checksum);

    expect(verifyOtaSignature({ ...release, ...change, signature }, publicB64)).toBe(false);
  });

  it('rejects garbage without throwing', () => {
    const { publicB64 } = keyPair();

    expect(verifyOtaSignature({ ...release, signature: 'not-base64!!' }, publicB64)).toBe(false);
    expect(verifyOtaSignature({ ...release, signature: '' }, publicB64)).toBe(false);
    expect(verifyOtaSignature({ ...release, signature: 'AAAA' }, 'not-a-key')).toBe(false);
  });
});
