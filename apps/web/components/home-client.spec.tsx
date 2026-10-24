import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

const push = vi.fn();
const refreshSession = vi.fn();
let native = false;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native } }));
vi.mock('../lib/api-client', () => ({ refreshSession: () => refreshSession() }));
vi.mock('./landing/landing-page', () => ({ LandingPage: () => null }));

import { HomeClient } from './home-client';

const jwt = (expSecondsFromNow: number) =>
  `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }))}.s`;

describe('HomeClient session restore', () => {
  afterEach(cleanup);

  beforeEach(() => {
    push.mockReset();
    refreshSession.mockReset();
    localStorage.clear();
    native = true;
  });

  it('opens the dashboard when the access token is still valid', async () => {
    localStorage.setItem('access_token', jwt(600));
    render(<HomeClient />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes an expired access token instead of sending the user to login', async () => {
    localStorage.setItem('access_token', jwt(-3600));
    localStorage.setItem('refresh_token', 'r');
    localStorage.setItem('user', JSON.stringify({ role: 'owner' }));
    refreshSession.mockResolvedValue('refreshed');
    render(<HomeClient />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(push).not.toHaveBeenCalledWith('/login');
    expect(localStorage.getItem('refresh_token')).toBe('r');
  });

  it('stays signed in and opens the app when offline at launch', async () => {
    localStorage.setItem('access_token', jwt(-3600));
    localStorage.setItem('refresh_token', 'r');
    localStorage.setItem('user', JSON.stringify({ role: 'owner' }));
    refreshSession.mockResolvedValue('unavailable');
    render(<HomeClient />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(localStorage.getItem('refresh_token')).toBe('r');
  });

  it('clears the session and goes to login only when the server rejects the refresh token', async () => {
    localStorage.setItem('access_token', jwt(-3600));
    localStorage.setItem('refresh_token', 'r');
    localStorage.setItem('user', JSON.stringify({ role: 'owner' }));
    refreshSession.mockResolvedValue('rejected');
    render(<HomeClient />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });
});
