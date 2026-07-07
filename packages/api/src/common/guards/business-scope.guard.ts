import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Every business-scoped route accepts businessId as a client-supplied query
 * param or body field, and services filter directly by that value. Without
 * this guard, any authenticated user could pass another tenant's businessId
 * and read/write that tenant's data — this makes sure the supplied value can
 * never diverge from the tenant embedded in the caller's JWT.
 *
 * Must run after JwtAuthGuard in the same @UseGuards(...) list so
 * request.user is already populated.
 */
@Injectable()
export class BusinessScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tokenBusinessId: string | undefined = request.user?.businessId;

    const suppliedIds = [request.query?.businessId, request.body?.businessId].filter(
      (id: unknown): id is string => typeof id === 'string' && id.length > 0,
    );

    if (suppliedIds.length === 0) {
      return true;
    }
    if (!tokenBusinessId || suppliedIds.some((id) => id !== tokenBusinessId)) {
      throw new ForbiddenException('Business mismatch');
    }
    return true;
  }
}
