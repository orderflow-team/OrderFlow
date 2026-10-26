export type Fulfillment = 'delivery' | 'pickup';

export function normalizeFulfillment(value: string | null | undefined): Fulfillment {
  return value === 'pickup' ? 'pickup' : 'delivery';
}

/**
 * A product is dual-priced when it carries a pickup_price: selling_price is then the delivery price
 * and pickup_price is what a customer who collects the order pays. Returns null for single-priced
 * products so callers fall through to the normal pricing (price history, unit conversion, tiers).
 */
export function fulfillmentPrice(
  product: { selling_price: number | string; pickup_price?: number | string | null } | null | undefined,
  fulfillment: Fulfillment,
): number | null {
  if (!product || product.pickup_price === null || product.pickup_price === undefined) return null;
  return fulfillment === 'pickup' ? Number(product.pickup_price) : Number(product.selling_price);
}
