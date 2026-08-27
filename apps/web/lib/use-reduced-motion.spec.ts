import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from './use-reduced-motion';

describe('useReducedMotion', () => {
  let listeners: Array<(e: any) => void>;
  let matchesRef: { current: boolean };

  beforeEach(() => {
    listeners = [];
    matchesRef = { current: false };
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return matchesRef.current;
      },
      media: query,
      addEventListener: (_event: string, cb: (e: any) => void) => listeners.push(cb),
      removeEventListener: (_event: string, cb: (e: any) => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
    }));
  });

  it('reflects the initial OS preference', () => {
    matchesRef.current = true;

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });

  it('defaults to false when the OS has no preference', () => {
    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it('updates when the media query change event fires', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    matchesRef.current = true;
    act(() => {
      listeners.forEach((cb) => cb({}));
    });

    expect(result.current).toBe(true);
  });

  it('removes its listener on unmount', () => {
    const { unmount } = renderHook(() => useReducedMotion());
    expect(listeners).toHaveLength(1);

    unmount();

    expect(listeners).toHaveLength(0);
  });
});
