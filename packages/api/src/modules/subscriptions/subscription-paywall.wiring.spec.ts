import { CanActivate, Controller, ExecutionContext, INestApplication, Injectable, Post, UseGuards } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { SubscriptionPaywallInterceptor } from './subscription-paywall.interceptor';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Wires the paywall exactly like AppModule does (a global provider) in front of
 * a controller-level guard that authenticates, like JwtAuthGuard does.
 *
 * This is the regression test for the bug where the paywall was a global GUARD:
 * global guards run before controller guards, so `req.user` was still empty
 * and every request was waved through — nothing was ever enforced. The unit
 * tests could not catch it because they hand the paywall a ready-made user.
 */
@Injectable()
class FakeJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    // Same shape JwtStrategy.validate() returns.
    context.switchToHttp().getRequest().user = { userId: 'usr-1', businessId: 'biz-1', role: 'admin', email: 'a@b.c' };
    return true;
  }
}

@UseGuards(FakeJwtAuthGuard)
@Controller('api/products')
class ProductsStubController {
  @Post()
  create() {
    return { created: true };
  }
}

describe('SubscriptionPaywallInterceptor wiring', () => {
  let app: INestApplication;
  let baseUrl: string;
  let subscriptions: { getUserSubscriptionStatus: jest.Mock; getBusinessSubscriptionStatus: jest.Mock };

  beforeAll(async () => {
    subscriptions = { getUserSubscriptionStatus: jest.fn(), getBusinessSubscriptionStatus: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductsStubController],
      providers: [
        { provide: SubscriptionsService, useValue: subscriptions },
        { provide: APP_INTERCEPTOR, useClass: SubscriptionPaywallInterceptor },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  const post = () => fetch(`${baseUrl}/api/products`, { method: 'POST' });

  it('blocks a write with 402 when the shop’s plan has expired', async () => {
    subscriptions.getUserSubscriptionStatus.mockResolvedValue({
      status: 'expired',
      planCode: 'pro',
      quotas: { ordersUsedThisMonth: 0, maxOrdersPerMonth: -1 },
    });

    const res = await post();

    expect(res.status).toBe(402);
    expect((await res.json()).error).toBe('PAYMENT_REQUIRED');
    expect(subscriptions.getUserSubscriptionStatus).toHaveBeenCalledWith('usr-1', 'biz-1');
  });
});
