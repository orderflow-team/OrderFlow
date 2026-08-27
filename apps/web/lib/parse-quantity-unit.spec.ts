import { describe, it, expect } from 'vitest';
import { parseQuantityUnit, canonicalUnitKey } from './parse-quantity-unit';

describe('parseQuantityUnit', () => {
  it('extracts a trailing quantity+unit from a free-text name', () => {
    expect(parseQuantityUnit('sotabean oil 5 ltrs')).toEqual({ quantity: 5, unit: 'L' });
  });

  it('normalizes a variety of unit aliases to their canonical form', () => {
    expect(parseQuantityUnit('rice 2kg')).toEqual({ quantity: 2, unit: 'kg' });
    expect(parseQuantityUnit('sugar 500 gm')).toEqual({ quantity: 500, unit: 'g' });
    expect(parseQuantityUnit('milk 1 liter')).toEqual({ quantity: 1, unit: 'L' });
    expect(parseQuantityUnit('water 250ml')).toEqual({ quantity: 250, unit: 'ml' });
    expect(parseQuantityUnit('eggs 1 dozen')).toEqual({ quantity: 1, unit: 'pcs' });
  });

  it('matches the longer alias before a shorter overlapping one (e.g. "liters" before "l")', () => {
    expect(parseQuantityUnit('oil 4liters')).toEqual({ quantity: 4, unit: 'L' });
  });

  it('supports a decimal quantity', () => {
    expect(parseQuantityUnit('oil 1.5 kg')).toEqual({ quantity: 1.5, unit: 'kg' });
  });

  it('returns null when no recognizable unit is present', () => {
    expect(parseQuantityUnit('plain product name')).toBeNull();
  });

  it('returns null for a zero or negative quantity', () => {
    expect(parseQuantityUnit('item 0kg')).toBeNull();
  });

  it('is case-insensitive on the unit', () => {
    expect(parseQuantityUnit('rice 2KG')).toEqual({ quantity: 2, unit: 'kg' });
  });
});

describe('canonicalUnitKey', () => {
  it('builds a canonical key from a quantity+unit string', () => {
    expect(canonicalUnitKey('1kg')).toBe('1kg');
    expect(canonicalUnitKey('500g')).toBe('500g');
    expect(canonicalUnitKey('1 kg')).toBe('1kg');
  });

  it('defaults to quantity 1 for a bare unit with no stated quantity', () => {
    expect(canonicalUnitKey('kg')).toBe('1kg');
  });

  it('falls back to the raw lowercased text when the unit is unrecognized', () => {
    expect(canonicalUnitKey('crate')).toBe('1crate');
  });

  it('trims surrounding whitespace', () => {
    expect(canonicalUnitKey('  1kg  ')).toBe('1kg');
  });
});
