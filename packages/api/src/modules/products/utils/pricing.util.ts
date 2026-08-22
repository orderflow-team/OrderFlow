/**
 * MRP ceiling guardrail: selling_price must never exceed mrp, regardless of
 * what was requested. Callers pass in whatever price they computed/received;
 * this clamps it down to the legal maximum.
 */
export function enforceMrpCeiling(requestedSellingPrice: number, mrp: number): number {
  return Math.min(requestedSellingPrice, mrp);
}

// Mirrors apps/web/lib/parse-quantity-unit.ts's UNIT_ALIASES exactly (not
// imported directly — apps/web and packages/api are separate TS projects
// with no shared package set up) so a per-unit price override saved via the
// New Order screen's "save this unit's price" action, keyed by
// canonicalUnitKey there, is found under the SAME key here when a chat order
// later asks for that same quantity+unit combo. Keep these two in sync.
const UNIT_ALIASES: Record<string, string> = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g',
  l: 'L', ltr: 'L', ltrs: 'L', liter: 'L', liters: 'L', litre: 'L', litres: 'L',
  ml: 'ml', mls: 'ml', millilitre: 'ml', millilitres: 'ml',
  pc: 'pcs', pcs: 'pcs', piece: 'pcs', pieces: 'pcs',
  packet: 'pkt', packets: 'pkt', pkt: 'pkt', pkts: 'pkt',
  box: 'box', boxes: 'box',
  dozen: 'pcs', dz: 'pcs',
  bottle: 'pcs', bottles: 'pcs',
  strip: 'pcs', strips: 'pcs',
  plate: 'plate', plates: 'plate',
};

const UNIT_PATTERN = Object.keys(UNIT_ALIASES)
  .sort((a, b) => b.length - a.length)
  .join('|');
const QUANTITY_UNIT_REGEX = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\b`, 'i');

function parseQuantityUnitAlias(text: string): { quantity: number; unit: string } | null {
  const match = text.match(QUANTITY_UNIT_REGEX);
  if (!match) return null;
  const quantity = parseFloat(match[1]);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const unit = UNIT_ALIASES[match[2].toLowerCase()];
  return { quantity, unit };
}

function canonicalUnitKey(text: string): string {
  const trimmed = (text || '').trim();
  const parsed = parseQuantityUnitAlias(trimmed);
  if (parsed) return `${parsed.quantity}${parsed.unit}`;
  const bareUnit = UNIT_ALIASES[trimmed.toLowerCase()] || trimmed.toLowerCase();
  return `1${bareUnit}`;
}

// Broader mass/volume family recognition than UNIT_ALIASES above — covers
// spellings order-parser.service.ts's chat parser also accepts (quintal,
// kilogram, millilitre, etc.). Used only for the proportional-conversion
// fallback below, never for the override-key lookup, which must stay in
// exact sync with the frontend's narrower UNIT_ALIASES to find the same
// saved overrides.
function normalizeUnitFamily(unit: string): 'g' | 'kg' | 'ml' | 'L' | null {
  const lower = (unit || '').trim().toLowerCase();
  if (['g', 'gm', 'gms', 'gram', 'grams'].includes(lower)) return 'g';
  if (['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'].includes(lower)) return 'kg';
  if (['ml', 'mls', 'millilitre', 'millilitres', 'milliliter', 'milliliters'].includes(lower)) return 'ml';
  if (['l', 'ltr', 'ltrs', 'liter', 'liters', 'litre', 'litres'].includes(lower)) return 'L';
  return null;
}

/**
 * Converts a stated quantity+unit (e.g. 500 "ml") into a PER-UNIT price
 * appropriate for a product stored/priced in a DIFFERENT unit (e.g. sold at
 * ₹150 per "liter") — so `unitPrice * requestedQuantity` downstream comes
 * out to ₹75 for 500ml, instead of treating "500" as 500 liters and
 * charging ₹75,000. Mirrors generic-order-modal.tsx's updateCartUnit exactly
 * (same override-then-proportional-math priority), just applied server-side
 * so EVERY order-creation path gets it — the New Order screen's manual unit
 * picker was previously the only caller doing this conversion at all; a chat
 * order specifying a different unit than the product's own was silently
 * priced as if quantity meant "how many of the product's base unit", not
 * "how many of the unit actually stated".
 *
 * Returns null (no conversion needed/possible) when:
 * - no unit was stated, the stated quantity is invalid, or the stated unit
 *   already matches the product's own unit (nothing to convert)
 * - the stated unit and the product's own unit aren't in the same family
 *   (both mass, or both volume) — e.g. asking for "kg" of a liter-priced
 *   product isn't something this can safely guess a conversion for, same
 *   limitation the New Order screen's own conversion has today.
 * Callers should fall back to the product's plain selling_price in either
 * case, exactly as before this existed.
 */
export function convertUnitPrice(
  requestedQuantity: number,
  requestedUnit: string | null | undefined,
  product: { unit: string; selling_price: number | string; unit_prices?: Record<string, number> | null },
): number | null {
  if (!requestedUnit || !Number.isFinite(requestedQuantity) || requestedQuantity <= 0) return null;
  const productUnit = (product.unit || '').trim();
  if (!productUnit || requestedUnit.trim().toLowerCase() === productUnit.toLowerCase()) return null;

  const requestedCombined = `${requestedQuantity}${requestedUnit}`;
  const savedOverride = product.unit_prices?.[canonicalUnitKey(requestedCombined)];
  if (savedOverride !== undefined) {
    return savedOverride / requestedQuantity;
  }

  const parsedOriginal = parseQuantityUnitAlias(productUnit) || { quantity: 1, unit: productUnit };
  const normOriginal = normalizeUnitFamily(parsedOriginal.unit);
  const normNew = normalizeUnitFamily(requestedUnit);
  const isMass = (u: string | null) => u === 'kg' || u === 'g';
  const isVol = (u: string | null) => u === 'L' || u === 'ml';
  if (!normOriginal || !normNew || !((isMass(normOriginal) && isMass(normNew)) || (isVol(normOriginal) && isVol(normNew)))) {
    return null;
  }

  // Price per 1 basic unit (gram or ml) of the product's own pricing.
  let pricePerBasicUnit = Number(product.selling_price) / parsedOriginal.quantity;
  if (normOriginal === 'kg' || normOriginal === 'L') pricePerBasicUnit /= 1000;

  // Scale up to price per 1 of the REQUESTED unit — deliberately NOT
  // multiplied by requestedQuantity here (unlike the reference
  // implementation's `finalPrice`, which computes a total for one whole
  // occurrence of the requested unit): the caller already multiplies by
  // requestedQuantity itself, so this must be a true per-single-unit rate.
  return normNew === 'kg' || normNew === 'L' ? pricePerBasicUnit * 1000 : pricePerBasicUnit;
}
