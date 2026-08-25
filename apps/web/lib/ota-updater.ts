import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { API_BASE_URL } from './api-client';
import { compareVersions } from './version-compare';

const LOG_PREFIX = '[OTA]';

interface LatestRelease {
  version: string;
  url: string;
  checksum: string;
  minNativeVersion: string | null;
  notes: string | null;
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
    // On Android, distinguish the two distribution flavors (see
    // use-native-app-update.ts and android/app/build.gradle) so a
    // playstore-specific OTA release, if one is ever published, only reaches
    // playstore installs — the backend falls back to the bare "android"
    // channel when nothing flavor-specific has been published, so this is
    // safe even before any android-playstore release exists.
    const platform = Capacitor.getPlatform();
    const channelPlatform =
      platform === 'android' ? `android-${process.env.NEXT_PUBLIC_DISTRIBUTION_CHANNEL || 'direct'}` : platform;
    const res = await fetch(`${API_BASE_URL}/api/app-updates/latest?platform=${channelPlatform}`);
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
    // The backend computes this as a plain sha256 hex digest of the uploaded
    // zip (app-updates.service.ts) — no encryption/sessionKey involved, since
    // this app self-hosts releases rather than using Capgo's own signing
    // flow. The native plugin still verifies a bare checksum like this
    // against the downloaded file (CapgoUpdater.java's finishDownload) and
    // throws on mismatch, so this is enough to catch a corrupted download or
    // a tampered/MITM'd bundle URL without needing the full encryption setup.
    const downloaded = await CapacitorUpdater.download({ url: latest.url, version: latest.version, checksum: latest.checksum });
    await CapacitorUpdater.next({ id: downloaded.id });
    console.log(`${LOG_PREFIX} staged ${latest.version} — will apply on next background/restart`);
  } catch (err) {
    console.log(`${LOG_PREFIX} update check errored (offline or bad response):`, err);
  }
}
