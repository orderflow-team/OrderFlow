import { describe, it, expect, vi, afterEach } from 'vitest';
import { expiryStatus } from './expiry-status';

describe('expiryStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when no date is given', () => {
    expect(expiryStatus(null)).toBeNull();
    expect(expiryStatus(undefined)).toBeNull();
  });

  it('flags an already-expired date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01'));

    const result = expiryStatus('2026-05-01');

    expect(result?.label).toBe('Expired');
    expect(result?.tone).toContain('rose');
  });

  it('flags a date within the next 60 days as expiring soon, with a day count', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));

    const result = expiryStatus('2026-06-15T00:00:00Z');

    expect(result?.label).toBe('Expires in 14d');
    expect(result?.tone).toContain('amber');
  });

  it('shows a plain month/year for a date further than 60 days out', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01'));

    const result = expiryStatus('2026-12-25');

    expect(result?.label).toMatch(/^Exp Dec 26$/);
    expect(result?.tone).toContain('slate');
  });
});
