export type Fulfillment = 'delivery' | 'pickup';

/**
 * Unit price for a dual-priced product at the given fulfillment, or null when the product has a
 * single price. selling_price is the delivery price; pickup_price is what a customer who collects
 * the order pays. Mirrors the API's fulfillmentPrice() (packages/api/.../fulfillment-price.util.ts).
 */
export function cartUnitPrice(
  product: { selling_price: string | number; pickup_price?: string | number | null },
  fulfillment: Fulfillment,
): number | null {
  if (product.pickup_price === null || product.pickup_price === undefined || product.pickup_price === '') return null;
  return fulfillment === 'pickup' ? Number(product.pickup_price) : Number(product.selling_price);
}
