'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { API_BASE_URL } from './api-client';
import { compareVersions } from './version-compare';

interface LatestApkRelease {
  versionName: string;
  url: string;
  checksum: string;
  notes: string | null;
}

/**
 * Checks for a newer native APK build (separate from the JS/OTA bundle
 * updater — this is for changes OTA can't deliver, like new native plugins
 * or Android permissions). No-ops entirely on web.
 *
 * Installing hands the downloaded APK to Android's own package installer —
 * the user still taps "Install" there, same as any app update. That's as
 * far as a sideloaded (non-Play-Store) app can automate this.
 */
// A trickling-but-never-fully-stalled connection keeps resetting Filesystem's
// per-chunk readTimeout forever, so it alone can't catch "technically still
// moving, but at a speed that'll never realistically finish." This wall-clock
// ceiling on the whole download is what actually bounds that case.
const DOWNLOAD_TIMEOUT_MS = 120_000;

export function useNativeAppUpdate() {
  const [latest, setLatest] = useState<LatestApkRelease | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const [progressPct, setProgressPct] = useState<number | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    (async () => {
      try {
        const { native } = await CapacitorUpdater.current();
        const res = await fetch(`${API_BASE_URL}/api/app-apk-releases/latest?platform=${Capacitor.getPlatform()}`);
        if (!res.ok) return;
        const release: LatestApkRelease | null = await res.json();
        if (release && compareVersions(release.versionName, native) > 0) {
          setLatest(release);
        }
      } catch {
        // Offline or no release published yet — same silent-fail behavior as the OTA updater.
      }
    })();
  }, []);

  const install = async () => {
    if (!latest || installing) return;
    setInstalling(true);
    setError('');
    setProgressPct(0);

    // Surfaces real progress instead of an opaque "Downloading…" — on a slow
    // connection that's still technically moving, seeing "12%" (vs a frozen
    // spinner) is the difference between "working, just slow" and "stuck."
    const progressListener = await Filesystem.addListener('progress', (event) => {
      if (event.contentLength > 0) {
        setProgressPct(Math.round((event.bytes / event.contentLength) * 100));
      }
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('timeout')), DOWNLOAD_TIMEOUT_MS);
    });

    try {
      // connectTimeout/readTimeout catch a fully-dead connection; the race
      // against `timeout` above catches one that's merely too slow to ever
      // realistically finish, which readTimeout resets past on every byte.
      await Promise.race([
        Filesystem.downloadFile({
          url: latest.url,
          path: 'update.apk',
          directory: Directory.Cache,
          connectTimeout: 15000,
          readTimeout: 30000,
          progress: true,
        }),
        timeout,
      ]);
      const { uri } = await Filesystem.getUri({ path: 'update.apk', directory: Directory.Cache });
      await FileOpener.open({ filePath: uri, contentType: 'application/vnd.android.package-archive' });
    } catch (err: any) {
      console.error('[native update] install failed', err);
      setError(
        err?.message === 'timeout'
          ? "Download is too slow to finish — try switching networks (WiFi/mobile data) and try again."
          : "Couldn't download the update. Check your connection and try again.",
      );
    } finally {
      clearTimeout(timeoutId);
      await progressListener.remove();
      setInstalling(false);
      setProgressPct(null);
    }
  };

  return { available: !!latest, latest, installing, error, install, progressPct };
}
