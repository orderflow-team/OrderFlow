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
import { MailService } from './mail.service';

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
      role: 'admin',
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
      .andWhere(`otp.created_at > NOW() - INTERVAL '${OTP_REQUEST_COOLDOWN_SECONDS} seconds'`)
      .getOne();
    if (recent) {
      throw new BadRequestException('Please wait a minute before requesting another code');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires_at = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const otp = this.otpCodesRepository.create({ email, code, expires_at });
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
      where: { email: ILike(email), consumed: false },
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
        this.usersRepository.create({ email, role: 'admin' }),
      );
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is disabled');
    }

    return this.issueTokens(user);
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
      role: 'salesman',
    } as any;

    return this.issueTokens(guestUser);
  }
}
