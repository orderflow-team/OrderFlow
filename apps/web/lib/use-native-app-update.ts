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
export function useNativeAppUpdate() {
  const [latest, setLatest] = useState<LatestApkRelease | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');

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
    try {
      // Without explicit timeouts, Capacitor's downloadFile waits forever on a
      // stalled connection — a DNS hiccup or a network that silently drops the
      // request to this host never surfaces an error, leaving the button stuck
      // on "Downloading…" indefinitely instead of failing into the retry state.
      await Filesystem.downloadFile({
        url: latest.url,
        path: 'update.apk',
        directory: Directory.Cache,
        connectTimeout: 15000,
        readTimeout: 30000,
      });
      const { uri } = await Filesystem.getUri({ path: 'update.apk', directory: Directory.Cache });
      await FileOpener.open({ filePath: uri, contentType: 'application/vnd.android.package-archive' });
    } catch (err) {
      console.error('[native update] install failed', err);
      setError("Couldn't download the update. Check your connection and try again.");
    } finally {
      setInstalling(false);
    }
  };

  return { available: !!latest, latest, installing, error, install };
}
