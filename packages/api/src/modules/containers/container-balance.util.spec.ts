import { pendingEmpties } from './container-balance.util';
import { fulfillmentPrice, normalizeFulfillment } from '../products/utils/fulfillment-price.util';

describe('pendingEmpties', () => {
  it('is delivered minus returned', () => {
    expect(
      pendingEmpties([
        { type: 'delivered', quantity: 5 },
        { type: 'returned', quantity: 3 },
      ]),
    ).toBe(2);
  });

  it('sums across several visits and accepts decimal strings from the database', () => {
    expect(
      pendingEmpties([
        { type: 'delivered', quantity: '2.00' },
        { type: 'delivered', quantity: '3.00' },
        { type: 'returned', quantity: '1.00' },
        { type: 'returned', quantity: '1.00' },
      ]),
    ).toBe(3);
  });

  it('applies signed adjustments', () => {
    expect(pendingEmpties([{ type: 'delivered', quantity: 4 }, { type: 'adjustment', quantity: -1 }])).toBe(3);
    expect(pendingEmpties([{ type: 'delivered', quantity: 4 }, { type: 'adjustment', quantity: 2 }])).toBe(6);
  });

  it('never goes negative when more empties come back than were delivered', () => {
    expect(pendingEmpties([{ type: 'delivered', quantity: 1 }, { type: 'returned', quantity: 4 }])).toBe(0);
  });

  it('is zero with no movements', () => {
    expect(pendingEmpties([])).toBe(0);
  });
});

describe('fulfillmentPrice', () => {
  const jar = { selling_price: '30.00', pickup_price: '25.00' };

  it('uses the delivery price (selling_price) for delivery and pickup_price for pickup', () => {
    expect(fulfillmentPrice(jar, 'delivery')).toBe(30);
    expect(fulfillmentPrice(jar, 'pickup')).toBe(25);
  });

  it('returns null for a single-priced product so normal pricing applies', () => {
    expect(fulfillmentPrice({ selling_price: 30, pickup_price: null }, 'pickup')).toBeNull();
    expect(fulfillmentPrice({ selling_price: 30 }, 'pickup')).toBeNull();
    expect(fulfillmentPrice(null, 'pickup')).toBeNull();
  });

  it('treats a pickup_price of 0 as a real (free) price', () => {
    expect(fulfillmentPrice({ selling_price: 30, pickup_price: 0 }, 'pickup')).toBe(0);
  });
});

describe('normalizeFulfillment', () => {
  it('defaults anything but "pickup" to delivery', () => {
    expect(normalizeFulfillment('pickup')).toBe('pickup');
    expect(normalizeFulfillment('delivery')).toBe('delivery');
    expect(normalizeFulfillment(undefined)).toBe('delivery');
    expect(normalizeFulfillment('bogus')).toBe('delivery');
  });
});
