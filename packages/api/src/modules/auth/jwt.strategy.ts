import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';

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
    // Guest sessions (table/takeaway QR logins) are synthetic ids like
    // "guest-<tableId>" — never a real row in `users`, so skip both queries
    // below entirely rather than let them fail against a non-UUID id.
    if (payload.role !== UserRole.GUEST) {
      // Real-time revocation check: disabling a user (admin/users page) used
      // to only block their *next* login/refresh — an already-issued access
      // token kept working for up to 24h regardless. This makes "disable
      // user" double as "force logout now": every authenticated request
      // re-checks is_active, so a token minted before the disable stops
      // working on its very next use.
      const rows = await this.dataSource.query(`SELECT is_active FROM users WHERE id = $1`, [payload.sub]);
      if (rows.length > 0 && rows[0].is_active === false) {
        throw new UnauthorizedException('Account disabled');
      }

      // Fire-and-forget, throttled to once/minute per user via the WHERE
      // clause (an UPDATE matching 0 rows costs a lookup but no write) —
      // every authenticated request runs this, so it must never block the
      // response or fail the request if the write itself errors.
      this.dataSource
        .query(
          `UPDATE users SET last_active_at = NOW() WHERE id = $1 AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL '60 seconds')`,
          [payload.sub],
        )
        .catch(() => {});
    }

    return {
      userId: payload.sub,
      email: payload.email,
      businessId: payload.businessId,
      role: payload.role,
    };
  }
}
