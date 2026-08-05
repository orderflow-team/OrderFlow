import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { API_BASE_URL } from './api-client';

interface LatestRelease {
  version: string;
  url: string;
  checksum: string;
  minNativeVersion: string | null;
  notes: string | null;
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Checks our own backend (not Capgo's cloud — this app doesn't use their update
 * service) for a newer web bundle and stages it for the next app background/restart.
 * Safe to call on every launch: no-ops on web, and any failure (offline, no
 * release published yet) just leaves the app running its current bundle.
 */
export async function checkForOtaUpdate() {
  if (!Capacitor.isNativePlatform()) return;

  // Must run before any other await/network call, or the plugin assumes this
  // bundle failed to boot and rolls back to the previous one.
  await CapacitorUpdater.notifyAppReady();

  try {
    const res = await fetch(`${API_BASE_URL}/api/app-updates/latest?platform=${Capacitor.getPlatform()}`);
    if (!res.ok) return;
    const latest: LatestRelease | null = await res.json();
    if (!latest) return;

    const { bundle, native } = await CapacitorUpdater.current();
    if (bundle.version === latest.version) return;
    if (latest.minNativeVersion && compareVersions(native, latest.minNativeVersion) < 0) return;

    const downloaded = await CapacitorUpdater.download({ url: latest.url, version: latest.version });
    await CapacitorUpdater.next({ id: downloaded.id });
  } catch {
    // Offline or the update check failed — keep running the current bundle, try again next launch.
  }
}
