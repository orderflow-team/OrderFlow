import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { API_BASE_URL } from './api-client';

const LOG_PREFIX = '[OTA]';

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
 *
 * Logs each step under the "[OTA]" prefix — visible in Android Logcat under the
 * "Capacitor/Console" tag, since there's no on-screen UI for this by design.
 */
export async function checkForOtaUpdate() {
  if (!Capacitor.isNativePlatform()) {
    console.log(`${LOG_PREFIX} skipped — not running on a native platform`);
    return;
  }

  // Must run before any other await/network call, or the plugin assumes this
  // bundle failed to boot and rolls back to the previous one.
  await CapacitorUpdater.notifyAppReady();
  console.log(`${LOG_PREFIX} notifyAppReady sent, checking ${API_BASE_URL}/api/app-updates/latest`);

  try {
    const res = await fetch(`${API_BASE_URL}/api/app-updates/latest?platform=${Capacitor.getPlatform()}`);
    if (!res.ok) {
      console.log(`${LOG_PREFIX} update check failed: HTTP ${res.status}`);
      return;
    }
    const latest: LatestRelease | null = await res.json();
    if (!latest) {
      console.log(`${LOG_PREFIX} no release published yet`);
      return;
    }

    const { bundle, native } = await CapacitorUpdater.current();
    console.log(`${LOG_PREFIX} current bundle=${bundle.version} native=${native} latest=${latest.version}`);

    if (bundle.version === latest.version) {
      console.log(`${LOG_PREFIX} already up to date`);
      return;
    }
    if (latest.minNativeVersion && compareVersions(native, latest.minNativeVersion) < 0) {
      console.log(`${LOG_PREFIX} skipped — native app ${native} is below required ${latest.minNativeVersion}`);
      return;
    }

    console.log(`${LOG_PREFIX} downloading ${latest.version} from ${latest.url}`);
    const downloaded = await CapacitorUpdater.download({ url: latest.url, version: latest.version });
    await CapacitorUpdater.next({ id: downloaded.id });
    console.log(`${LOG_PREFIX} staged ${latest.version} — will apply on next background/restart`);
  } catch (err) {
    console.log(`${LOG_PREFIX} update check errored (offline or bad response):`, err);
  }
}
