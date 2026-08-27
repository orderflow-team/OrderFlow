import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBarcodeSuggestion } from './barcode-suggestion';
import apiClient from './api-client';

vi.mock('./api-client', () => ({ default: { get: vi.fn() } }));

describe('fetchBarcodeSuggestion', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('returns the suggestion payload on success', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { name: 'Widget', suggestedPrice: 50 } });

    const result = await fetchBarcodeSuggestion('12345');

    expect(apiClient.get).toHaveBeenCalledWith('/api/products/barcode-lookup', { params: { barcode: '12345' } });
    expect(result).toEqual({ name: 'Widget', suggestedPrice: 50 });
  });

  it('returns null when the API has no match', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: null });

    expect(await fetchBarcodeSuggestion('00000')).toBeNull();
  });

  it('returns null instead of throwing when the request fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('network error'));

    expect(await fetchBarcodeSuggestion('12345')).toBeNull();
  });
});
