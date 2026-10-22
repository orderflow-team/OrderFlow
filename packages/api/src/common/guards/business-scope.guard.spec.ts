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
