import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { SubscriptionStatusResponse, SubscriptionsService } from './subscriptions.service';
import { UserRole } from '../../common/enums/user-role.enum';

// First path segment (after an optional /api) of routes that must keep working
// for a shop whose plan has lapsed: signing in, choosing/requesting a plan,
// platform admin, and app updates.
const EXEMPT_ROOTS = new Set([
  'auth',
  'subscriptions',
  'platform-admin',
  'app-updates',
  'app-apk-releases',
  'dev',
]);

const STATUS_TTL_MS = 15_000;
const STATUS_CACHE_MAX = 5_000;

/**
 * Enforces the subscription plan on every write request: lapsed plans can't
 * write (reads stay open), Starter shops have a monthly order cap, and Pro-only
 * modules are locked on Starter.
 *
 * This is an interceptor, not a guard, on purpose. It used to be a global
 * guard, but global guards run BEFORE the controller-level JwtAuthGuard, so
 * `req.user` was always empty at that point and the check silently passed for
 * everyone — nothing was ever enforced. Interceptors run after all guards, so
 * the authenticated user is there.
 *
 * Set PAYWALL_ENFORCED=false to switch enforcement off without a deploy.
 */
@Injectable()
export class SubscriptionPaywallInterceptor implements NestInterceptor {
  private readonly cache = new Map<string, { at: number; status: SubscriptionStatusResponse }>();

  constructor(private subscriptionsService: SubscriptionsService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    if (context.getType() !== 'http' || process.env.PAYWALL_ENFORCED === 'false') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next.handle();
    }

    const path: string = req.path || req.url || '';
    const segments = path.split('?')[0].split('/').filter(Boolean);
    const root = segments[0] === 'api' ? segments[1] : segments[0];
    if (root && EXEMPT_ROOTS.has(root)) {
      return next.handle();
    }

    const user = req.user as { userId?: string; businessId?: string; role?: string } | undefined;
    if (!user?.businessId || user.role === UserRole.SUPER_ADMIN) {
      // Unauthenticated routes (JwtAuthGuard already ran for the rest) and
      // platform staff are never paywalled.
      return next.handle();
    }

    const status = await this.statusFor(user.userId, user.businessId, user.role === UserRole.GUEST);

    if (status.status === 'expired' || status.status === 'past_due' || status.status === 'canceled') {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'PAYMENT_REQUIRED',
          message: 'Your free trial / subscription has expired. Please select a plan to continue operating your store.',
          planCode: status.planCode,
          trialDaysLeft: 0,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // Only creating an order counts toward the cap (not returns, payments or
    // item edits, which live under /api/orders/:id/...).
    if (method === 'POST' && segments[0] === 'api' && segments[1] === 'orders' && segments.length === 2) {
      const { ordersUsedThisMonth, maxOrdersPerMonth } = status.quotas;
      if (maxOrdersPerMonth > 0 && ordersUsedThisMonth >= maxOrdersPerMonth) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            error: 'ORDER_QUOTA_EXCEEDED',
            message: `Monthly limit of ${maxOrdersPerMonth} orders reached for the Starter Plan. Upgrade to Pro for unlimited orders.`,
            planCode: status.planCode,
            quotas: status.quotas,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    // Every invoice scan is a paid AI call; the plan's monthly scan allowance
    // was shown to shops but never actually enforced.
    if (method === 'POST' && segments[0] === 'api' && segments[1] === 'invoice-scans' && segments[2] === 'upload') {
      const { aiScansUsedThisMonth, maxAiScansPerMonth } = status.quotas;
      if (maxAiScansPerMonth >= 0 && aiScansUsedThisMonth >= maxAiScansPerMonth) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            error: 'AI_SCAN_QUOTA_EXCEEDED',
            message: `Monthly limit of ${maxAiScansPerMonth} AI invoice scans reached on your plan. Upgrade to scan more.`,
            planCode: status.planCode,
            quotas: status.quotas,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    if (status.planCode === 'starter' && segments[0] === 'api' && (segments[1] === 'restaurant' || segments[1] === 'salesman')) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'FEATURE_LOCKED',
          message: 'This feature is locked on the Mobile Starter Plan. Upgrade to the Pro Plan to unlock.',
          planCode: status.planCode,
          requiredPlan: 'pro',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return next.handle();
  }

  /**
   * Resolving a plan runs several queries (user, subscription, three usage
   * counts) and this now sits in front of every write, so the result is
   * reused for a few seconds. Guests (table/takeaway QR) have no user row,
   * so they take the plan of the business owner.
   */
  private async statusFor(userId: string | undefined, businessId: string, isGuest: boolean) {
    const key = `${isGuest ? 'guest' : userId}|${businessId}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < STATUS_TTL_MS) {
      return hit.status;
    }
    const status = isGuest
      ? await this.subscriptionsService.getBusinessSubscriptionStatus(businessId)
      : await this.subscriptionsService.getUserSubscriptionStatus(userId || '', businessId);
    if (this.cache.size >= STATUS_CACHE_MAX) this.cache.clear();
    this.cache.set(key, { at: Date.now(), status });
    return status;
  }
}
