import { describe, it, expect } from 'vitest';
import { normalizePhone } from './normalize-phone';

describe('normalizePhone', () => {
  it('keeps the last 10 digits of pasted contact numbers', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalizePhone('098765 43210')).toBe('9876543210');
  });
  it('drops non-digits and leaves partial input intact while typing', () => {
    expect(normalizePhone('98a76')).toBe('9876');
    expect(normalizePhone('')).toBe('');
  });
});
