/**
 * Strips everything but digits so phone numbers entered with spaces, dashes,
 * or a country code (e.g. "+91 98765-43210" vs "9876543210") still match when
 * used as the identity key for linking two businesses (business-connections module).
 */
export function normalizePhoneDigits(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}
