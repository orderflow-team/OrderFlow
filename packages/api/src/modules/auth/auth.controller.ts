import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Per-route overrides of the app-wide default throttle (app.module.ts) —
  // these are credential-guessing/spam surfaces, so they get much tighter
  // per-IP limits than ordinary polling traffic.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Public — the refresh token itself (verified via JWT signature/expiry) is
  // the credential here, same as every other identity-establishing route on
  // this controller.
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  // Also has its own 60s-per-email cooldown (auth.service.ts) — this catches
  // the case that misses (many different target emails from one IP).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  // Slightly looser than the others — legitimate typo retries are common
  // here, and each code already has its own 5-attempt server-side lockout.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/forgot')
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password/reset')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('password/change')
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, dto);
  }

  @Post('table-guest-login')
  async tableGuestLogin(@Body('tableId') tableId: string) {
    return this.authService.tableGuestLogin(tableId);
  }

  @Post('takeaway-guest-login')
  async takeawayGuestLogin(@Body('businessId') businessId: string) {
    return this.authService.takeawayGuestLogin(businessId);
  }
}
