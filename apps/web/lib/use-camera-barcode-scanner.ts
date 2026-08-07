'use client';

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, type Barcode } from '@capacitor-mlkit/barcode-scanning';

export type CameraScanStatus =
  | 'idle'
  | 'requesting-permission'
  | 'permission-denied'
  | 'preparing-module'
  | 'scanning'
  | 'unsupported';

/**
 * Live camera barcode scanning (Google ML Kit via Capacitor). No-ops entirely
 * outside the native Android app, since the plugin only runs inside a
 * Capacitor WebView — web/PWA users keep using search + the hardware
 * scanner-gun path (`use-barcode-scanner.ts`) unchanged.
 *
 * ML Kit shows the native camera through a transparent WebView rather than
 * an in-page <video> element, so this hook toggles a `document.body` class
 * (see the `.barcode-scanner-active` rule in globals.css) instead of
 * returning a video ref.
 */
export function useCameraBarcodeScanner(onScan: (code: string) => void, { enabled }: { enabled: boolean }) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [status, setStatus] = useState<CameraScanStatus>('idle');
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    let listenerHandle: { remove: () => void } | null = null;

    const start = async () => {
      const { supported } = await BarcodeScanner.isSupported();
      if (cancelled) return;
      if (!supported) {
        setStatus('unsupported');
        return;
      }

      setStatus('requesting-permission');
      const permission = await BarcodeScanner.requestPermissions();
      if (cancelled) return;
      if (permission.camera !== 'granted' && permission.camera !== 'limited') {
        setStatus('permission-denied');
        return;
      }

      const { available: moduleAvailable } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (cancelled) return;
      if (!moduleAvailable) {
        setStatus('preparing-module');
        try {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        } catch {
          // Fall through — startScan() below will fail with a clearer native
          // error if the module genuinely can't be used on this device.
        }
        if (cancelled) return;
      }

      listenerHandle = await BarcodeScanner.addListener('barcodesScanned', (event) => {
        const first = event.barcodes[0] as Barcode | undefined;
        const code = first?.rawValue || first?.displayValue;
        if (!code) return;
        // Same barcode held in frame fires repeatedly — collapse repeats within
        // 700ms into a single scan. Short on purpose: long enough to swallow a
        // few consecutive frames of one motionless barcode, short enough that a
        // deliberate rescan (e.g. re-scanning the same item to bump its cart
        // quantity) — which needs real hand movement to reposition — still
        // registers instead of silently vibrating/adding nothing.
        const now = Date.now();
        const last = lastCodeRef.current;
        if (last && last.code === code && now - last.at < 700) return;
        lastCodeRef.current = { code, at: now };
        onScanRef.current(code);
      });

      document.body.classList.add('barcode-scanner-active');
      await BarcodeScanner.startScan();
      if (cancelled) return;
      setStatus('scanning');
    };

    start();

    return () => {
      cancelled = true;
      document.body.classList.remove('barcode-scanner-active');
      listenerHandle?.remove();
      BarcodeScanner.stopScan().catch(() => {});
      setStatus('idle');
    };
  }, [enabled]);

  return { status };
}
