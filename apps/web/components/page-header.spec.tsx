import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="Products" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(<PageHeader title="Products" description="Manage your catalog" />);

    expect(screen.getByText('Manage your catalog')).toBeInTheDocument();
  });

  it('omits the description paragraph when not provided', () => {
    render(<PageHeader title="Products" />);

    expect(screen.queryByText('Manage your catalog')).not.toBeInTheDocument();
  });

  it('renders the action slot when provided', () => {
    render(<PageHeader title="Products" action={<button>Add Product</button>} />);

    expect(screen.getByRole('button', { name: 'Add Product' })).toBeInTheDocument();
  });
});
