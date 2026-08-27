import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCurrentUser,
  isTokenExpired,
  setCurrentUser,
  hasRole,
  getPostLoginPath,
  getCachedBusinessCategory,
  setCachedBusinessCategory,
  getCachedInventoryEnabled,
  setCachedInventoryEnabled,
  getCachedChatEnabled,
  setCachedChatEnabled,
} from './auth';

function base64UrlEncode(json: object): string {
  return btoa(JSON.stringify(json)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildJwt(payload: object): string {
  return `${base64UrlEncode({ alg: 'HS256' })}.${base64UrlEncode(payload)}.signature`;
}

describe('auth lib', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('getCurrentUser', () => {
    it('returns null when nothing is stored', () => {
      expect(getCurrentUser()).toBeNull();
    });

    it('returns the parsed user when stored', () => {
      const user = { id: 'u1', email: 'a@b.com', fullName: 'A', role: 'admin', businessId: 'biz-1' };
      localStorage.setItem('user', JSON.stringify(user));

      expect(getCurrentUser()).toEqual(user);
    });

    it('returns null when the stored value is malformed JSON', () => {
      localStorage.setItem('user', 'not-json');

      expect(getCurrentUser()).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('returns true for a missing token', () => {
      expect(isTokenExpired(null)).toBe(true);
      expect(isTokenExpired(undefined)).toBe(true);
    });

    it('returns true for a malformed token', () => {
      expect(isTokenExpired('not-a-jwt')).toBe(true);
    });

    it('returns false for a token with no exp claim', () => {
      expect(isTokenExpired(buildJwt({ sub: 'u1' }))).toBe(false);
    });

    it('returns false for a token expiring in the future', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      expect(isTokenExpired(buildJwt({ sub: 'u1', exp }))).toBe(false);
    });

    it('returns true for a token that already expired', () => {
      const exp = Math.floor(Date.now() / 1000) - 3600;
      expect(isTokenExpired(buildJwt({ sub: 'u1', exp }))).toBe(true);
    });
  });

  describe('setCurrentUser', () => {
    it('stores the user and clears the business-mismatch recovery flag', () => {
      sessionStorage.setItem('business_mismatch_recovery_attempted', '1');
      const user = { id: 'u1', email: 'a@b.com', fullName: 'A', role: 'admin', businessId: 'biz-1' };

      setCurrentUser(user);

      expect(JSON.parse(localStorage.getItem('user')!)).toEqual(user);
      expect(sessionStorage.getItem('business_mismatch_recovery_attempted')).toBeNull();
    });
  });

  describe('hasRole', () => {
    it('returns false when there is no current user', () => {
      expect(hasRole('admin')).toBe(false);
    });

    it('returns true when the current user role is in the list', () => {
      localStorage.setItem('user', JSON.stringify({ role: 'manager' }));

      expect(hasRole('admin', 'manager')).toBe(true);
    });

    it('returns false when the current user role is not in the list', () => {
      localStorage.setItem('user', JSON.stringify({ role: 'cashier' }));

      expect(hasRole('admin', 'manager')).toBe(false);
    });
  });

  describe('getPostLoginPath', () => {
    it('routes the bootstrap admin email to /admin regardless of role', () => {
      expect(getPostLoginPath('admin', 'admin@orderflow.com')).toBe('/admin');
    });

    it('routes super_admin to /admin', () => {
      expect(getPostLoginPath('super_admin')).toBe('/admin');
    });

    it.each([
      ['salesman', '/dashboard'],
      ['kitchen_staff', '/restaurant'],
      ['manager', '/dashboard'],
      ['cashier', '/billing'],
      ['waiter', '/restaurant'],
      ['accountant', '/reports'],
      ['delivery_person', '/orders'],
    ])('routes %s to %s', (role, path) => {
      expect(getPostLoginPath(role)).toBe(path);
    });

    it('defaults to /dashboard for an unrecognized or missing role', () => {
      expect(getPostLoginPath('unknown_role')).toBe('/dashboard');
      expect(getPostLoginPath(null)).toBe('/dashboard');
    });
  });

  describe('cached business category', () => {
    it('returns null when nothing is cached', () => {
      expect(getCachedBusinessCategory('biz-1')).toBeNull();
    });

    it('returns the cached category for a matching businessId', () => {
      setCachedBusinessCategory('biz-1', 'pharmacy');

      expect(getCachedBusinessCategory('biz-1')).toBe('pharmacy');
    });

    it('returns null when the cached businessId does not match', () => {
      setCachedBusinessCategory('biz-1', 'pharmacy');

      expect(getCachedBusinessCategory('biz-2')).toBeNull();
    });
  });

  describe('cached inventory enabled', () => {
    it('round-trips a stored value scoped to businessId', () => {
      setCachedInventoryEnabled('biz-1', true);

      expect(getCachedInventoryEnabled('biz-1')).toBe(true);
      expect(getCachedInventoryEnabled('biz-2')).toBeNull();
    });
  });

  describe('cached chat enabled', () => {
    it('round-trips a stored value scoped to businessId', () => {
      setCachedChatEnabled('biz-1', false);

      expect(getCachedChatEnabled('biz-1')).toBe(false);
      expect(getCachedChatEnabled('biz-2')).toBeNull();
    });
  });
});
