import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders a known status with its label, spaces replacing underscores', () => {
    render(<StatusBadge status="payment_pending" />);

    expect(screen.getByText('payment pending')).toBeInTheDocument();
  });

  it('falls back to the default slate style for an unrecognized status', () => {
    render(<StatusBadge status="mystery_status" />);

    const badge = screen.getByText('mystery status');
    expect(badge.className).toContain('bg-slate-500/10');
  });

  it('applies the confirmed status color', () => {
    render(<StatusBadge status="confirmed" />);

    expect(screen.getByText('confirmed').className).toContain('bg-blue-500/10');
  });
});
