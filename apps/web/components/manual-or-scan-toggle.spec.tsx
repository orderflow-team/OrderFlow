import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const isNativePlatformMock = vi.fn();
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => isNativePlatformMock() } }));

import { ManualOrScanToggle } from './manual-or-scan-toggle';

describe('ManualOrScanToggle', () => {
  beforeEach(() => {
    isNativePlatformMock.mockReset();
  });

  it('renders nothing on the web', () => {
    isNativePlatformMock.mockReturnValue(false);
    const { container } = render(<ManualOrScanToggle scanMode={false} onChange={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the toggle on a native platform, highlighting the active mode', () => {
    isNativePlatformMock.mockReturnValue(true);
    render(<ManualOrScanToggle scanMode={false} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Manual/ }).className).toContain('bg-white');
    expect(screen.getByRole('button', { name: /Scan/ }).className).not.toContain('bg-white text-slate-800 shadow-sm');
  });

  it('calls onChange(true) when Scan is clicked', async () => {
    isNativePlatformMock.mockReturnValue(true);
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ManualOrScanToggle scanMode={false} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Scan/ }));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange(false) when Manual is clicked', async () => {
    isNativePlatformMock.mockReturnValue(true);
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ManualOrScanToggle scanMode={true} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Manual/ }));

    expect(onChange).toHaveBeenCalledWith(false);
  });
});
