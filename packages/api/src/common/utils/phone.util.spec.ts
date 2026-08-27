import { normalizePhoneDigits } from './phone.util';

describe('normalizePhoneDigits', () => {
  it('strips spaces and dashes', () => {
    expect(normalizePhoneDigits('98765 43210')).toBe('9876543210');
    expect(normalizePhoneDigits('98765-43210')).toBe('9876543210');
  });

  it('strips a leading country code prefix character (+)', () => {
    expect(normalizePhoneDigits('+91 98765-43210')).toBe('919876543210');
  });

  it('returns an empty string for null/undefined/empty input', () => {
    expect(normalizePhoneDigits(null as any)).toBe('');
    expect(normalizePhoneDigits(undefined as any)).toBe('');
    expect(normalizePhoneDigits('')).toBe('');
  });

  it('leaves a plain digit string unchanged', () => {
    expect(normalizePhoneDigits('9876543210')).toBe('9876543210');
  });
});
