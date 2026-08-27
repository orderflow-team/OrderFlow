import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const requestInterceptors: Array<(config: any) => any> = [];
const responseInterceptors: Array<{ onFulfilled: (res: any) => any; onRejected: (err: any) => any }> = [];

// axios.create() returns a callable instance (used directly for retries, e.g.
// `apiClient(originalRequest)`) that also carries .interceptors — a plain
// object mock can't be called as a function, so this builds a jest.fn() and
// attaches the rest of the axios-instance surface onto it.
function buildAxiosInstanceMock() {
  const instance: any = vi.fn().mockResolvedValue({ data: 'retried' });
  instance.interceptors = {
    request: { use: (fn: any) => requestInterceptors.push(fn) },
    response: { use: (onFulfilled: any, onRejected: any) => responseInterceptors.push({ onFulfilled, onRejected }) },
  };
  return instance;
}

const axiosPostMock = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => buildAxiosInstanceMock()),
    post: (...args: any[]) => axiosPostMock(...args),
  },
}));

describe('api-client', () => {
  let apiClient: any;
  let toAbsoluteFileUrl: (url: string | null | undefined) => string | null;

  beforeEach(async () => {
    vi.resetModules();
    requestInterceptors.length = 0;
    responseInterceptors.length = 0;
    axiosPostMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    const mod = await import('./api-client');
    apiClient = mod.default;
    toAbsoluteFileUrl = mod.toAbsoluteFileUrl;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('toAbsoluteFileUrl', () => {
    it('returns null for null/undefined input', () => {
      expect(toAbsoluteFileUrl(null)).toBeNull();
      expect(toAbsoluteFileUrl(undefined)).toBeNull();
    });

    it('resolves a bare root-relative path against the API origin', () => {
      expect(toAbsoluteFileUrl('/uploads/logo.png')).toBe('http://localhost:4000/uploads/logo.png');
    });

    it('passes through an already-absolute http(s) URL unchanged', () => {
      expect(toAbsoluteFileUrl('https://cdn.example.com/x.png')).toBe('https://cdn.example.com/x.png');
    });

    it('passes through a data: URI unchanged', () => {
      expect(toAbsoluteFileUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    });

    it('passes through a blob: URI unchanged', () => {
      expect(toAbsoluteFileUrl('blob:http://localhost/xyz')).toBe('blob:http://localhost/xyz');
    });
  });

  describe('request interceptor', () => {
    it('attaches the Authorization header when an access_token is stored', () => {
      localStorage.setItem('access_token', 'tok-123');
      const config = requestInterceptors[0]({ headers: {} });

      expect(config.headers.Authorization).toBe('Bearer tok-123');
    });

    it('leaves the config untouched when there is no stored token', () => {
      const config = requestInterceptors[0]({ headers: {} });

      expect(config.headers.Authorization).toBeUndefined();
    });
  });

  describe('response interceptor — success path', () => {
    it('dispatches "order-updated" for a mutating request to a tracked endpoint', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const response = { config: { url: '/api/orders/123', method: 'post' } };

      responseInterceptors[0].onFulfilled(response);

      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'order-updated' }));
    });

    it('does not dispatch for a GET to the same tracked endpoint', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const response = { config: { url: '/api/orders/123', method: 'get' } };

      responseInterceptors[0].onFulfilled(response);

      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('does not dispatch for a mutating request to an untracked endpoint', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const response = { config: { url: '/api/products/123', method: 'post' } };

      responseInterceptors[0].onFulfilled(response);

      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('returns the response unchanged', () => {
      const response = { config: { url: '/api/products', method: 'get' }, data: { ok: true } };

      expect(responseInterceptors[0].onFulfilled(response)).toBe(response);
    });
  });

  describe('response interceptor — 401 handling', () => {
    it('silently refreshes and retries the original request on a first 401', async () => {
      localStorage.setItem('refresh_token', 'refresh-1');
      axiosPostMock.mockResolvedValue({
        data: { access_token: 'new-access', refresh_token: 'new-refresh', user: { id: 'u1' } },
      });
      const originalRequest: any = { url: '/api/orders', _retry: false };
      const error = { response: { status: 401 }, config: originalRequest };

      await responseInterceptors[0].onRejected(error);

      expect(localStorage.getItem('access_token')).toBe('new-access');
      expect(localStorage.getItem('refresh_token')).toBe('new-refresh');
      expect(JSON.parse(localStorage.getItem('user')!)).toEqual({ id: 'u1' });
      expect(apiClient).toHaveBeenCalledWith(originalRequest);
    });

    it('does not attempt a second refresh once _retry is already set', async () => {
      const originalRequest: any = { url: '/api/orders', _retry: true };
      const error = { response: { status: 401 }, config: originalRequest };

      await expect(responseInterceptors[0].onRejected(error)).rejects.toBe(error);
      expect(axiosPostMock).not.toHaveBeenCalled();
    });

    it('clears stored credentials and dispatches auth:unauthorized when refresh fails', async () => {
      localStorage.setItem('access_token', 'stale');
      localStorage.setItem('refresh_token', 'stale-refresh');
      localStorage.setItem('user', JSON.stringify({ id: 'u1' }));
      axiosPostMock.mockRejectedValue(new Error('refresh token expired'));
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const originalRequest: any = { url: '/api/orders', _retry: false };
      const error = { response: { status: 401 }, config: originalRequest };

      await expect(responseInterceptors[0].onRejected(error)).rejects.toBe(error);

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'auth:unauthorized' }));
    });

    it('rejects immediately with no refresh attempt when there is no stored refresh_token', async () => {
      const originalRequest: any = { url: '/api/orders', _retry: false };
      const error = { response: { status: 401 }, config: originalRequest };

      await expect(responseInterceptors[0].onRejected(error)).rejects.toBe(error);

      expect(axiosPostMock).not.toHaveBeenCalled();
    });

    it('de-duplicates concurrent refreshes across simultaneous 401s', async () => {
      localStorage.setItem('refresh_token', 'refresh-1');
      let resolvePost: (v: any) => void;
      axiosPostMock.mockReturnValue(
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
      );
      const req1: any = { url: '/api/orders', _retry: false };
      const req2: any = { url: '/api/products', _retry: false };

      const p1 = responseInterceptors[0].onRejected({ response: { status: 401 }, config: req1 });
      const p2 = responseInterceptors[0].onRejected({ response: { status: 401 }, config: req2 });

      resolvePost!({ data: { access_token: 'new-access', refresh_token: 'new-refresh' } });
      await Promise.all([p1, p2]);

      expect(axiosPostMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('response interceptor — business-mismatch recovery', () => {
    const reloadMock = vi.fn();

    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadMock },
        writable: true,
      });
      reloadMock.mockClear();
    });

    it('refreshes and reloads once on a 403 "Business mismatch" response', async () => {
      localStorage.setItem('refresh_token', 'refresh-1');
      axiosPostMock.mockResolvedValue({ data: { access_token: 'new-access', refresh_token: 'new-refresh' } });
      const error = {
        response: { status: 403, data: { message: 'Business mismatch' } },
        config: { url: '/api/orders', _retry: false },
      };

      // The implementation intentionally never resolves/rejects this promise
      // once a reload is triggered — race it against a timeout instead of
      // awaiting it directly.
      const settled = Promise.race([
        responseInterceptors[0].onRejected(error).then(() => 'settled', () => 'settled'),
        new Promise((resolve) => setTimeout(() => resolve('pending'), 50)),
      ]);

      expect(await settled).toBe('pending');
      expect(reloadMock).toHaveBeenCalled();
      expect(sessionStorage.getItem('business_mismatch_recovery_attempted')).toBe('1');
    });

    it('does not attempt recovery a second time in the same session', async () => {
      sessionStorage.setItem('business_mismatch_recovery_attempted', '1');
      const error = {
        response: { status: 403, data: { message: 'Business mismatch' } },
        config: { url: '/api/orders', _retry: false },
      };

      await expect(responseInterceptors[0].onRejected(error)).rejects.toBe(error);
      expect(axiosPostMock).not.toHaveBeenCalled();
      expect(reloadMock).not.toHaveBeenCalled();
    });

    it('ignores an unrelated 403 without a "Business mismatch" message', async () => {
      const error = {
        response: { status: 403, data: { message: 'Forbidden' } },
        config: { url: '/api/orders', _retry: false },
      };

      await expect(responseInterceptors[0].onRejected(error)).rejects.toBe(error);
      expect(reloadMock).not.toHaveBeenCalled();
    });
  });
});
