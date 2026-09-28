import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { AuthService } from './auth.service';
import { GoogleAuthDto } from './dto/google-auth.dto';

const TTL_MS = 10 * 60_000;
const MAX_PENDING = 5_000;

type GoogleAuthResult = Awaited<ReturnType<AuthService['googleAuth']>>;

interface HandoffSession {
  secretHash: string;
  code: string;
  expiresAt: number;
  result?: GoogleAuthResult;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/**
 * Google sign-in for installed apps without native Google sign-in (native
 * builds before 1.19). Google's popup can't complete inside the Capacitor
 * WebView, and those builds have no deep link for a redirect to return to.
 * Instead the app opens a handoff page on the website in the system browser,
 * the user signs in with Google there as usual, and the app collects the
 * resulting login by polling with a secret only it holds (the server only ever
 * sees its hash until the claim).
 *
 * Kept in memory: sessions live for minutes, and an API restart just means
 * tapping "Continue with Google" again.
 */
@Injectable()
export class AppGoogleHandoffService {
  private readonly sessions = new Map<string, HandoffSession>();

  constructor(private readonly authService: AuthService) {}

  create(secretHash: string) {
    this.sweep();
    if (this.sessions.size >= MAX_PENDING) {
      throw new BadRequestException('Too many pending sign-ins. Please try again in a minute.');
    }
    const sessionId = randomBytes(16).toString('hex');
    // Shown both in the app and on the browser page, so the user can confirm
    // the page they're signing in on belongs to the app in their hand.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    this.sessions.set(sessionId, { secretHash, code, expiresAt: Date.now() + TTL_MS });
    return { sessionId, code, expiresInSeconds: TTL_MS / 1000 };
  }

  describe(sessionId: string) {
    const session = this.pending(sessionId);
    return { code: session.code };
  }

  async complete(sessionId: string, dto: GoogleAuthDto) {
    const session = this.pending(sessionId);
    const result = await this.authService.googleAuth(dto);
    // Re-check: another request may have completed it during the await.
    if (session.result) {
      throw new BadRequestException('This sign-in was already completed.');
    }
    session.result = result;
    return { ok: true };
  }

  claim(sessionId: string, secret: string) {
    const session = this.sessions.get(sessionId);
    const expected = session ? Buffer.from(session.secretHash) : null;
    const given = Buffer.from(sha256(secret));
    if (
      !session ||
      session.expiresAt < Date.now() ||
      !expected ||
      expected.length !== given.length ||
      !timingSafeEqual(expected, given)
    ) {
      throw new NotFoundException('This sign-in has expired. Please try again.');
    }
    if (!session.result) {
      return { status: 'pending' as const };
    }
    this.sessions.delete(sessionId);
    return { status: 'complete' as const, ...session.result };
  }

  private pending(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.expiresAt < Date.now()) {
      throw new NotFoundException('This sign-in link has expired. Go back to the app and try again.');
    }
    if (session.result) {
      throw new BadRequestException('This sign-in was already completed. You can go back to the app.');
    }
    return session;
  }

  private sweep() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt < now) this.sessions.delete(id);
    }
  }
}
