import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UserRole } from '../../common/enums/user-role.enum';

describe('JwtStrategy.validate', () => {
  let query: jest.Mock;
  let strategy: JwtStrategy;

  beforeEach(() => {
    query = jest.fn();
    const config = { getOrThrow: () => 'test-secret' };
    strategy = new JwtStrategy(config as any, { query } as any);
  });

  const payload = { sub: 'user-1', email: 'a@b.c', businessId: 'biz-1', role: UserRole.ADMIN };

  it('accepts an active user', async () => {
    query.mockResolvedValueOnce([{ is_active: true }]).mockResolvedValue([]);
    await expect(strategy.validate(payload)).resolves.toMatchObject({ userId: 'user-1', businessId: 'biz-1' });
  });

  it('rejects a disabled user', async () => {
    query.mockResolvedValueOnce([{ is_active: false }]);
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token whose user has been deleted', async () => {
    query.mockResolvedValueOnce([]);
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  // Resetting/changing a password must sign out sessions that already existed,
  // otherwise whoever had broken in stays in.
  describe('sessions issued before a password change', () => {
    const changedAt = 1_800_000_000;

    it('rejects a token issued before the change', async () => {
      query.mockResolvedValueOnce([{ is_active: true, sessions_valid_after: String(changedAt) }]);
      await expect(strategy.validate({ ...payload, iat: changedAt - 5 })).rejects.toThrow(UnauthorizedException);
    });

    it('accepts a token issued at or after the change', async () => {
      query.mockResolvedValue([]).mockResolvedValueOnce([{ is_active: true, sessions_valid_after: String(changedAt) }]);
      await expect(strategy.validate({ ...payload, iat: changedAt })).resolves.toMatchObject({ userId: 'user-1' });
      query.mockResolvedValueOnce([{ is_active: true, sessions_valid_after: String(changedAt) }]);
      await expect(strategy.validate({ ...payload, iat: changedAt + 60 })).resolves.toMatchObject({ userId: 'user-1' });
    });

    it('does not affect users who never changed their password (null column)', async () => {
      query.mockResolvedValue([]).mockResolvedValueOnce([{ is_active: true, sessions_valid_after: null }]);
      await expect(strategy.validate({ ...payload, iat: 1 })).resolves.toMatchObject({ userId: 'user-1' });
    });
  });

  it('skips the user lookup for guest tokens', async () => {
    await expect(
      strategy.validate({ ...payload, sub: 'guest-table-1', role: UserRole.GUEST }),
    ).resolves.toMatchObject({ role: UserRole.GUEST });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects refresh tokens used as access tokens', async () => {
    await expect(strategy.validate({ ...payload, tokenType: 'refresh' })).rejects.toThrow(UnauthorizedException);
  });
});
