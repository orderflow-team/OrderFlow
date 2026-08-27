import { encryptPassword, decryptPassword } from './credential-crypto.util';

describe('credential-crypto.util', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, CREDENTIAL_ENCRYPTION_KEY: 'test-encryption-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('round-trips a plaintext password through encrypt then decrypt', () => {
    const encrypted = encryptPassword('SuperSecret123!');

    expect(encrypted).not.toBe('SuperSecret123!');
    expect(decryptPassword(encrypted)).toBe('SuperSecret123!');
  });

  it('produces a different ciphertext each time due to a random IV', () => {
    const first = encryptPassword('SamePassword');
    const second = encryptPassword('SamePassword');

    expect(first).not.toBe(second);
    expect(decryptPassword(first)).toBe('SamePassword');
    expect(decryptPassword(second)).toBe('SamePassword');
  });

  it('falls back to JWT_SECRET when CREDENTIAL_ENCRYPTION_KEY is unset', () => {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    process.env.JWT_SECRET = 'fallback-jwt-secret';

    const encrypted = encryptPassword('hello');

    expect(decryptPassword(encrypted)).toBe('hello');
  });

  it('throws when neither CREDENTIAL_ENCRYPTION_KEY nor JWT_SECRET is set', () => {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    delete process.env.JWT_SECRET;

    expect(() => encryptPassword('hello')).toThrow(/CREDENTIAL_ENCRYPTION_KEY or JWT_SECRET/);
  });

  it('fails to decrypt with a tampered payload (auth tag mismatch)', () => {
    const encrypted = encryptPassword('hello');
    const tampered = encrypted.slice(0, -4) + 'abcd';

    expect(() => decryptPassword(tampered)).toThrow();
  });
});
