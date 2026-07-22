import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../../database/entities/user.entity';
import { OtpCode } from '../../database/entities/otp-code.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MailService } from './mail.service';
import { UserRole } from '../../common/enums/user-role.enum';

const OTP_EXPIRY_MINUTES = 10;
const OTP_REQUEST_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(OtpCode) private otpCodesRepository: Repository<OtpCode>,
    private jwtService: JwtService,
    private mailService: MailService,
    private dataSource: DataSource,
  ) {}

  async signup(dto: SignupDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { email: ILike(email) } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const password_hash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepository.create({
      email,
      password_hash,
      full_name: dto.fullName,
      business_id: dto.businessId,
      role: UserRole.ADMIN,
    });

    const saved = await this.usersRepository.save(user);

    return this.issueTokens(saved);
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();
    const user = await this.usersRepository.findOne({ where: { email: ILike(email) } });
    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(dto.password, user.password_hash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is disabled');
    }

    return this.issueTokens(user);
  }

  /** Re-signs tokens with the user's current business_id (e.g. after onboarding a workspace). */
  async reissueTokensForUser(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.issueTokens(user);
  }

  /**
   * Email OTP login. Generates a 6-digit code valid for 10 minutes.
   * If SMTP isn't configured (or sending fails), MailService falls back to
   * logging it — see mail.service.ts.
   */
  async requestOtp(dto: RequestOtpDto) {
    const email = dto.email.toLowerCase();

    // Slows down both mailbox-spam and brute-force-via-repeated-codes abuse.
    // Compared entirely within Postgres (created_at and NOW() both come from
    // the DB's own clock) rather than against Node's Date.now() — the two
    // processes' clocks/timezone handling for "timestamp without time zone"
    // columns aren't guaranteed to agree.
    const recent = await this.otpCodesRepository
      .createQueryBuilder('otp')
      .where('otp.email ILIKE :email', { email })
      .andWhere('otp.purpose = :purpose', { purpose: 'login' })
      .andWhere(`otp.created_at > NOW() - INTERVAL '${OTP_REQUEST_COOLDOWN_SECONDS} seconds'`)
      .getOne();
    if (recent) {
      throw new BadRequestException('Please wait a minute before requesting another code');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires_at = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const otp = this.otpCodesRepository.create({ email, code, expires_at, purpose: 'login' });
    await this.otpCodesRepository.save(otp);

    const emailSent = await this.mailService.sendOtpEmail(email, code);

    // Only surface the code in the response when it wasn't actually emailed,
    // so the frontend's "no email provider configured" banner is accurate.
    const devOnly = !emailSent && process.env.NODE_ENV !== 'production' ? { devCode: code } : {};
    return { message: 'OTP sent', expiresInMinutes: OTP_EXPIRY_MINUTES, ...devOnly };
  }

  /** Verifying an OTP logs in an existing user or creates a new passwordless one. */
  async verifyOtp(dto: VerifyOtpDto) {
    const email = dto.email.toLowerCase();

    // Attempts are tracked against the latest outstanding code for this email
    // (not the specific code guessed) so a lockout can't be reset by simply
    // trying a different wrong code.
    const latest = await this.otpCodesRepository.findOne({
      where: { email: ILike(email), purpose: 'login', consumed: false },
      order: { created_at: 'DESC' },
    });

    if (!latest || latest.expires_at < new Date()) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    if (latest.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many incorrect attempts. Request a new code.');
    }
    if (latest.code !== dto.code) {
      latest.attempts += 1;
      await this.otpCodesRepository.save(latest);
      throw new BadRequestException('Invalid or expired OTP');
    }

    const otp = latest;
    otp.consumed = true;
    await this.otpCodesRepository.save(otp);

    let user = await this.usersRepository.findOne({ where: { email: ILike(email) } });
    if (!user) {
      user = await this.usersRepository.save(
        this.usersRepository.create({ email, role: UserRole.ADMIN }),
      );
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is disabled');
    }

    return this.issueTokens(user);
  }

  /**
   * Requests a password reset code. Always returns the same generic response
   * regardless of whether the email is registered, so the endpoint can't be
   * used to enumerate accounts — only actually sends/stores a code if a user
   * with a password exists for that email.
   */
  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const email = dto.email.toLowerCase();
    const genericResponse = { message: 'If an account exists for that email, a reset code has been sent.' };

    const user = await this.usersRepository.findOne({ where: { email: ILike(email) } });
    if (!user) {
      return genericResponse;
    }

    const recent = await this.otpCodesRepository
      .createQueryBuilder('otp')
      .where('otp.email ILIKE :email', { email })
      .andWhere('otp.purpose = :purpose', { purpose: 'password_reset' })
      .andWhere(`otp.created_at > NOW() - INTERVAL '${OTP_REQUEST_COOLDOWN_SECONDS} seconds'`)
      .getOne();
    if (recent) {
      return genericResponse;
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires_at = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const otp = this.otpCodesRepository.create({ email, code, expires_at, purpose: 'password_reset' });
    await this.otpCodesRepository.save(otp);

    const emailSent = await this.mailService.sendPasswordResetEmail(email, code);

    const devOnly = !emailSent && process.env.NODE_ENV !== 'production' ? { devCode: code } : {};
    return { ...genericResponse, ...devOnly };
  }

  /** Verifies a password-reset code and, if valid, updates the password and logs the user in. */
  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.toLowerCase();

    const latest = await this.otpCodesRepository.findOne({
      where: { email: ILike(email), purpose: 'password_reset', consumed: false },
      order: { created_at: 'DESC' },
    });

    if (!latest || latest.expires_at < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }
    if (latest.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many incorrect attempts. Request a new code.');
    }
    if (latest.code !== dto.code) {
      latest.attempts += 1;
      await this.otpCodesRepository.save(latest);
      throw new BadRequestException('Invalid or expired code');
    }

    const user = await this.usersRepository.findOne({ where: { email: ILike(email) } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    latest.consumed = true;
    await this.otpCodesRepository.save(latest);

    user.password_hash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersRepository.save(user);

    return this.issueTokens(user);
  }

  /**
   * Changes the password for an already-authenticated user. Requires the
   * current password to match — unless the account has none yet (e.g. it
   * was created via passwordless OTP signup), in which case this simply
   * sets one for the first time.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.password_hash) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required');
      }
      const matches = await bcrypt.compare(dto.currentPassword, user.password_hash);
      if (!matches) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    user.password_hash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersRepository.save(user);

    return { message: 'Password updated' };
  }

  private issueTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      businessId: user.business_id,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '24h' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        businessId: user.business_id,
      },
    };
  }

  async tableGuestLogin(tableId: string) {
    const TableEntity = require('../../database/entities/table.entity').Table;
    const table = await this.dataSource.getRepository(TableEntity).findOne({ where: { id: tableId } });
    if (!table) {
      throw new NotFoundException('Table not found');
    }

    const guestUser = {
      id: `guest-${table.id}`,
      email: `guest-${table.name.toLowerCase()}@orderflow.guest`,
      business_id: table.business_id,
      role: UserRole.GUEST,
    } as any;

    return this.issueTokens(guestUser);
  }

  async takeawayGuestLogin(businessId: string) {
    const BusinessEntity = require('../../database/entities/business.entity').Business;
    const business = await this.dataSource.getRepository(BusinessEntity).findOne({ where: { id: businessId } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const guestUser = {
      id: `guest-takeaway-${business.id}`,
      email: `guest-takeaway@orderflow.guest`,
      business_id: business.id,
      role: UserRole.GUEST,
    } as any;

    return this.issueTokens(guestUser);
  }
}
