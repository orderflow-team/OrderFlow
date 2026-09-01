/**
 * Normalizes a version string by stripping leading 'v', 'v.', or non-numeric prefixes,
 * and splitting into integer segments.
 */
function parseVersionSegments(v: string): number[] {
  if (!v) return [0];
  const cleaned = v.trim().replace(/^v\.?/i, '');
  const match = cleaned.match(/^\d+(\.\d+)*/);
  if (!match) return [0];
  return match[0].split('.').map((num) => parseInt(num, 10) || 0);
}

/** Compares two dotted version strings (e.g. "1.10" vs "1.9", "v.18" vs "1.18"). Positive if `a` > `b`. */
export function compareVersions(a: string, b: string): number {
  const partsA = parseVersionSegments(a);
  const partsB = parseVersionSegments(b);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

