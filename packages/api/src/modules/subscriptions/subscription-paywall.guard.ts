import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { UserRole } from '../../common/enums/user-role.enum';

@Injectable()
export class SubscriptionPaywallGuard implements CanActivate {
  constructor(private subscriptionsService: SubscriptionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;

    // Allow GET read requests even if expired (Read-Only access mode)
    if (method === 'GET' || method === 'OPTIONS') {
      return true;
    }

    // Allow auth, subscriptions, platform-admin, and app update endpoints
    const path = req.path || req.url || '';
    if (
      path.includes('/auth') ||
      path.includes('/subscriptions') ||
      path.includes('/platform-admin') ||
      path.includes('/app-updates') ||
      path.includes('/app-apk-releases') ||
      path.includes('/dev')
    ) {
      return true;
    }

    const user = req.user;
    const businessId = user?.business_id;
    if (!businessId) {
      return true; // Unauthenticated or non-tenant route, let JwtAuthGuard handle it
    }

    const status = await this.subscriptionsService.getBusinessSubscriptionStatus(businessId);

    // 1. Check if trial/subscription is expired
    if (status.status === 'expired' || status.status === 'past_due' || status.status === 'canceled') {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          error: 'PAYMENT_REQUIRED',
          message: 'Your 30-Day Free Trial / Subscription has expired. Please select a plan to continue operating your store.',
          planCode: status.planCode,
          trialDaysLeft: 0,
        },
        HttpStatus.PAYMENT_REQUIRED
      );
    }

    // 2. Check Order Creation Quota for Starter Plan
    if (path.includes('/api/orders') && method === 'POST') {
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
          HttpStatus.PAYMENT_REQUIRED
        );
      }
    }

    // 3. Check Pro-only modules for Starter Plan users
    if (status.planCode === 'starter' && (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')) {
      if (path.includes('/api/restaurant') || path.includes('/api/salesman')) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            error: 'FEATURE_LOCKED',
            message: 'This feature is locked on the Mobile Starter Plan. Upgrade to Pro Plan (₹399/mo) to unlock.',
            planCode: status.planCode,
            requiredPlan: 'pro',
          },
          HttpStatus.PAYMENT_REQUIRED
        );
      }
    }

    return true;
  }
}
