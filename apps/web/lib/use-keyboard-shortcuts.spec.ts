import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts } from './use-keyboard-shortcuts';

function fireKey(key: string, opts: { ctrlKey?: boolean; metaKey?: boolean; target?: EventTarget } = {}) {
  const event = new KeyboardEvent('keydown', { key, ctrlKey: opts.ctrlKey, metaKey: opts.metaKey, bubbles: true, cancelable: true });
  if (opts.target) {
    Object.defineProperty(event, 'target', { value: opts.target, enumerable: true });
  }
  window.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts', () => {
  it('invokes the handler for a matching key press', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'n', handler }]));

    fireKey('n');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('matches the key case-insensitively', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'N', handler }]));

    fireKey('n');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire a plain-key shortcut while typing in an input by default', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'n', handler }]));
    const input = document.createElement('input');
    document.body.appendChild(input);

    fireKey('n', { target: input });

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('fires even while typing when allowInInput is set', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'Escape', handler, allowInInput: true }]));
    const input = document.createElement('input');
    document.body.appendChild(input);

    fireKey('Escape', { target: input });

    expect(handler).toHaveBeenCalledTimes(1);
    document.body.removeChild(input);
  });

  it('requires ctrl/meta when the binding specifies ctrl', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 's', ctrl: true, handler }]));

    fireKey('s');
    expect(handler).not.toHaveBeenCalled();

    fireKey('s', { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('matches a meta-key press for a ctrl binding (Mac Cmd)', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 's', ctrl: true, handler }]));

    fireKey('s', { metaKey: true });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not attach a listener when disabled', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'n', handler }], false));

    fireKey('n');

    expect(handler).not.toHaveBeenCalled();
  });

  it('always uses the latest bindings passed on re-render without re-attaching the listener', () => {
    const handlerV1 = vi.fn();
    const handlerV2 = vi.fn();
    const { rerender } = renderHook(({ handler }) => useKeyboardShortcuts([{ key: 'n', handler }]), {
      initialProps: { handler: handlerV1 },
    });

    rerender({ handler: handlerV2 });
    fireKey('n');

    expect(handlerV1).not.toHaveBeenCalled();
    expect(handlerV2).toHaveBeenCalledTimes(1);
  });

  it('removes its listener on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts([{ key: 'n', handler }]));

    unmount();
    fireKey('n');

    expect(handler).not.toHaveBeenCalled();
  });
});
