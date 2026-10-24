import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { BusinessScopeGuard } from './business-scope.guard';

describe('BusinessScopeGuard', () => {
  let guard: BusinessScopeGuard;

  const buildContext = (request: {
    user?: { businessId?: string; role?: string };
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
  }): ExecutionContext => {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    guard = new BusinessScopeGuard();
  });

  it('injects the token businessId into query and body when none is supplied', () => {
    const request = { user: { businessId: 'biz-1' }, query: {} as Record<string, unknown>, body: {} as Record<string, unknown> };

    expect(guard.canActivate(buildContext(request))).toBe(true);
    expect(request.query.businessId).toBe('biz-1');
    expect(request.body.businessId).toBe('biz-1');
  });

  it('allows the request when the supplied query businessId matches the token', () => {
    const context = buildContext({
      user: { businessId: 'biz-1' },
      query: { businessId: 'biz-1' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request when the supplied body businessId matches the token', () => {
    const context = buildContext({
      user: { businessId: 'biz-1' },
      body: { businessId: 'biz-1' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when the query businessId mismatches the token', () => {
    const context = buildContext({
      user: { businessId: 'biz-1' },
      query: { businessId: 'biz-2' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when the body businessId mismatches the token', () => {
    const context = buildContext({
      user: { businessId: 'biz-1' },
      body: { businessId: 'biz-2' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when a businessId is supplied but the token has none', () => {
    const context = buildContext({
      user: {},
      query: { businessId: 'biz-2' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when neither the token nor the request has a businessId', () => {
    expect(() => guard.canActivate(buildContext({ user: { role: 'admin' }, query: {} }))).toThrow(ForbiddenException);
  });

  it('lets a super admin without a business through when no tenant is named', () => {
    expect(guard.canActivate(buildContext({ user: { role: 'super_admin' }, query: {} }))).toBe(true);
  });

  it('still rejects a super admin without a business who names a tenant', () => {
    const context = buildContext({ user: { role: 'super_admin' }, query: { businessId: 'biz-2' } });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no user object at all', () => {
    const context = buildContext({
      query: { businessId: 'biz-2' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('replaces non-string businessId values (e.g. arrays from duplicate query params) with the token value', () => {
    const request = { user: { businessId: 'biz-1' }, query: { businessId: ['biz-1', 'biz-2'] } as Record<string, unknown> };

    expect(guard.canActivate(buildContext(request))).toBe(true);
    expect(request.query.businessId).toBe('biz-1');
  });

  it('replaces an empty-string businessId with the token value', () => {
    const request = { user: { businessId: 'biz-1' }, query: { businessId: '' } as Record<string, unknown> };

    expect(guard.canActivate(buildContext(request))).toBe(true);
    expect(request.query.businessId).toBe('biz-1');
  });
});

/**
 * The tests above use plain objects, which cannot show how a real Express request behaves: in
 * Express 5 `req.query` is a getter that re-parses the URL on every read, so a guard that assigns to
 * it appears to work in a unit test and does nothing in production. This goes through a real server.
 */
describe('BusinessScopeGuard over real HTTP (Express)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Test } = require('@nestjs/testing');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Controller, Get, Post, Body, Query, UseGuards, Injectable } = require('@nestjs/common');

  @Injectable()
  class FakeAuthGuard {
    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest();
      const biz = req.headers['x-test-business'];
      req.user = biz ? { userId: 'u1', businessId: biz, role: 'admin' } : { userId: 'u1', role: 'admin' };
      return true;
    }
  }

  @Controller('probe')
  @UseGuards(FakeAuthGuard, BusinessScopeGuard)
  class ProbeController {
    @Get()
    read(@Query('businessId') businessId: unknown) {
      return { businessId };
    }

    @Post()
    write(@Body() body: { businessId?: string }) {
      return { businessId: body.businessId };
    }
  }

  let app: any;
  let url: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController], providers: [FakeAuthGuard] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    url = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  const get = async (path: string, biz?: string) => {
    const res = await fetch(`${url}/probe${path}`, { headers: biz ? { 'x-test-business': biz } : {} });
    return { status: res.status, body: await res.json() };
  };

  it("hands the caller's own tenant to the handler when the query has none", async () => {
    expect(await get('', 'biz-1')).toEqual({ status: 200, body: { businessId: 'biz-1' } });
  });

  it('replaces an empty businessId with the caller\'s tenant', async () => {
    expect(await get('?businessId=', 'biz-1')).toEqual({ status: 200, body: { businessId: 'biz-1' } });
  });

  it("replaces duplicated businessId params (an array) with the caller's tenant", async () => {
    expect(await get('?businessId=biz-1&businessId=biz-2', 'biz-1')).toEqual({ status: 200, body: { businessId: 'biz-1' } });
  });

  it('keeps a matching businessId and leaves other query params alone', async () => {
    expect((await get('?businessId=biz-1&x=1', 'biz-1')).body).toEqual({ businessId: 'biz-1' });
  });

  it("rejects another tenant's businessId", async () => {
    expect((await get('?businessId=biz-2', 'biz-1')).status).toBe(403);
  });

  it('rejects a caller whose token has no business', async () => {
    expect((await get('')).status).toBe(403);
  });

  it("fills in the body's businessId from the token too", async () => {
    const res = await fetch(`${url}/probe`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-business': 'biz-1' }, body: '{}' });
    expect(await res.json()).toEqual({ businessId: 'biz-1' });
  });
});
