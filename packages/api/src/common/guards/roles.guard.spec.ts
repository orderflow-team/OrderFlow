import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../enums/user-role.enum';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const buildContext = (user?: { role?: UserRole }): ExecutionContext => {
    const request = { user };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('allows the request when no roles metadata is set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = buildContext({ role: UserRole.CASHIER });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request when roles metadata is an empty array', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const context = buildContext({ role: UserRole.CASHIER });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when the user role is in the required list', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN, UserRole.MANAGER]);
    const context = buildContext({ role: UserRole.MANAGER });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('always allows SUPER_ADMIN even when not in the required roles list', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.CASHIER]);
    const context = buildContext({ role: UserRole.SUPER_ADMIN });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when the user role is not in the required list', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const context = buildContext({ role: UserRole.CASHIER });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no user on the request', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const context = buildContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when the user has no role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const context = buildContext({ role: undefined });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
