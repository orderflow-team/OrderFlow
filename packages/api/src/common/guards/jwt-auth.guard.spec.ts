import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const makeContext = (user: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as any;

  let reflector: { getAllAndOverride: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
    jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockResolvedValue(true as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('lets staff through without checking guest metadata', async () => {
    await expect(guard.canActivate(makeContext({ role: 'cashier' }))).resolves.toBe(true);
  });

  it('rejects a guest on a route without @AllowGuest()', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext({ role: 'guest' }))).rejects.toThrow(ForbiddenException);
  });

  it('lets a guest through on an @AllowGuest() route', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(makeContext({ role: 'guest' }))).resolves.toBe(true);
  });
});
