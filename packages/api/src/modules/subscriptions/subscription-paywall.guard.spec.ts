import { HttpException, HttpStatus, ExecutionContext } from '@nestjs/common';
import { SubscriptionPaywallGuard } from './subscription-paywall.guard';
import { SubscriptionsService } from './subscriptions.service';
import { UserRole } from '../../common/enums/user-role.enum';

describe('SubscriptionPaywallGuard', () => {
  let guard: SubscriptionPaywallGuard;
  let service: SubscriptionsService;

  beforeEach(() => {
    service = {
      getBusinessSubscriptionStatus: jest.fn(),
    } as any;
    guard = new SubscriptionPaywallGuard(service);
  });

  function createMockContext(method: string, path: string, user: any = { business_id: 'biz-1', role: UserRole.ADMIN }): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          path,
          url: path,
          user,
        }),
      }),
    } as any;
  }

  it('allows GET requests even when expired (read-only mode)', async () => {
    const ctx = createMockContext('GET', '/api/orders');
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(service.getBusinessSubscriptionStatus).not.toHaveBeenCalled();
  });

  it('bypasses checks for platform-admin routes', async () => {
    const ctx = createMockContext('POST', '/api/platform-admin/stores/123/subscription', { business_id: 'biz-1', role: UserRole.SUPER_ADMIN });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(service.getBusinessSubscriptionStatus).not.toHaveBeenCalled();
  });

  it('bypasses checks for exempt path routes like auth and subscriptions', async () => {
    const ctx = createMockContext('POST', '/api/subscriptions/simulate-upgrade');
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(service.getBusinessSubscriptionStatus).not.toHaveBeenCalled();
  });

  it('allows write requests when subscription is active', async () => {
    (service.getBusinessSubscriptionStatus as any).mockResolvedValue({
      status: 'active',
      planCode: 'pro',
      quotas: { ordersUsedThisMonth: 10, maxOrdersPerMonth: -1 },
    });
    const ctx = createMockContext('POST', '/api/orders');
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('throws HTTP 402 when subscription status is expired', async () => {
    (service.getBusinessSubscriptionStatus as any).mockResolvedValue({
      status: 'expired',
      planCode: 'pro',
      quotas: { ordersUsedThisMonth: 10, maxOrdersPerMonth: -1 },
    });
    const ctx = createMockContext('POST', '/api/orders');
    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    try {
      await guard.canActivate(ctx);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(err.getResponse().error).toBe('PAYMENT_REQUIRED');
    }
  });

  it('throws HTTP 402 ORDER_QUOTA_EXCEEDED when monthly order limit is reached on Starter plan', async () => {
    (service.getBusinessSubscriptionStatus as any).mockResolvedValue({
      status: 'active',
      planCode: 'starter',
      quotas: { ordersUsedThisMonth: 500, maxOrdersPerMonth: 500 },
    });
    const ctx = createMockContext('POST', '/api/orders');
    try {
      await guard.canActivate(ctx);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(err.getResponse().error).toBe('ORDER_QUOTA_EXCEEDED');
    }
  });

  it('throws HTTP 402 FEATURE_LOCKED when Starter plan user tries to mutate Pro-only modules', async () => {
    (service.getBusinessSubscriptionStatus as any).mockResolvedValue({
      status: 'active',
      planCode: 'starter',
      quotas: { ordersUsedThisMonth: 10, maxOrdersPerMonth: 500 },
    });
    const ctx = createMockContext('POST', '/api/restaurant/table');
    try {
      await guard.canActivate(ctx);
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(err.getResponse().error).toBe('FEATURE_LOCKED');
    }
  });
});
