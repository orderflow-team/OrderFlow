import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ALLOW_GUEST_KEY } from '../decorators/allow-guest.decorator';
import { UserRole } from '../enums/user-role.enum';
import { ALLOW_MFA_SETUP_KEY } from '../decorators/allow-mfa-setup.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = (await super.canActivate(context)) as boolean;
    if (!authenticated) return false;

    // GUEST tokens are handed to anyone who scans a table QR or opens a
    // takeaway link — no login. Deny them on every route that hasn't
    // explicitly opted in with @AllowGuest().
    const user = context.switchToHttp().getRequest().user;
    if (user?.role === UserRole.GUEST) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_GUEST_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        throw new ForbiddenException('You do not have permission to perform this action');
      }
    }
    // MFA_REQUIRED_FOR_SUPER_ADMIN: until they enroll, a super admin can reach only @AllowMfaSetup() routes.
    if (user?.mfaSetupRequired) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_MFA_SETUP_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        throw new ForbiddenException('MFA_SETUP_REQUIRED');
      }
    }
    return true;
  }
}
