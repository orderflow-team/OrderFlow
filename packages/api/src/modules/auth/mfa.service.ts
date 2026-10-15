import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import * as OTPAuth from 'otpauth';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { decryptPassword, encryptPassword } from '../../common/utils/credential-crypto.util';
import { LoginAttempts } from './login-attempts';

const ISSUER = 'OBIX 360';
const PERIOD_SECONDS = 30;
const RECOVERY_CODE_COUNT = 10;

export interface MfaProof {
  code?: string;
  recoveryCode?: string;
}

/**
 * Time-based one-time passwords (RFC 6238) for sign-in.
 *
 * - The secret is stored encrypted and only ever shown once, at enrollment.
 * - A code is accepted once: its 30-second step is recorded atomically, so a
 *   code seen over a shoulder or in a log cannot be replayed.
 * - Wrong codes count against the account (not the IP), so guessing is capped even
 *   when spread across many addresses. A lock only blocks MFA attempts; it does not lock the password.
 * - Single-use recovery codes cover a lost phone. They are stored as bcrypt hashes.
 */
@Injectable()
export class MfaService {
  private readonly attempts = new LoginAttempts();

  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /** Whether this role must have MFA before it can do anything (MFA_REQUIRED_FOR_SUPER_ADMIN=true). */
  static isRequiredFor(role: string | undefined): boolean {
    return role === UserRole.SUPER_ADMIN && process.env.MFA_REQUIRED_FOR_SUPER_ADMIN === 'true';
  }

  async status(userId: string) {
    const user = await this.loadWithSecrets(userId);
    return {
      enabled: user.mfa_enabled,
      required: MfaService.isRequiredFor(user.role),
      recoveryCodesRemaining: user.mfa_enabled ? this.parseHashes(user.mfa_recovery_codes).length : 0,
    };
  }

  /** Starts enrollment: creates a fresh secret that does nothing until enable() confirms a code from it. */
  async beginSetup(userId: string) {
    const user = await this.loadWithSecrets(userId);
    if (user.mfa_enabled) {
      throw new ConflictException('Two-factor authentication is already on. Turn it off first to set it up again.');
    }
    const secret = new OTPAuth.Secret({ size: 20 });
    await this.users.update(user.id, { mfa_secret: encryptPassword(secret.base32), mfa_last_step: null });
    return { secret: secret.base32, otpauthUrl: this.totp(secret, user.email).toString() };
  }

  /** Confirms enrollment with a code from the authenticator app and returns the recovery codes (shown once). */
  // Wrong codes on the signed-in routes below are 400, not 401: the web client treats a 401 as an
  // expired session and signs the user out.
  async enable(userId: string, code: string) {
    const user = await this.loadWithSecrets(userId);
    if (user.mfa_enabled) {
      throw new ConflictException('Two-factor authentication is already on.');
    }
    if (!user.mfa_secret) {
      throw new BadRequestException('Start the setup first.');
    }
    this.assertNotLocked(user.id);
    if (!(await this.acceptTotp(user, code))) {
      this.attempts.recordFailure(this.key(user.id));
      throw new BadRequestException('That code is not right. Check the time on your phone and try again.');
    }
    this.attempts.recordSuccess(this.key(user.id));
    const { plain, hashes } = await this.newRecoveryCodes();
    await this.users.update(user.id, { mfa_enabled: true, mfa_recovery_codes: JSON.stringify(hashes) });
    return { recoveryCodes: plain };
  }

  /** Checks a sign-in proof (authenticator code or recovery code). Throws when locked; returns false when wrong. */
  async verifyProof(userId: string, proof: MfaProof): Promise<boolean> {
    const user = await this.loadWithSecrets(userId);
    if (!user.mfa_enabled || !user.mfa_secret) return false;
    this.assertNotLocked(user.id);

    const ok = proof.code
      ? await this.acceptTotp(user, proof.code)
      : proof.recoveryCode
        ? await this.consumeRecoveryCode(user, proof.recoveryCode)
        : false;

    if (ok) this.attempts.recordSuccess(this.key(user.id));
    else this.attempts.recordFailure(this.key(user.id));
    return ok;
  }

