import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
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

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(OtpCode) private otpCodesRepository: Repository<OtpCode>,
    private jwtService: JwtService,
    private mailService: MailService,
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
    const otp = await this.otpCodesRepository.findOne({
      where: { email: ILike(email), code: dto.code, consumed: false },
      order: { created_at: 'DESC' },
    });

    if (!otp || otp.expires_at < new Date()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

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
}
