'use client';

import { useEffect, useRef } from 'react';

/**
 * Detects input from a USB/Bluetooth barcode scanner (keyboard-wedge mode).
 *
 * Scanners "type" the whole code in rapid bursts (10–30ms between keys) and
 * finish with Enter — far faster than human typing. We buffer printable keys,
 * reset the buffer whenever the gap between keys looks human, and treat an
 * Enter that terminates a long fast burst as a completed scan.
 *
 * If the burst leaked into a focused input (the scanner doesn't know where
 * focus is), the scanned characters are stripped back out of it so search
 * boxes and form fields aren't polluted.
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  { enabled = true, minLength = 5, maxGapMs = 50 }: { enabled?: boolean; minLength?: number; maxGapMs?: number } = {},
) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    let buffer = '';
    let lastKeyAt = 0;

    const stripFromInput = (el: Element | null, scanned: string) => {
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return;
      if (!el.value.endsWith(scanned)) return;
      const next = el.value.slice(0, -scanned.length);
      // Native setter + input event so React-controlled inputs pick up the change.
      const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(el, next);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();

      if (e.key === 'Enter') {
        const code = buffer;
        buffer = '';
        if (code.length >= minLength && now - lastKeyAt <= maxGapMs) {
          e.preventDefault();
          e.stopPropagation();
          stripFromInput(document.activeElement, code);
          onScanRef.current(code);
        }
        return;
      }

      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

      buffer = now - lastKeyAt > maxGapMs ? e.key : buffer + e.key;
      lastKeyAt = now;
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, minLength, maxGapMs]);
}
