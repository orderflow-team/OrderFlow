import { describe, expect, it } from 'vitest';
import { cartUnitPrice } from './fulfillment-pricing';
import { isReturnablesEnabled } from './business-modules';
import { BUSINESS_PRESETS, presetById } from './business-presets';

describe('cartUnitPrice', () => {
  const jar = { selling_price: '30.00', pickup_price: '25.00' };

  it('uses the delivery price (selling_price) for delivery and pickup_price for pickup', () => {
    expect(cartUnitPrice(jar, 'delivery')).toBe(30);
    expect(cartUnitPrice(jar, 'pickup')).toBe(25);
  });

  it('returns null for a single-priced product', () => {
    expect(cartUnitPrice({ selling_price: 30 }, 'pickup')).toBeNull();
    expect(cartUnitPrice({ selling_price: 30, pickup_price: null }, 'pickup')).toBeNull();
    expect(cartUnitPrice({ selling_price: 30, pickup_price: '' }, 'pickup')).toBeNull();
  });

  it('treats a pickup price of 0 as a real price', () => {
    expect(cartUnitPrice({ selling_price: 30, pickup_price: 0 }, 'pickup')).toBe(0);
  });
});

describe('isReturnablesEnabled', () => {
  const on = { modules: { returnables: true } };

  it('is on only when the Others business switched it on', () => {
    expect(isReturnablesEnabled('others', on)).toBe(true);
    expect(isReturnablesEnabled(null, on)).toBe(true);
    expect(isReturnablesEnabled('others', { modules: {} })).toBe(false);
    expect(isReturnablesEnabled('others', null)).toBe(false);
  });

  it('ignores leftover settings on a business moved to a standard category', () => {
    expect(isReturnablesEnabled('grocery', on)).toBe(false);
  });
});

describe('water supplier preset', () => {
  it('turns returnables on and is the only preset that does', () => {
    expect(presetById('water')?.modules.returnables).toBe(true);
    expect(BUSINESS_PRESETS.filter((p) => p.modules.returnables).map((p) => p.id)).toEqual(['water']);
  });
});
