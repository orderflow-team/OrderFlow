import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

/**
 * Every business-scoped route accepts businessId as a client-supplied query
 * param or body field, and services filter directly by that value. Without
 * this guard, any authenticated user could pass another tenant's businessId
 * and read/write that tenant's data — this makes sure the supplied value can
 * never diverge from the tenant embedded in the caller's JWT.
 *
 * It also closes the opposite hole: a caller who simply *omits* businessId
 * (or sends it twice, which Express parses into an array) used to reach the
 * service with `undefined`, and a `where: { id, business_id: undefined }`
 * lookup can drop the tenant filter entirely. The caller's own businessId is
 * now written into the request whenever a usable one wasn't supplied, so
 * handlers and services always see the tenant from the token.
 *
 * Must run after JwtAuthGuard in the same @UseGuards(...) list so
 * request.user is already populated.
 */
@Injectable()
export class BusinessScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tokenBusinessId: string | undefined = request.user?.businessId || undefined;

    const isUsable = (id: unknown): id is string => typeof id === 'string' && id.length > 0;
    const suppliedIds = [request.query?.businessId, request.body?.businessId].filter(isUsable);

    if (!tokenBusinessId) {
      // Nothing to scope to. Only a platform super admin without a business of
      // their own may proceed (and only without naming a tenant); anyone else
      // would reach the service with no tenant filter at all.
      if (suppliedIds.length > 0 || request.user?.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Business mismatch');
      }
      return true;
    }

    if (suppliedIds.some((id) => id !== tokenBusinessId)) {
      throw new ForbiddenException('Business mismatch');
    }

    if (request.query && !isUsable(request.query.businessId)) {
      request.query.businessId = tokenBusinessId;
    }
    if (
      request.body &&
      typeof request.body === 'object' &&
      !Array.isArray(request.body) &&
      !isUsable(request.body.businessId)
    ) {
      request.body.businessId = tokenBusinessId;
    }
    return true;
  }
}
