import { SetMetadata } from '@nestjs/common';

export const ALLOW_GUEST_KEY = 'allowGuest';

/**
 * Opts a route in to anonymous GUEST tokens (table QR / takeaway link).
 * JwtAuthGuard rejects guests everywhere else, so a new endpoint is
 * staff-only by default instead of silently open to anyone with a QR code.
 */
export const AllowGuest = () => SetMetadata(ALLOW_GUEST_KEY, true);
