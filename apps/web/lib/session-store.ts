import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * The login session lives in localStorage because the whole app reads it synchronously. In the
 * Android WebView that storage is not guaranteed to survive (the system can clear it under storage
 * pressure, and it is wiped with the WebView data), which signed people out for no visible reason.
 * Capacitor Preferences is Android SharedPreferences: native, and kept with the app.
 *
 * So the session is mirrored there and restored into localStorage before the app renders.
 * localStorage stays the working copy; Preferences is the durable one.
 */
export const SESSION_KEYS = ['access_token', 'refresh_token', 'user'] as const;
const isSessionKey = (key: string) => (SESSION_KEYS as readonly string[]).includes(key);

/**
 * The Preferences plugin is native code. An app build from before it was added has no such plugin
 * and every call rejects, so a failure here must never break sign-in; the app just behaves as before.
 */
async function safely<T>(run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch {
    return undefined;
  }
}

let mirrorInstalled = false;

/** Copies every later write or removal of a session key in localStorage into Preferences. */
export function installSessionMirror(): void {
  if (mirrorInstalled || typeof window === 'undefined' || !Capacitor.isNativePlatform()) return;
  mirrorInstalled = true;

  const proto = Storage.prototype;
  const { setItem, removeItem, clear } = proto;

  proto.setItem = function (this: Storage, key: string, value: string) {
    setItem.call(this, key, value);
    if (this === window.localStorage && isSessionKey(key)) void safely(() => Preferences.set({ key, value: String(value) }));
  };
  proto.removeItem = function (this: Storage, key: string) {
    removeItem.call(this, key);
    if (this === window.localStorage && isSessionKey(key)) void safely(() => Preferences.remove({ key }));
  };
  proto.clear = function (this: Storage) {
    clear.call(this);
    if (this === window.localStorage) for (const key of SESSION_KEYS) void safely(() => Preferences.remove({ key }));
  };
}

/**
 * Brings the stored session back into localStorage if the WebView lost it, and copies a session
 * that only exists in localStorage (signed in before this shipped) into Preferences.
 */
export async function restoreSession(): Promise<void> {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return;
  installSessionMirror();
  for (const key of SESSION_KEYS) {
    const local = window.localStorage.getItem(key);
    if (local !== null) {
      await safely(() => Preferences.set({ key, value: local }));
      continue;
    }
    const saved = await safely(() => Preferences.get({ key }));
    if (saved?.value) window.localStorage.setItem(key, saved.value);
  }
}
