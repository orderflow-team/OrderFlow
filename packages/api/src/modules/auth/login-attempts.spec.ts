import { LoginAttempts, LOGIN_LOCK_WINDOW_MS, LOGIN_MAX_FAILURES, LOGIN_MAX_TRACKED_ACCOUNTS } from './login-attempts';

describe('LoginAttempts', () => {
  let clock: number;
  let attempts: LoginAttempts;

  beforeEach(() => {
    clock = 1_000_000;
    attempts = new LoginAttempts(() => clock);
  });

  const fail = (account: string, times: number) => {
    for (let i = 0; i < times; i++) attempts.recordFailure(account);
  };

  it('locks an account after the maximum number of failures', () => {
    fail('owner@shop.in', LOGIN_MAX_FAILURES - 1);
    expect(attempts.isLocked('owner@shop.in')).toBe(false);
    fail('owner@shop.in', 1);
    expect(attempts.isLocked('owner@shop.in')).toBe(true);
  });

  it('only locks the account being attacked', () => {
    fail('owner@shop.in', LOGIN_MAX_FAILURES);
    expect(attempts.isLocked('other@shop.in')).toBe(false);
  });

  it('unlocks once the window has passed', () => {
    fail('owner@shop.in', LOGIN_MAX_FAILURES);
    clock += LOGIN_LOCK_WINDOW_MS;
    expect(attempts.isLocked('owner@shop.in')).toBe(false);
  });

  it('clears the counter on a successful sign-in', () => {
    fail('owner@shop.in', LOGIN_MAX_FAILURES - 1);
    attempts.recordSuccess('owner@shop.in');
    fail('owner@shop.in', 1);
    expect(attempts.isLocked('owner@shop.in')).toBe(false);
  });

  it('stays bounded when flooded with distinct accounts, evicting the oldest first', () => {
    fail('victim@shop.in', LOGIN_MAX_FAILURES);
    for (let i = 0; i < LOGIN_MAX_TRACKED_ACCOUNTS; i++) attempts.recordFailure(`spray-${i}@x.in`);

    expect((attempts as any).entries.size).toBeLessThanOrEqual(LOGIN_MAX_TRACKED_ACCOUNTS);
    // The oldest entry (the victim's) was evicted to make room.
    expect(attempts.isLocked('victim@shop.in')).toBe(false);
  });
});
