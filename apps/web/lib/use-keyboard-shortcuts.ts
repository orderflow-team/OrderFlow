'use client';

import { useEffect, useRef } from 'react';

export interface ShortcutBinding {
  /** e.g. 'n', 'Enter', '/', 'Escape' — matched case-insensitively against KeyboardEvent.key. */
  key: string;
  ctrl?: boolean;
  handler: () => void;
  /** Fire even while an input/textarea/contentEditable is focused. Default false, since most
   *  single-key shortcuts (e.g. "n") would otherwise hijack normal typing. */
  allowInInput?: boolean;
}

/**
 * Lightweight global keyboard-shortcut listener, mirroring useBarcodeScanner's
 * ref-based-callback pattern so bindings can close over fresh state without
 * re-attaching the DOM listener on every render.
 */
export function useKeyboardShortcuts(bindings: ShortcutBinding[], enabled = true) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      for (const binding of bindingsRef.current) {
        const keyMatches = e.key.toLowerCase() === binding.key.toLowerCase();
        const ctrlMatches = !!binding.ctrl === (e.ctrlKey || e.metaKey);
        if (!keyMatches || !ctrlMatches) continue;
        if (isTyping && !binding.allowInInput) continue;

        e.preventDefault();
        binding.handler();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
