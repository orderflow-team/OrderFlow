/**
 * Per-account failed-password counter. The per-IP rate limit alone can't stop
 * a guessing attack spread across many IPs, so after MAX_FAILURES wrong
 * passwords inside WINDOW_MS the account refuses password sign-in until the
 * window passes (OTP sign-in and password reset still work, so the real owner
 * is never stuck).
 *
 * Kept in memory: the API runs as a single container, and a restart only
 * resets the counters, it never locks anyone out.
 */
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_LOCK_WINDOW_MS = 15 * 60_000;
export const LOGIN_MAX_TRACKED_ACCOUNTS = 50_000;
const MAX_TRACKED_ACCOUNTS = LOGIN_MAX_TRACKED_ACCOUNTS;

interface Entry {
  failures: number;
  windowStart: number;
}

export class LoginAttempts {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  isLocked(account: string): boolean {
    const entry = this.current(account);
    return !!entry && entry.failures >= LOGIN_MAX_FAILURES;
  }

  recordFailure(account: string): void {
    const entry = this.current(account);
    if (entry) {
      entry.failures += 1;
      return;
    }
    if (this.entries.size >= MAX_TRACKED_ACCOUNTS) {
      this.sweep();
      // Still full of live entries (an attack spraying fake emails): drop the
      // oldest rather than grow without bound. Map iterates in insertion order.
      if (this.entries.size >= MAX_TRACKED_ACCOUNTS) {
        const oldest = this.entries.keys().next().value;
        if (oldest !== undefined) this.entries.delete(oldest);
      }
    }
    this.entries.set(account, { failures: 1, windowStart: this.now() });
  }

  recordSuccess(account: string): void {
    this.entries.delete(account);
  }

  private current(account: string): Entry | undefined {
    const entry = this.entries.get(account);
    if (entry && this.now() - entry.windowStart >= LOGIN_LOCK_WINDOW_MS) {
      this.entries.delete(account);
      return undefined;
    }
    return entry;
  }

  private sweep() {
    const now = this.now();
    for (const [account, entry] of this.entries) {
      if (now - entry.windowStart >= LOGIN_LOCK_WINDOW_MS) this.entries.delete(account);
    }
  }
}
