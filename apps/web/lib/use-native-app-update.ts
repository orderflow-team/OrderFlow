'use client';

import { useEffect, useRef, useState } from 'react';
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
// moving, but at a speed that'll never realistically finish." A wall-clock
// ceiling on the whole download is what actually bounds that case — but a
// FLAT one flags a real connection as "too slow" just because the release
// got bigger, even if it's downloading at a perfectly fine rate. So the
// ceiling below is sized to the actual release once we know it (first
// 'progress' event), against a floor throughput low enough that only a
// connection that genuinely can't finish trips it.
const CONNECT_GRACE_MS = 30_000; // covers DNS/TLS/connect before we know the file's size
const MIN_ACCEPTABLE_BYTES_PER_SEC = 100 * 1024; // ~800kbps — well below anything that could stream 4K video
const MAX_DOWNLOAD_TIMEOUT_MS = 10 * 60_000; // sanity ceiling regardless of size

// How often we check our own file's size to compute progress. We can't trust
// the plugin's shared 'progress' event for this: it has no per-download id,
// and a timed-out attempt's native thread keeps running (and keeps firing
// that event) in the background since this plugin has no cancel API. On a
// retry, the new listener would receive the abandoned attempt's stale byte
// counts mixed in with its own — polling the size of a uniquely-named file
// per attempt sidesteps that entirely.
const PROGRESS_POLL_MS = 400;

// The backend computes this as a plain sha256 hex digest of the uploaded APK
// (app-apk-releases.service.ts) — verifying it here before handing the file
// to Android's installer is the only thing standing between a
// corrupted/truncated download (or a tampered/MITM'd release URL) and
// installing arbitrary native code. @capacitor/filesystem has no built-in
// checksum option (unlike @capgo/capacitor-updater's OTA bundle download),
// so this reads the file back and hashes it with the standard Web Crypto API,
// which every Android WebView already provides.
async function sha256Hex(base64Data: string): Promise<string> {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useNativeAppUpdate() {
  const [latest, setLatest] = useState<LatestApkRelease | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const [progressPct, setProgressPct] = useState<number | null>(null);
  const attemptSeq = useRef(0);

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

    // Unique per attempt so a retry never shares a destination file with an
    // abandoned prior download that's still writing in the background.
    const attemptId = ++attemptSeq.current;
    const path = `update-${attemptId}.apk`;
    if (attemptId > 1) {
      Filesystem.deleteFile({ path: `update-${attemptId - 1}.apk`, directory: Directory.Cache }).catch(() => {});
    }

    const downloadStart = Date.now();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let rejectTimeout: (() => void) | undefined;
    const scheduleTimeout = (ms: number) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => rejectTimeout?.(), ms);
    };
    const timeout = new Promise<never>((_, reject) => {
      rejectTimeout = () => reject(new Error('timeout'));
      scheduleTimeout(CONNECT_GRACE_MS);
    });

    // Total size is attempt-invariant (same release URL every time), so it's
    // safe to read off this event even though `bytes` isn't — see
    // PROGRESS_POLL_MS above for why bytes-so-far comes from polling instead.
    let contentLength = 0;
    const progressListener = await Filesystem.addListener('progress', (event) => {
      if (contentLength === 0 && event.contentLength > 0) {
        contentLength = event.contentLength;
        const budgetMs = Math.min(
          MAX_DOWNLOAD_TIMEOUT_MS,
          Math.max(CONNECT_GRACE_MS, (contentLength / MIN_ACCEPTABLE_BYTES_PER_SEC) * 1000),
        );
        scheduleTimeout(Math.max(0, budgetMs - (Date.now() - downloadStart)));
      }
    });

    const pollTimer = setInterval(async () => {
      if (!contentLength) return;
      try {
        const stat = await Filesystem.stat({ path, directory: Directory.Cache });
        setProgressPct(Math.round((stat.size / contentLength) * 100));
      } catch {
        // Destination file doesn't exist yet — connection still opening.
      }
    }, PROGRESS_POLL_MS);

    try {
      // connectTimeout/readTimeout catch a fully-dead connection; the race
      // against `timeout` above catches one that's merely too slow to ever
      // realistically finish, which readTimeout resets past on every byte.
      await Promise.race([
        Filesystem.downloadFile({
          url: latest.url,
          path,
          directory: Directory.Cache,
          connectTimeout: 15000,
          readTimeout: 30000,
          progress: true,
        }),
        timeout,
      ]);
      const { data } = await Filesystem.readFile({ path, directory: Directory.Cache });
      const actualChecksum = await sha256Hex(data as string);
      if (actualChecksum.toLowerCase() !== latest.checksum.toLowerCase()) {
        await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
        throw new Error('checksum_mismatch');
      }

      const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
      await FileOpener.open({ filePath: uri, contentType: 'application/vnd.android.package-archive' });
    } catch (err: any) {
      console.error('[native update] install failed', err);
      setError(
        err?.message === 'timeout'
          ? "Download is too slow to finish — try switching networks (WiFi/mobile data) and try again."
          : err?.message === 'checksum_mismatch'
          ? "The downloaded update doesn't match what was published — not installing it. Please try again."
          : "Couldn't download the update. Check your connection and try again.",
      );
    } finally {
      clearTimeout(timeoutId);
      clearInterval(pollTimer);
      await progressListener.remove();
      setInstalling(false);
      setProgressPct(null);
    }
  };

  return { available: !!latest, latest, installing, error, install, progressPct };
}
