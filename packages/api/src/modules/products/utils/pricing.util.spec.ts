import { convertUnitPrice, enforceMrpCeiling, unitFamilyMismatch } from './pricing.util';

describe('enforceMrpCeiling', () => {
  it('returns the requested price when it is below the mrp', () => {
    expect(enforceMrpCeiling(80, 100)).toBe(80);
  });

  it('clamps the requested price down to the mrp when it exceeds it', () => {
    expect(enforceMrpCeiling(150, 100)).toBe(100);
  });

  it('returns the price unchanged when it exactly equals the mrp', () => {
    expect(enforceMrpCeiling(100, 100)).toBe(100);
  });
});

describe('unitFamilyMismatch', () => {
  it('returns false when no requested unit is given', () => {
    expect(unitFamilyMismatch('kg', undefined)).toBe(false);
  });

  it('returns false when the requested unit is not a recognized mass/volume unit', () => {
    expect(unitFamilyMismatch('kg', 'box')).toBe(false);
  });

  it('returns false when both units are in the mass family', () => {
    expect(unitFamilyMismatch('kg', 'g')).toBe(false);
  });

  it('returns false when both units are in the volume family', () => {
    expect(unitFamilyMismatch('L', 'ml')).toBe(false);
  });

  it('returns true when mass is requested for a volume-priced product', () => {
    expect(unitFamilyMismatch('L', 'kg')).toBe(true);
  });

  it('returns true when volume is requested for a mass-priced product', () => {
    expect(unitFamilyMismatch('kg', 'ml')).toBe(true);
  });

  it('returns true when the product unit is outside the mass/volume system entirely', () => {
    expect(unitFamilyMismatch('piece', 'kg')).toBe(true);
  });

  it('resolves a compound product unit like "500g" to its underlying family', () => {
    expect(unitFamilyMismatch('500g', 'kg')).toBe(false);
    expect(unitFamilyMismatch('500g', 'ml')).toBe(true);
  });
});

describe('convertUnitPrice', () => {
  const product = { unit: 'kg', selling_price: 100, unit_prices: null as Record<string, number> | null };

  it('returns null when no requested unit is given', () => {
    expect(convertUnitPrice(2, undefined, product)).toBeNull();
  });

  it('returns null when the requested quantity is not finite or non-positive', () => {
    expect(convertUnitPrice(0, 'g', product)).toBeNull();
    expect(convertUnitPrice(NaN, 'g', product)).toBeNull();
    expect(convertUnitPrice(-5, 'g', product)).toBeNull();
  });

  it('returns null when the requested unit matches the product unit already', () => {
    expect(convertUnitPrice(2, 'kg', product)).toBeNull();
    expect(convertUnitPrice(2, 'KG', product)).toBeNull();
  });

  it('returns null on a mass/volume family mismatch', () => {
    expect(convertUnitPrice(500, 'ml', product)).toBeNull();
  });

  it('converts kg pricing down to a per-gram rate', () => {
    // 100/kg -> 0.1/g
    expect(convertUnitPrice(250, 'g', product)).toBeCloseTo(0.1);
  });

  it('converts a per-gram-priced product up to a per-kg rate', () => {
    const gramProduct = { unit: 'g', selling_price: 0.5, unit_prices: null };
    // 0.5/g -> 500/kg
    expect(convertUnitPrice(2, 'kg', gramProduct)).toBeCloseTo(500);
  });

  it('converts liter pricing down to a per-ml rate', () => {
    const literProduct = { unit: 'L', selling_price: 120, unit_prices: null };
    expect(convertUnitPrice(500, 'ml', literProduct)).toBeCloseTo(0.12);
  });

  it('uses a saved unit-price override when present, dividing by the requested quantity', () => {
    const overriddenProduct = { unit: 'kg', selling_price: 100, unit_prices: { '250g': 30 } };
    expect(convertUnitPrice(250, 'g', overriddenProduct)).toBeCloseTo(30 / 250);
  });

  it('resolves a compound product unit like "500g" before converting', () => {
    const compoundProduct = { unit: '500g', selling_price: 50, unit_prices: null };
    // 50 for 500g => 0.1/g => 100/kg
    expect(convertUnitPrice(1, 'kg', compoundProduct)).toBeCloseTo(100);
  });

  it('returns null when the product has no unit set', () => {
    const noUnitProduct = { unit: '', selling_price: 100, unit_prices: null };
    expect(convertUnitPrice(2, 'kg', noUnitProduct)).toBeNull();
  });
});
