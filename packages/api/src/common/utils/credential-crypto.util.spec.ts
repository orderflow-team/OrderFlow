import {
  encryptPassword,
  decryptPassword,
  needsReencryption,
  assertCredentialKeyConfigured,
} from './credential-crypto.util';

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

  describe('key rotation', () => {
    it('still decrypts rows written with JWT_SECRET after a dedicated key is introduced', () => {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
      process.env.JWT_SECRET = 'legacy-jwt-secret';
      const legacy = encryptPassword('old-row');

      process.env.CREDENTIAL_ENCRYPTION_KEY = 'brand-new-dedicated-key';

      expect(decryptPassword(legacy)).toBe('old-row');
      expect(needsReencryption(legacy)).toBe(true);
    });

    it('writes new rows with the dedicated key, so they survive a JWT_SECRET rotation', () => {
      process.env.JWT_SECRET = 'jwt-before';
      const fresh = encryptPassword('new-row');

      process.env.JWT_SECRET = 'jwt-after';

      expect(needsReencryption(fresh)).toBe(false);
      expect(decryptPassword(fresh)).toBe('new-row');
    });

    it('decrypts with CREDENTIAL_ENCRYPTION_KEY_PREVIOUS and flags the row for re-encryption', () => {
      process.env.CREDENTIAL_ENCRYPTION_KEY = 'key-one';
      const old = encryptPassword('rotating');

      process.env.CREDENTIAL_ENCRYPTION_KEY = 'key-two';
      process.env.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS = 'key-zero, key-one';

      expect(decryptPassword(old)).toBe('rotating');
      expect(needsReencryption(old)).toBe(true);
    });

    it('cannot decrypt a row once the key it was written with is gone', () => {
      process.env.CREDENTIAL_ENCRYPTION_KEY = 'key-one';
      const old = encryptPassword('lost');

      process.env.CREDENTIAL_ENCRYPTION_KEY = 'key-two';
      delete process.env.JWT_SECRET;

      expect(() => decryptPassword(old)).toThrow();
      expect(() => needsReencryption(old)).toThrow();
    });
  });

  describe('assertCredentialKeyConfigured', () => {
    const good = 'a-long-random-credential-key-123';

    it('does nothing outside production', () => {
      expect(() => assertCredentialKeyConfigured({ NODE_ENV: 'development' })).not.toThrow();
    });

    it('requires the dedicated key in production', () => {
      expect(() => assertCredentialKeyConfigured({ NODE_ENV: 'production', JWT_SECRET: 'x' })).toThrow(/must be set/);
    });

    it('rejects a key equal to JWT_SECRET', () => {
      expect(() =>
        assertCredentialKeyConfigured({ NODE_ENV: 'production', CREDENTIAL_ENCRYPTION_KEY: good, JWT_SECRET: good }),
      ).toThrow(/differ/);
    });

    it('rejects a short key', () => {
      expect(() =>
        assertCredentialKeyConfigured({ NODE_ENV: 'production', CREDENTIAL_ENCRYPTION_KEY: 'short', JWT_SECRET: 'x' }),
      ).toThrow(/24 characters/);
    });

    it('accepts a distinct, long key', () => {
      expect(() =>
        assertCredentialKeyConfigured({ NODE_ENV: 'production', CREDENTIAL_ENCRYPTION_KEY: good, JWT_SECRET: 'other' }),
      ).not.toThrow();
    });
  });
});
