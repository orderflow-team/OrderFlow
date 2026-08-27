import { describe, it, expect } from 'vitest';
import { INDUSTRY_PRESETS, type IndustryPreset } from './industry-presets';

const REQUIRED_STRING_FIELDS: (keyof IndustryPreset)[] = [
  'id',
  'name',
  'emoji',
  'productsLabel',
  'skuLabel',
  'priceLabel',
  'ordersLabel',
  'customersLabel',
  'staffLabel',
];

describe('INDUSTRY_PRESETS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(INDUSTRY_PRESETS)).toBe(true);
    expect(INDUSTRY_PRESETS.length).toBeGreaterThan(0);
  });

  it('has every preset carrying a non-empty value for every required field', () => {
    for (const preset of INDUSTRY_PRESETS) {
      for (const field of REQUIRED_STRING_FIELDS) {
        const value = preset[field];
        expect(typeof value, `${preset.id}.${field} should be a string`).toBe('string');
        expect((value as string).trim().length, `${preset.id}.${field} should not be blank`).toBeGreaterThan(0);
      }
    }
  });

  it('has no duplicate preset ids', () => {
    const ids = INDUSTRY_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate preset names', () => {
    const names = INDUSTRY_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses lowercase, snake_case-safe ids (matches what a URL/enum consumer would expect)', () => {
    for (const preset of INDUSTRY_PRESETS) {
      expect(preset.id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('includes the core presets the app onboarding flow depends on', () => {
    const ids = INDUSTRY_PRESETS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['retail', 'restaurant', 'wholesale']));
  });
});
