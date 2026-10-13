import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { SheetsSyncKeyGuard } from './sheets-sync.guard';

const KEY = 'k'.repeat(32);
const ctx = (headers: Record<string, any>) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as any;
const guardWith = (key?: string) => new SheetsSyncKeyGuard({ get: () => key } as any);

describe('SheetsSyncKeyGuard', () => {
  it('answers 404 when the key is unset or too short', () => {
    expect(() => guardWith(undefined).canActivate(ctx({ 'x-sync-key': KEY }))).toThrow(NotFoundException);
    expect(() => guardWith('short').canActivate(ctx({ 'x-sync-key': 'short' }))).toThrow(NotFoundException);
  });

  it('rejects a missing or wrong key', () => {
    expect(() => guardWith(KEY).canActivate(ctx({}))).toThrow(UnauthorizedException);
    expect(() => guardWith(KEY).canActivate(ctx({ 'x-sync-key': 'x'.repeat(32) }))).toThrow(UnauthorizedException);
  });

  it('accepts the right key', () => {
    expect(guardWith(KEY).canActivate(ctx({ 'x-sync-key': KEY }))).toBe(true);
  });
});
