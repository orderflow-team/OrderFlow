import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate } from './format-currency';

describe('formatCurrency', () => {
  it('formats a whole number as INR', () => {
    expect(formatCurrency(1500)).toBe('₹1,500.00');
  });

  it('formats with Indian digit grouping for large numbers', () => {
    expect(formatCurrency(150000)).toBe('₹1,50,000.00');
  });

  it('respects a custom maximumFractionDigits', () => {
    expect(formatCurrency(1500.456, 0)).toBe('₹1,500');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('₹0.00');
  });

  it('formats a negative value', () => {
    expect(formatCurrency(-500)).toBe('-₹500.00');
  });
});

describe('formatDate', () => {
  it('formats a date string using the default en-IN options', () => {
    expect(formatDate('2026-03-15')).toMatch(/15 Mar 2026/);
  });

  it('respects custom formatting options', () => {
    expect(formatDate('2026-03-15', { year: 'numeric' })).toBe('2026');
  });
});
