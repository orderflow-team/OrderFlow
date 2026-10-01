import { UserRole } from '../enums/user-role.enum';

/**
 * What an anonymous guest is allowed to touch, derived from the synthetic id
 * AuthService.tableGuestLogin / takeawayGuestLogin put in the token:
 * "guest-<tableId>" for a table QR, "guest-takeaway-<businessId>" for the
 * takeaway link. Returns null for every real (staff) user.
 */
export type GuestScope = { kind: 'table'; tableId: string } | { kind: 'takeaway' };

export function getGuestScope(user?: { role?: string; userId?: string }): GuestScope | null {
  if (user?.role !== UserRole.GUEST) return null;
  const id = user.userId ?? '';
  if (id.startsWith('guest-takeaway-')) return { kind: 'takeaway' };
  return { kind: 'table', tableId: id.slice('guest-'.length) };
}
