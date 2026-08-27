import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

const apiPostMock = vi.fn();
vi.mock('@/lib/api-client', () => ({ default: { post: (...args: any[]) => apiPostMock(...args) } }));

import { useBusiness } from './use-business';

function setLocation(pathname: string, search: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname, search },
    writable: true,
  });
}

describe('useBusiness', () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
    apiPostMock.mockReset();
    setLocation('/dashboard', '');
  });

  it('redirects to /login when there is no access token and no guest context', async () => {
    const { result } = renderHook(() => useBusiness());

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login'));
    expect(result.current.ready).toBe(false);
  });

  it('redirects to /dashboard when logged in but the user has no businessId', async () => {
    localStorage.setItem('access_token', 'tok-1');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', role: 'admin', businessId: null }));

    renderHook(() => useBusiness());

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard'));
  });

  it('resolves ready with the businessId for an already-authenticated user', async () => {
    localStorage.setItem('access_token', 'tok-1');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', role: 'admin', businessId: 'biz-1' }));

    const { result } = renderHook(() => useBusiness());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.businessId).toBe('biz-1');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('performs a table guest login when a table id is present with no token', async () => {
    setLocation('/orders/table', '?id=table-1&customerMode=1');
    apiPostMock.mockResolvedValue({
      data: { access_token: 'guest-tok', refresh_token: 'guest-refresh', user: { id: 'guest-1', role: 'guest', businessId: 'biz-1' } },
    });

    const { result } = renderHook(() => useBusiness());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(apiPostMock).toHaveBeenCalledWith('/auth/table-guest-login', { tableId: 'table-1' });
    expect(localStorage.getItem('access_token')).toBe('guest-tok');
    expect(result.current.businessId).toBe('biz-1');
  });

  it('performs a takeaway guest login when on the takeaway route with no token', async () => {
    setLocation('/orders/takeaway', '?businessId=biz-9&customerMode=1');
    apiPostMock.mockResolvedValue({
      data: { access_token: 'guest-tok', refresh_token: 'guest-refresh', user: { id: 'guest-2', role: 'guest', businessId: 'biz-9' } },
    });

    const { result } = renderHook(() => useBusiness());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(apiPostMock).toHaveBeenCalledWith('/auth/takeaway-guest-login', { businessId: 'biz-9' });
    expect(result.current.businessId).toBe('biz-9');
  });

  it('redirects to /login when the guest login request fails', async () => {
    setLocation('/orders/table', '?id=table-1&customerMode=1');
    apiPostMock.mockRejectedValue(new Error('table not found'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(() => useBusiness());

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/login'));
    consoleSpy.mockRestore();
  });
});
