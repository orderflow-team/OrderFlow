// Pasted/imported contact numbers often carry +91, 0, spaces or dashes — keep the last 10 digits.
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(-10);
}
