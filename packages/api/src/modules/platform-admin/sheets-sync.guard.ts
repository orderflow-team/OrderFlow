import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Static read-only key for the Google Sheets pull script. The platform-admin
 * routes use short-lived JWTs, which a scheduled Apps Script can't hold.
 * With SHEETS_SYNC_KEY unset the endpoint answers 404, i.e. the feature is
 * off and its existence isn't advertised.
 */
@Injectable()
export class SheetsSyncKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('SHEETS_SYNC_KEY');
    if (!expected || expected.length < 24) throw new NotFoundException();

    const provided = context.switchToHttp().getRequest().headers['x-sync-key'];
    if (typeof provided !== 'string') throw new UnauthorizedException();

    // Hash both sides so timingSafeEqual gets equal-length buffers.
    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(expected).digest();
    if (!timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}
