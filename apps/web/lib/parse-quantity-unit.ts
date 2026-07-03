// Canonical units used across the product form (see commonUnits in app/products/page.tsx).
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
  plate: 'plate', plates: 'plate'
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
