import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';

/**
 * Applied alongside JwtAuthGuard. Routes without @Roles() are left open to
 * any authenticated user — only annotated routes are restricted.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.user?.role;

    // Platform super admins outrank every per-route @Roles() list — they use
    // this same login to own/manage a business too, so requiring every
    // controller to separately allowlist SUPER_ADMIN would just be a standing
    // invitation to forget one (as happened with reports/products/etc.).
    if (userRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return true;
  }
}
