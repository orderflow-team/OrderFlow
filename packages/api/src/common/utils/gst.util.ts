/** First 2 digits of a GSTIN encode the issuing state (e.g. "27" = Maharashtra); null if absent/malformed. */
export function gstStateCode(gstin: string | null | undefined): string | null {
  const trimmed = gstin?.trim();
  return trimmed && /^\d{2}/.test(trimmed) ? trimmed.slice(0, 2) : null;
}

// 2-digit state code + 10-char PAN (5 letters, 4 digits, 1 letter) + 1-digit
// entity/branch code (1-9 then A-Z) + fixed 'Z' + 1 checksum character.
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_CHECKSUM_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Validates a GSTIN's structure and its check-digit (15th character), per
 * the Luhn mod-36 algorithm GSTN uses: https://en.wikipedia.org/wiki/Luhn_mod_N_algorithm.
 * Processes the first 14 characters right-to-left with a 2/1-alternating
 * weight (factor 2 on the character immediately left of the checksum),
 * reduces each weighted value into base 36, and compares the resulting
 * check character against the 15th.
 *
 * Empty/null is treated as valid — GSTIN is optional (most walk-in retail
 * customers don't have one); this only rejects a *non-empty* value that's
 * malformed, so it's safe to use as a class-validator decorator.
 */
export function isValidGstin(gstin: string | null | undefined): boolean {
  const trimmed = gstin?.trim();
  if (!trimmed) return true;
  const value = trimmed.toUpperCase();
  if (!GSTIN_PATTERN.test(value)) return false;

  let factor = 2;
  let sum = 0;
  for (let i = 13; i >= 0; i--) {
    const codePoint = GSTIN_CHECKSUM_CHARS.indexOf(value[i]);
    const weighted = codePoint * factor;
    sum += Math.floor(weighted / 36) + (weighted % 36);
    factor = factor === 2 ? 1 : 2;
  }
  const checkCodePoint = (36 - (sum % 36)) % 36;
  return GSTIN_CHECKSUM_CHARS[checkCodePoint] === value[14];
}

/**
 * GST law: an intra-state sale is taxed as CGST+SGST (split evenly), an
 * inter-state sale as IGST (the full rate) — never both. Which applies is
 * decided by comparing the seller's and buyer's registered states, not
 * chosen per item. We can only tell them apart when both GSTINs are on
 * file; the common case (walk-in customer with no GSTIN) defaults to
 * intra-state, since that's true for the vast majority of retail counter
 * sales.
 */
export function isInterStateSale(
  business: { gst_number?: string | null } | null | undefined,
  customer: { gst_number?: string | null } | null | undefined,
): boolean {
  const businessState = gstStateCode(business?.gst_number);
  const customerState = gstStateCode(customer?.gst_number);
  return !!businessState && !!customerState && businessState !== customerState;
}

export function splitGst(amount: number, interState: boolean): { cgst: number; sgst: number; igst: number } {
  if (interState) return { cgst: 0, sgst: 0, igst: amount };
  return { cgst: amount / 2, sgst: amount / 2, igst: 0 };
}
