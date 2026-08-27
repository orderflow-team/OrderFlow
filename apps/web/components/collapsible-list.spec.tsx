import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollapsibleList } from './collapsible-list';

interface Item {
  id: string;
  label: string;
}

const buildItems = (count: number): Item[] =>
  Array.from({ length: count }, (_, i) => ({ id: `item-${i}`, label: `Item ${i}` }));

describe('CollapsibleList', () => {
  it('renders every item when there are 5 or fewer', () => {
    render(
      <CollapsibleList items={buildItems(5)} renderRow={(i) => i.label} keyFor={(i) => i.id} />,
    );

    expect(screen.getAllByText(/Item \d/)).toHaveLength(5);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('collapses to the first 5 items and shows a "Show N more" toggle when there are more', () => {
    render(
      <CollapsibleList items={buildItems(8)} renderRow={(i) => i.label} keyFor={(i) => i.id} />,
    );

    expect(screen.getAllByText(/Item \d/)).toHaveLength(5);
    expect(screen.getByRole('button', { name: /Show 3 more/ })).toBeInTheDocument();
  });

  it('expands to show every item when the toggle is clicked, and collapses back on a second click', async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleList items={buildItems(8)} renderRow={(i) => i.label} keyFor={(i) => i.id} />,
    );

    await user.click(screen.getByRole('button', { name: /Show 3 more/ }));
    expect(screen.getAllByText(/Item \d/)).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getAllByText(/Item \d/)).toHaveLength(5);
  });
});
