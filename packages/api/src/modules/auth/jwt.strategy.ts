import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private dataSource: DataSource,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string; businessId: string; role: string }) {
    // Fire-and-forget, throttled to once/minute per user via the WHERE clause
    // (an UPDATE matching 0 rows costs a lookup but no write) — every
    // authenticated request runs this, so it must never block the response
    // or fail the request if the write itself errors.
    this.dataSource
      .query(
        `UPDATE users SET last_active_at = NOW() WHERE id = $1 AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL '60 seconds')`,
        [payload.sub],
      )
      .catch(() => {});

    return {
      userId: payload.sub,
      email: payload.email,
      businessId: payload.businessId,
      role: payload.role,
    };
  }
}
