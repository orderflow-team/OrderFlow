/** First 2 digits of a GSTIN encode the issuing state (e.g. "27" = Maharashtra); null if absent/malformed. */
export function gstStateCode(gstin: string | null | undefined): string | null {
  const trimmed = gstin?.trim();
  return trimmed && /^\d{2}/.test(trimmed) ? trimmed.slice(0, 2) : null;
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
