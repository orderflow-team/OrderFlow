import apiClient from './api-client';

export interface BarcodeSuggestion {
  name: string;
  suggestedPrice: number | null;
}

/**
 * Cross-tenant lookup: what another business has already named this barcode,
 * if anyone has (see shared_barcode_catalog / GET /api/products/barcode-lookup).
 * Returns null on no match or on any failure — callers should treat this as
 * "no suggestion available" rather than an error.
 */
export async function fetchBarcodeSuggestion(barcode: string): Promise<BarcodeSuggestion | null> {
  try {
    const res = await apiClient.get<BarcodeSuggestion | null>('/api/products/barcode-lookup', { params: { barcode } });
    return res.data;
  } catch {
    return null;
  }
}
