// Canonical units used across the product form (see commonUnits in app/products/page.tsx).
const UNIT_ALIASES: Record<string, string> = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  g: 'gram', gm: 'gram', gms: 'gram', gram: 'gram', grams: 'gram',
  l: 'litre', ltr: 'litre', ltrs: 'litre', liter: 'litre', liters: 'litre', litre: 'litre', litres: 'litre',
  ml: 'ml', mls: 'ml', millilitre: 'ml', millilitres: 'ml',
  pc: 'piece', pcs: 'piece', piece: 'piece', pieces: 'piece',
  packet: 'packet', packets: 'packet', pkt: 'packet', pkts: 'packet',
  box: 'box', boxes: 'box',
  dozen: 'dozen', dz: 'dozen',
  bottle: 'bottle', bottles: 'bottle',
  strip: 'strip', strips: 'strip',
};

const UNIT_PATTERN = Object.keys(UNIT_ALIASES)
  .sort((a, b) => b.length - a.length) // match longer aliases first (e.g. "litres" before "l")
  .join('|');

const QUANTITY_UNIT_REGEX = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\b`, 'i');

/**
 * Pulls a trailing "<quantity> <unit>" out of free-text Quick Parchi item
 * names, e.g. "sotabean oil 5 ltrs" -> { quantity: 5, unit: 'litre' }.
 * Returns null when no recognizable unit is present.
 */
export function parseQuantityUnit(text: string): { quantity: number; unit: string } | null {
  const match = text.match(QUANTITY_UNIT_REGEX);
  if (!match) return null;

  const quantity = parseFloat(match[1]);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const unit = UNIT_ALIASES[match[2].toLowerCase()];
  return { quantity, unit };
}
