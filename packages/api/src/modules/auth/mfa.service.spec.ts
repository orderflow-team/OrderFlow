import * as OTPAuth from 'otpauth';
import { BadRequestException, ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import { MfaService } from './mfa.service';
import { UserRole } from '../../common/enums/user-role.enum';

/**
 * An in-memory stand-in for the users repository that mirrors the two conditional
 * UPDATEs the service relies on (step must move forward; recovery list must be unchanged),
 * so replay and double-spend protection are tested rather than assumed.
 */
function makeStore(initial: Record<string, any>) {
  const row = { id: 'u1', email: 'root@example.com', role: UserRole.ADMIN, mfa_enabled: false, mfa_secret: null, mfa_recovery_codes: null, mfa_last_step: null, ...initial };
  const repo: any = {
    update: jest.fn(async (_id: string, patch: any) => {
      Object.assign(row, patch);
    }),
    createQueryBuilder: jest.fn(() => {
      let patch: any = null;
      let params: any = {};
      let where = '';
      const qb: any = {
        addSelect: () => qb,
        where: (w: string, p: any) => {
          where = w;
          params = p;
          return qb;
        },
        getOne: async () => ({ ...row }),
        update: () => qb,
        set: (p: any) => {
          patch = p;
          return qb;
        },
        execute: async () => {
          const applies = where.includes('mfa_last_step')
            ? row.mfa_last_step === null || Number(row.mfa_last_step) < params.step
            : row.mfa_recovery_codes === params.old;
          if (applies) Object.assign(row, patch);
          return { affected: applies ? 1 : 0 };
        },
      };
      return qb;
    }),
  };
  return { row, repo };
}

const codeFor = (base32: string, offsetSteps = 0) =>
  new OTPAuth.TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(base32) }).generate({
    timestamp: Date.now() + offsetSteps * 30_000,
  });

