import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, string>();
let native = true;
let pluginMissing = false;

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native } }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => {
      if (pluginMissing) throw new Error('"Preferences" plugin is not implemented on android');
      return { value: store.get(key) ?? null };
    }),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      if (pluginMissing) throw new Error('not implemented');
      store.set(key, value);
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      if (pluginMissing) throw new Error('not implemented');
      store.delete(key);
    }),
  },
}));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('session-store', () => {
  let mod: typeof import('./session-store');
  const realSetItem = Storage.prototype.setItem;
  const realRemoveItem = Storage.prototype.removeItem;
  const realClear = Storage.prototype.clear;

  beforeEach(async () => {
    Storage.prototype.setItem = realSetItem;
    Storage.prototype.removeItem = realRemoveItem;
    Storage.prototype.clear = realClear;
    store.clear();
    localStorage.clear();
    native = true;
    pluginMissing = false;
    vi.resetModules();
    mod = await import('./session-store');
  });

  it('restores a session the WebView lost', async () => {
    store.set('access_token', 'a');
    store.set('refresh_token', 'r');
    store.set('user', '{"id":"u1"}');
    await mod.restoreSession();
    expect(localStorage.getItem('refresh_token')).toBe('r');
    expect(localStorage.getItem('user')).toBe('{"id":"u1"}');
  });

  it('copies an existing localStorage session into Preferences (signed in before the update)', async () => {
    localStorage.setItem('refresh_token', 'r-old');
    await mod.restoreSession();
    expect(store.get('refresh_token')).toBe('r-old');
  });

  it('mirrors later writes, removals and clear() for session keys only', async () => {
    await mod.restoreSession();
    localStorage.setItem('access_token', 'a2');
    localStorage.setItem('theme', 'dark');
    await flush();
    expect(store.get('access_token')).toBe('a2');
    expect(store.has('theme')).toBe(false);

    localStorage.removeItem('access_token');
    await flush();
    expect(store.has('access_token')).toBe(false);

    localStorage.setItem('refresh_token', 'r2');
    await flush();
    localStorage.clear();
    await flush();
    expect(store.has('refresh_token')).toBe(false);
  });

  it('does not touch anything on the web', async () => {
    native = false;
    store.set('refresh_token', 'r');
    await mod.restoreSession();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    localStorage.setItem('refresh_token', 'x');
    await flush();
    expect(store.get('refresh_token')).toBe('r');
  });

  it('keeps working when the native plugin is missing (older app build)', async () => {
    pluginMissing = true;
    localStorage.setItem('refresh_token', 'r');
    await expect(mod.restoreSession()).resolves.toBeUndefined();
    localStorage.setItem('access_token', 'a');
    localStorage.removeItem('access_token');
    await flush();
    expect(localStorage.getItem('refresh_token')).toBe('r');
  });
});
