import { SetMetadata } from '@nestjs/common';

export const ALLOW_MFA_SETUP_KEY = 'allowMfaSetup';

/**
 * Marks a route reachable by a super admin who has not yet set up two-factor
 * authentication while MFA_REQUIRED_FOR_SUPER_ADMIN is on. JwtAuthGuard blocks
 * every other route for them, so they can enroll but do nothing else.
 */
export const AllowMfaSetup = () => SetMetadata(ALLOW_MFA_SETUP_KEY, true);
