/**
 * MRP ceiling guardrail: selling_price must never exceed mrp, regardless of
 * what was requested. Callers pass in whatever price they computed/received;
 * this clamps it down to the legal maximum.
 */
export function enforceMrpCeiling(requestedSellingPrice: number, mrp: number): number {
  return Math.min(requestedSellingPrice, mrp);
}
