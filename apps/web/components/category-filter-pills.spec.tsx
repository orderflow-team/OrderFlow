import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryFilterPills } from './category-filter-pills';

// Real (non-default) categories carry a UUID from the backend — a bare
// "cat-N" id is the component's own marker for a seeded default category
// (see the `!c.id.startsWith('cat-')` guard), which hides rename/delete.
const categories = [
  { id: 'uuid-1111', name: 'Snacks' },
  { id: 'uuid-2222', name: 'Dairy' },
];

describe('CategoryFilterPills', () => {
  it('renders the "All" pill with the total count and every category with its own count', () => {
    render(
      <CategoryFilterPills
        categories={categories}
        selectedCategory={null}
        onSelect={vi.fn()}
        totalCount={10}
        countFor={(name) => (name === 'Snacks' ? 4 : 6)}
      />,
    );

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('(10)')).toBeInTheDocument();
    expect(screen.getByText('Snacks')).toBeInTheDocument();
    expect(screen.getByText('(4)')).toBeInTheDocument();
    expect(screen.getByText('Dairy')).toBeInTheDocument();
    expect(screen.getByText('(6)')).toBeInTheDocument();
  });

  it('calls onSelect(null) when clicking "All"', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryFilterPills categories={categories} selectedCategory="Snacks" onSelect={onSelect} totalCount={10} countFor={() => 0} />,
    );

    await user.click(screen.getByText('All'));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('calls onSelect with the category name when clicking an unselected pill', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryFilterPills categories={categories} selectedCategory={null} onSelect={onSelect} totalCount={10} countFor={() => 0} />,
    );

    await user.click(screen.getByText('Snacks'));

    expect(onSelect).toHaveBeenCalledWith('Snacks');
  });

  it('toggles selection off (calls onSelect(null)) when clicking the already-selected pill', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryFilterPills categories={categories} selectedCategory="Snacks" onSelect={onSelect} totalCount={10} countFor={() => 0} />,
    );

    await user.click(screen.getByText('Snacks'));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('calls onDeleteCategory when the delete button for a pill is activated', async () => {
    const onDeleteCategory = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryFilterPills
        categories={categories}
        selectedCategory={null}
        onSelect={vi.fn()}
        totalCount={10}
        countFor={() => 0}
        onDeleteCategory={onDeleteCategory}
      />,
    );

    await user.click(screen.getAllByTitle('Delete Category')[0]);

    expect(onDeleteCategory).toHaveBeenCalledWith('uuid-1111');
  });

  it('opens the rename dialog, edits the name, and submits via onRenameCategory', async () => {
    const onRenameCategory = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <CategoryFilterPills
        categories={categories}
        selectedCategory={null}
        onSelect={vi.fn()}
        totalCount={10}
        countFor={() => 0}
        onRenameCategory={onRenameCategory}
      />,
    );

    await user.click(screen.getAllByTitle('Rename Category')[0]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('e.g. Diabetic Care');
    await user.clear(input);
    await user.type(input, 'Beverages');
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    expect(onRenameCategory).toHaveBeenCalledWith('uuid-1111', 'Beverages');
  });

  it('does not render rename/delete affordances for a default (non-custom) category id', () => {
    render(
      <CategoryFilterPills
        categories={[{ id: 'cat-default', name: 'Default Cat' }]}
        selectedCategory={null}
        onSelect={vi.fn()}
        totalCount={1}
        countFor={() => 1}
        onDeleteCategory={vi.fn()}
        onRenameCategory={vi.fn()}
      />,
    );

    expect(screen.queryByTitle('Delete Category')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Rename Category')).not.toBeInTheDocument();
  });
});
