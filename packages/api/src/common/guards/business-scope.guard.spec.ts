import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { BusinessScopeGuard } from './business-scope.guard';

describe('BusinessScopeGuard', () => {
  let guard: BusinessScopeGuard;

  const buildContext = (request: {
    user?: { businessId?: string };
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

  it('allows the request when no businessId is supplied in query or body', () => {
    const context = buildContext({ user: { businessId: 'biz-1' } });

    expect(guard.canActivate(context)).toBe(true);
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

  it('throws ForbiddenException when there is no user object at all', () => {
    const context = buildContext({
      query: { businessId: 'biz-2' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('ignores non-string businessId values (e.g. arrays from duplicate query params)', () => {
    const context = buildContext({
      user: { businessId: 'biz-1' },
      query: { businessId: ['biz-1', 'biz-2'] },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('ignores an empty-string businessId', () => {
    const context = buildContext({
      user: { businessId: 'biz-1' },
      query: { businessId: '' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });
});
