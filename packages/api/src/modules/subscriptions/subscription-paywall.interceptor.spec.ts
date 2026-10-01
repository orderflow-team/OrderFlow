import { CallHandler, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { SubscriptionPaywallInterceptor } from './subscription-paywall.interceptor';
import { SubscriptionsService } from './subscriptions.service';
import { UserRole } from '../../common/enums/user-role.enum';

describe('SubscriptionPaywallInterceptor', () => {
  let service: jest.Mocked<Pick<SubscriptionsService, 'getUserSubscriptionStatus' | 'getBusinessSubscriptionStatus'>>;
  let interceptor: SubscriptionPaywallInterceptor;
  let handle: jest.Mock;
  const next = (): CallHandler => ({ handle });

  // The shape JwtStrategy.validate() puts on req.user.
  const ADMIN = { userId: 'usr-1', businessId: 'biz-1', role: UserRole.ADMIN, email: 'a@b.c' };

  const ctx = (method: string, path: string, user: any = ADMIN, type = 'http'): ExecutionContext =>
    ({
      getType: () => type,
      switchToHttp: () => ({ getRequest: () => ({ method, path, url: path, user }) }),
    }) as any;

  const status = (overrides: any = {}) => ({
    status: 'active',
    planCode: 'pro',
    quotas: { ordersUsedThisMonth: 10, maxOrdersPerMonth: -1 },
    ...overrides,
  });

  const run = (context: ExecutionContext) => interceptor.intercept(context, next()).then((o) => lastValueFrom(o));

  const expectBlocked = async (context: ExecutionContext, error: string) => {
    const err = await run(context).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
    expect(err.getResponse().error).toBe(error);
    expect(handle).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    delete process.env.PAYWALL_ENFORCED;
    handle = jest.fn(() => of('handled'));
    service = { getUserSubscriptionStatus: jest.fn(), getBusinessSubscriptionStatus: jest.fn() } as any;
    interceptor = new SubscriptionPaywallInterceptor(service as any);
  });

  describe('requests that are never paywalled', () => {
    it.each([
      ['a GET (read-only mode)', 'GET', '/api/orders'],
      ['sign-in', 'POST', '/auth/login'],
      ['choosing a plan', 'POST', '/api/subscriptions/upgrade-request'],
      ['platform admin', 'POST', '/api/platform-admin/stores/123/subscription'],
      ['app updates', 'POST', '/api/app-updates'],
    ])('lets %s through without looking up the plan', async (_label, method, path) => {
      await expect(run(ctx(method, path))).resolves.toBe('handled');
      expect(service.getUserSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('does not let a path parameter named like an exempt route skip the check', async () => {
      service.getUserSubscriptionStatus.mockResolvedValue(status({ status: 'expired' }) as any);
      await expectBlocked(ctx('POST', '/api/orders/auth/items'), 'PAYMENT_REQUIRED');
    });

    it('lets unauthenticated and super-admin requests through', async () => {
      await expect(run(ctx('POST', '/api/orders', null))).resolves.toBe('handled');
      await expect(run(ctx('POST', '/api/orders', { ...ADMIN, role: UserRole.SUPER_ADMIN }))).resolves.toBe('handled');
      expect(service.getUserSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('does nothing outside HTTP and when PAYWALL_ENFORCED=false', async () => {
      await expect(run(ctx('POST', '/api/orders', ADMIN, 'rpc'))).resolves.toBe('handled');
      process.env.PAYWALL_ENFORCED = 'false';
      await expect(run(ctx('POST', '/api/orders'))).resolves.toBe('handled');
      expect(service.getUserSubscriptionStatus).not.toHaveBeenCalled();
    });
  });

  describe('enforcement', () => {
    it('looks the plan up with the userId/businessId JwtStrategy actually provides', async () => {
      service.getUserSubscriptionStatus.mockResolvedValue(status() as any);
      await run(ctx('POST', '/api/products'));
      expect(service.getUserSubscriptionStatus).toHaveBeenCalledWith('usr-1', 'biz-1');
    });

    it('allows writes on an active plan', async () => {
      service.getUserSubscriptionStatus.mockResolvedValue(status() as any);
      await expect(run(ctx('POST', '/api/orders'))).resolves.toBe('handled');
    });

    it.each(['expired', 'past_due', 'canceled'])('returns 402 PAYMENT_REQUIRED for a %s plan', async (s) => {
      service.getUserSubscriptionStatus.mockResolvedValue(status({ status: s }) as any);
      await expectBlocked(ctx('POST', '/api/orders'), 'PAYMENT_REQUIRED');
    });

    it('still lets an expired shop read its data', async () => {
      service.getUserSubscriptionStatus.mockResolvedValue(status({ status: 'expired' }) as any);
      await expect(run(ctx('GET', '/api/orders'))).resolves.toBe('handled');
    });

    it('returns 402 ORDER_QUOTA_EXCEEDED when creating an order past the Starter cap', async () => {
      service.getUserSubscriptionStatus.mockResolvedValue(
        status({ planCode: 'starter', quotas: { ordersUsedThisMonth: 500, maxOrdersPerMonth: 500 } }) as any,
      );
      await expectBlocked(ctx('POST', '/api/orders'), 'ORDER_QUOTA_EXCEEDED');
    });

    it('returns 402 AI_SCAN_QUOTA_EXCEEDED when the monthly scan allowance is used up', async () => {
      service.getUserSubscriptionStatus.mockResolvedValue(
        status({ quotas: { ordersUsedThisMonth: 0, maxOrdersPerMonth: -1, aiScansUsedThisMonth: 20, maxAiScansPerMonth: 20 } }) as any,
      );
      await expectBlocked(ctx('POST', '/api/invoice-scans/upload'), 'AI_SCAN_QUOTA_EXCEEDED');
    });

    it('allows scans while there is allowance left, and when the plan is unlimited (-1)', async () => {
      service.getUserSubscriptionStatus.mockResolvedValue(
        status({ quotas: { ordersUsedThisMonth: 0, maxOrdersPerMonth: -1, aiScansUsedThisMonth: 19, maxAiScansPerMonth: 20 } }) as any,
      );
      await expect(run(ctx('POST', '/api/invoice-scans/upload'))).resolves.toBe('handled');

      const unlimited = new SubscriptionPaywallInterceptor(service as any);
      service.getUserSubscriptionStatus.mockResolvedValue(
        status({ quotas: { ordersUsedThisMonth: 0, maxOrdersPerMonth: -1, aiScansUsedThisMonth: 9999, maxAiScansPerMonth: -1 } }) as any,
      );
      await expect(
        unlimited.intercept(ctx('POST', '/api/invoice-scans/upload', { ...ADMIN, userId: 'usr-2' }), next()).then((o) => lastValueFrom(o)),
      ).resolves.toBe('handled');
    });

    it('does not count returns or payments against the order cap', async () => {
      service.getUserSubscriptionStatus.mockResolvedValue(
        status({ planCode: 'starter', quotas: { ordersUsedThisMonth: 500, maxOrdersPerMonth: 500 } }) as any,
      );
      await expect(run(ctx('POST', '/api/orders/abc/return'))).resolves.toBe('handled');
    });

    it('returns 402 FEATURE_LOCKED for Pro-only modules on Starter', async () => {
      service.getUserSubscriptionStatus.mockResolvedValue(status({ planCode: 'starter' }) as any);
      await expectBlocked(ctx('POST', '/api/restaurant/tables'), 'FEATURE_LOCKED');
      await expectBlocked(ctx('PATCH', '/api/salesman/1'), 'FEATURE_LOCKED');
    });

    it('applies the shop owner’s plan to QR guests, who have no user row', async () => {
      service.getBusinessSubscriptionStatus.mockResolvedValue(status({ status: 'expired' }) as any);
      const guest = { userId: 'guest-table-1', businessId: 'biz-1', role: UserRole.GUEST };
      await expectBlocked(ctx('POST', '/api/orders', guest), 'PAYMENT_REQUIRED');
      expect(service.getBusinessSubscriptionStatus).toHaveBeenCalledWith('biz-1');
      expect(service.getUserSubscriptionStatus).not.toHaveBeenCalled();
    });

    it('reuses a plan lookup for the same user within the cache window', async () => {
      service.getUserSubscriptionStatus.mockResolvedValue(status() as any);
      await run(ctx('POST', '/api/products'));
      await run(ctx('PATCH', '/api/products/1'));
      expect(service.getUserSubscriptionStatus).toHaveBeenCalledTimes(1);
    });
  });
});
