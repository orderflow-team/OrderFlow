import { describe, expect, it } from 'vitest';
import { BUSINESS_PRESETS, MODULE_INFO, presetById } from './business-presets';

describe('business presets', () => {
  it('have unique ids and every label the app renders', () => {
    const ids = BUSINESS_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of BUSINESS_PRESETS) {
      for (const label of Object.values(p.terminology)) expect(label.trim().length).toBeGreaterThan(0);
      expect(Object.keys(p.modules).sort()).toEqual(Object.keys(MODULE_INFO).sort());
      expect(p.categories.length).toBeGreaterThan(0);
    }
  });

  it('gives dropdown fields their options', () => {
    for (const p of BUSINESS_PRESETS) {
      for (const f of [...p.productFields, ...p.customerFields]) {
        if (f.type === 'options') expect(f.options?.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps a catch-all "Something else" option', () => {
    expect(presetById('general')?.label).toBe('Something else');
  });

  it('maps preset ids saved by the old 6-step wizard', () => {
    expect(presetById('construction')?.id).toBe('hardware');
    expect(presetById('hardware_rental')?.id).toBe('rental');
    expect(presetById('salon')?.id).toBe('salon');
    expect(presetById('restaurant')).toBeUndefined();
    expect(presetById(undefined)).toBeUndefined();
  });
});