describe('MfaService', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-credential-key';
    delete process.env.MFA_REQUIRED_FOR_SUPER_ADMIN;
  });
  afterEach(() => {
    process.env = { ...original };
  });

  const enrolled = async (initial: Record<string, any> = {}) => {
    const { row, repo } = makeStore(initial);
    const service = new MfaService(repo);
    const { secret, otpauthUrl } = await service.beginSetup('u1');
    const { recoveryCodes } = await service.enable('u1', codeFor(secret));
    return { service, row, repo, secret, otpauthUrl, recoveryCodes };
  };

  describe('setup and enable', () => {
    it('stores the secret encrypted and does not turn MFA on until a code is confirmed', async () => {
      const { row, repo } = makeStore({});
      const service = new MfaService(repo);

      const { secret, otpauthUrl } = await service.beginSetup('u1');

      expect(row.mfa_enabled).toBe(false);
      expect(row.mfa_secret).toBeTruthy();
      expect(row.mfa_secret).not.toContain(secret);
      expect(otpauthUrl).toMatch(/^otpauth:\/\/totp\/OBIX%20360:root%40example\.com\?/);
      expect(otpauthUrl).toContain(`secret=${secret}`);
    });

    it('rejects a wrong confirmation code and leaves MFA off', async () => {
      const { row, repo } = makeStore({});
      const service = new MfaService(repo);
      await service.beginSetup('u1');

      await expect(service.enable('u1', '000000')).rejects.toBeInstanceOf(BadRequestException);
      expect(row.mfa_enabled).toBe(false);
    });

    it('enables on a correct code and returns 10 distinct recovery codes, stored only as hashes', async () => {
      const { row, recoveryCodes } = await enrolled();

      expect(row.mfa_enabled).toBe(true);
      expect(recoveryCodes).toHaveLength(10);
      expect(new Set(recoveryCodes).size).toBe(10);
      expect(recoveryCodes[0]).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
      expect(row.mfa_recovery_codes).not.toContain(recoveryCodes[0]);
      expect(JSON.parse(row.mfa_recovery_codes!)).toHaveLength(10);
    });

    it('refuses to start setup again while MFA is on', async () => {
      const { service } = await enrolled();

      await expect(service.beginSetup('u1')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('verifyProof', () => {
    it('accepts a current code once, then refuses the same code (replay)', async () => {
      const { service, secret } = await enrolled();
      // enable() already burned the current step; the next step is valid and unused.
      const next = codeFor(secret, 1);

      expect(await service.verifyProof('u1', { code: next })).toBe(true);
      expect(await service.verifyProof('u1', { code: next })).toBe(false);
    });

    it('refuses a code from an earlier step than the last one accepted', async () => {
      const { service, secret } = await enrolled();
      expect(await service.verifyProof('u1', { code: codeFor(secret, 1) })).toBe(true);

      expect(await service.verifyProof('u1', { code: codeFor(secret, -1) })).toBe(false);
    });

    it('rejects codes with the wrong shape without touching the secret', async () => {
      const { service } = await enrolled();

      for (const code of ['', '12345', '1234567', 'abcdef', '12 34']) {
        expect(await service.verifyProof('u1', { code })).toBe(false);
      }
    });

    it('rejects everything for an account without MFA', async () => {
      const { repo } = makeStore({});
      const service = new MfaService(repo);

      expect(await service.verifyProof('u1', { code: '123456' })).toBe(false);
    });

    it('locks the account after repeated wrong codes, even for a correct one afterwards', async () => {
      const { service, secret } = await enrolled();
      for (let i = 0; i < 10; i++) await service.verifyProof('u1', { code: '000000' });

      await expect(service.verifyProof('u1', { code: codeFor(secret, 1) })).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('recovery codes', () => {
    it('accepts a recovery code once, in any case and with or without the dash', async () => {
      const { service, row, recoveryCodes } = await enrolled();
      const code = recoveryCodes[3];

      expect(await service.verifyProof('u1', { recoveryCode: code.toUpperCase().replace('-', ' ') })).toBe(true);
      expect(JSON.parse(row.mfa_recovery_codes!)).toHaveLength(9);
      expect(await service.verifyProof('u1', { recoveryCode: code })).toBe(false);
    });

    it('rejects an unknown recovery code', async () => {
      const { service } = await enrolled();

      expect(await service.verifyProof('u1', { recoveryCode: 'aaaaa-bbbbb' })).toBe(false);
    });

    it('does not let two simultaneous requests spend the same code', async () => {
      const { service, recoveryCodes } = await enrolled();

      const results = await Promise.all([
        service.verifyProof('u1', { recoveryCode: recoveryCodes[0] }),
        service.verifyProof('u1', { recoveryCode: recoveryCodes[0] }),
      ]);

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('regenerates a fresh set after a valid proof, invalidating the old ones', async () => {
      const { service, secret, recoveryCodes } = await enrolled();

      const { recoveryCodes: fresh } = await service.regenerateRecoveryCodes('u1', { code: codeFor(secret, 1) });

      expect(fresh).toHaveLength(10);
      expect(await service.verifyProof('u1', { recoveryCode: recoveryCodes[0] })).toBe(false);
      expect(await service.verifyProof('u1', { recoveryCode: fresh[0] })).toBe(true);
    });
  });

  describe('disable', () => {
    it('turns MFA off and wipes the secrets after a valid code', async () => {
      const { service, row, secret } = await enrolled();

      await service.disable('u1', { code: codeFor(secret, 1) });

      expect(row.mfa_enabled).toBe(false);
      expect(row.mfa_secret).toBeNull();
      expect(row.mfa_recovery_codes).toBeNull();
    });

    it('refuses to disable without a valid proof', async () => {
      const { service, row } = await enrolled();

      await expect(service.disable('u1', { code: '000000' })).rejects.toBeInstanceOf(BadRequestException);
      expect(row.mfa_enabled).toBe(true);
    });

    it('refuses to disable for a super admin when MFA is required', async () => {
      process.env.MFA_REQUIRED_FOR_SUPER_ADMIN = 'true';
      const { service, row, secret } = await enrolled({ role: UserRole.SUPER_ADMIN });

      await expect(service.disable('u1', { code: codeFor(secret, 1) })).rejects.toBeInstanceOf(ForbiddenException);
      expect(row.mfa_enabled).toBe(true);
    });
  });

  describe('status and policy', () => {
    it('reports enabled, required and remaining recovery codes', async () => {
      process.env.MFA_REQUIRED_FOR_SUPER_ADMIN = 'true';
      const { service } = await enrolled({ role: UserRole.SUPER_ADMIN });

      expect(await service.status('u1')).toEqual({ enabled: true, required: true, recoveryCodesRemaining: 10 });
    });

    it('only requires MFA for super admins, and only when the flag is on', () => {
      expect(MfaService.isRequiredFor(UserRole.SUPER_ADMIN)).toBe(false);
      process.env.MFA_REQUIRED_FOR_SUPER_ADMIN = 'true';
      expect(MfaService.isRequiredFor(UserRole.SUPER_ADMIN)).toBe(true);
      expect(MfaService.isRequiredFor(UserRole.ADMIN)).toBe(false);
    });
  });
});
