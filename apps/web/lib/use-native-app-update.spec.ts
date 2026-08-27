import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const isNativePlatformMock = vi.fn();
const getPlatformMock = vi.fn().mockReturnValue('android');
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNativePlatformMock(), getPlatform: () => getPlatformMock() },
}));

const currentMock = vi.fn();
vi.mock('@capgo/capacitor-updater', () => ({ CapacitorUpdater: { current: () => currentMock() } }));

vi.mock('@capacitor/filesystem', () => ({ Filesystem: {}, Directory: { Cache: 'CACHE' } }));
vi.mock('@capacitor-community/file-opener', () => ({ FileOpener: { open: vi.fn() } }));

import { useNativeAppUpdate } from './use-native-app-update';

describe('useNativeAppUpdate', () => {
  const originalFetch = global.fetch;
  const originalChannel = process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL;

  beforeEach(() => {
    isNativePlatformMock.mockReset();
    currentMock.mockReset();
    delete process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL = originalChannel;
  });

  it('is a no-op on the web (not a native platform)', async () => {
    isNativePlatformMock.mockReturnValue(false);
    global.fetch = vi.fn();

    const { result } = renderHook(() => useNativeAppUpdate());

    expect(result.current.available).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('is a no-op on the playstore distribution channel (Play Store forbids self-updating)', async () => {
    isNativePlatformMock.mockReturnValue(true);
    process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL = 'playstore';
    global.fetch = vi.fn();

    renderHook(() => useNativeAppUpdate());

    await new Promise((r) => setTimeout(r, 0));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches the latest release and exposes it when its version is newer than the installed native build', async () => {
    isNativePlatformMock.mockReturnValue(true);
    currentMock.mockResolvedValue({ native: '1.0.0', bundle: { version: '1.0.0' } });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ versionName: '1.1.0', url: 'https://x/app.apk', checksum: 'abc', notes: 'Bug fixes' }),
    });

    const { result } = renderHook(() => useNativeAppUpdate());

    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.latest?.versionName).toBe('1.1.0');
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/app-apk-releases/latest?platform=android'));
  });

  it('does not surface a release that is not newer than the installed native build', async () => {
    isNativePlatformMock.mockReturnValue(true);
    currentMock.mockResolvedValue({ native: '1.2.0', bundle: { version: '1.2.0' } });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ versionName: '1.1.0', url: 'https://x/app.apk', checksum: 'abc', notes: null }),
    });

    const { result } = renderHook(() => useNativeAppUpdate());

    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.available).toBe(false);
  });

  it('silently stays unavailable when the release fetch fails (offline)', async () => {
    isNativePlatformMock.mockReturnValue(true);
    currentMock.mockResolvedValue({ native: '1.0.0', bundle: { version: '1.0.0' } });
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useNativeAppUpdate());

    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.available).toBe(false);
    expect(result.current.error).toBe('');
  });

  it('stays unavailable when the API responds with a non-ok status', async () => {
    isNativePlatformMock.mockReturnValue(true);
    currentMock.mockResolvedValue({ native: '1.0.0', bundle: { version: '1.0.0' } });
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useNativeAppUpdate());

    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.available).toBe(false);
  });

  it('install() is a no-op when there is no latest release to install', async () => {
    isNativePlatformMock.mockReturnValue(false);
    const { result } = renderHook(() => useNativeAppUpdate());

    await result.current.install();

    expect(result.current.installing).toBe(false);
  });
});