  async disable(userId: string, proof: MfaProof) {
    const user = await this.loadWithSecrets(userId);
    if (!user.mfa_enabled) return { enabled: false };
    if (MfaService.isRequiredFor(user.role)) {
      throw new ForbiddenException('Two-factor authentication is required for this account and cannot be turned off.');
    }
    if (!(await this.verifyProof(user.id, proof))) {
      throw new BadRequestException('That code is not right.');
    }
    await this.users.update(user.id, { mfa_enabled: false, mfa_secret: null, mfa_recovery_codes: null, mfa_last_step: null });
    return { enabled: false };
  }

  async regenerateRecoveryCodes(userId: string, proof: MfaProof) {
    const user = await this.loadWithSecrets(userId);
    if (!user.mfa_enabled) {
      throw new BadRequestException('Two-factor authentication is not on.');
    }
    if (!(await this.verifyProof(user.id, proof))) {
      throw new BadRequestException('That code is not right.');
    }
    const { plain, hashes } = await this.newRecoveryCodes();
    await this.users.update(user.id, { mfa_recovery_codes: JSON.stringify(hashes) });
    return { recoveryCodes: plain };
  }

  // ---- internals ----

  private key(userId: string) {
    return `mfa:${userId}`;
  }

  private assertNotLocked(userId: string) {
    if (this.attempts.isLocked(this.key(userId))) {
      throw new HttpException(
        'Too many incorrect codes. Try again in 15 minutes, or use a recovery code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async loadWithSecrets(userId: string): Promise<User> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect(['user.mfa_secret', 'user.mfa_recovery_codes', 'user.mfa_last_step'])
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private totp(secret: OTPAuth.Secret, email: string) {
    return new OTPAuth.TOTP({ issuer: ISSUER, label: email, algorithm: 'SHA1', digits: 6, period: PERIOD_SECONDS, secret });
  }

  /** Verifies a code against the stored secret (one step either side for clock drift) and burns its step. */
  private async acceptTotp(user: User, rawCode: string): Promise<boolean> {
    const code = (rawCode ?? '').replace(/\s+/g, '');
    if (!/^\d{6}$/.test(code) || !user.mfa_secret) return false;

    let secretBase32: string;
    try {
      secretBase32 = decryptPassword(user.mfa_secret);
    } catch {
      return false;
    }
    const delta = this.totp(OTPAuth.Secret.fromBase32(secretBase32), user.email).validate({ token: code, window: 1 });
    if (delta === null) return false;

    const step = Math.floor(Date.now() / 1000 / PERIOD_SECONDS) + delta;
    // Only moves forward: a step that was already used (or an older one) matches no row.
    const result = await this.users
      .createQueryBuilder()
      .update(User)
      .set({ mfa_last_step: String(step) })
      .where('id = :id AND (mfa_last_step IS NULL OR mfa_last_step < :step)', { id: user.id, step })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  private async newRecoveryCodes() {
    const plain = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const raw = randomBytes(5).toString('hex'); // 40 bits
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
    const hashes = await Promise.all(plain.map((c) => bcrypt.hash(this.normalizeRecovery(c), 10)));
    return { plain, hashes };
  }

  private normalizeRecovery(code: string) {
    return (code ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private parseHashes(raw: string | null): string[] {
    try {
      const parsed = JSON.parse(raw ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((h) => typeof h === 'string') : [];
    } catch {
      return [];
    }
  }

  /** Spends a recovery code. The update only applies if the stored list is unchanged, so two requests cannot spend the same code. */
  private async consumeRecoveryCode(user: User, rawCode: string): Promise<boolean> {
    const code = this.normalizeRecovery(rawCode);
    if (code.length !== 10 || !user.mfa_recovery_codes) return false;
    const hashes = this.parseHashes(user.mfa_recovery_codes);
    let matched = -1;
    for (let i = 0; i < hashes.length; i++) {
      if (await bcrypt.compare(code, hashes[i])) {
        matched = i;
        break;
      }
    }
    if (matched === -1) return false;

    const remaining = hashes.filter((_, i) => i !== matched);
    const result = await this.users
      .createQueryBuilder()
      .update(User)
      .set({ mfa_recovery_codes: JSON.stringify(remaining) })
      .where('id = :id AND mfa_recovery_codes = :old', { id: user.id, old: user.mfa_recovery_codes })
      .execute();
    return (result.affected ?? 0) > 0;
  }
}
