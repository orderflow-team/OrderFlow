import { useState } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CategoryFilterPillsProps {
  categories: { id: string; name: string }[];
  selectedCategory: string | null;
  onSelect: (category: string | null) => void;
  totalCount: number;
  countFor: (categoryName: string) => number;
  onDeleteCategory?: (id: string) => void;
  onRenameCategory?: (id: string, name: string) => Promise<void> | void;
}

export function CategoryFilterPills({
  categories,
  selectedCategory,
  onSelect,
  totalCount,
  countFor,
  onDeleteCategory,
  onRenameCategory,
}: CategoryFilterPillsProps) {
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat || !newName.trim() || !onRenameCategory) return;
    setSaving(true);
    try {
      await onRenameCategory(editingCat.id, newName.trim());
      setEditingCat(null);
      setNewName('');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-nowrap gap-2 overflow-x-auto -mx-1 px-1 pt-3 -mt-3 pb-2 scrollbar-subtle">
      <div
        className={`shrink-0 whitespace-nowrap group relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold ring-1 cursor-pointer transition-colors backdrop-blur-sm ${
          selectedCategory === null ? 'ring-emerald-500/30 text-emerald-700 bg-emerald-500/10' : 'ring-white/50 text-slate-700 bg-white/40 hover:bg-white/60'
        }`}
        onClick={() => onSelect(null)}
      >
        All <span className="text-slate-400">({totalCount})</span>
      </div>
      {categories.map((c) => {
        const isSel = selectedCategory === c.name;
        return (
          <div
            key={c.id}
            className={`shrink-0 whitespace-nowrap group relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold ring-1 cursor-pointer transition-colors backdrop-blur-sm ${
              isSel ? 'ring-emerald-500/30 text-emerald-700 bg-emerald-500/10' : 'ring-white/50 text-slate-700 bg-white/40 hover:bg-white/60'
            }`}
            onClick={() => onSelect(isSel ? null : c.name)}
          >
            {c.name} <span className="text-slate-400">({countFor(c.name)})</span>
            {!c.id.startsWith('cat-') && (
              <div className="hidden group-hover:flex items-center gap-1 absolute -right-2 -top-2 z-10">
                {onRenameCategory && (
                  <button
                    className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-slate-500/10 text-slate-400 hover:text-emerald-600 bg-white/90 ring-1 ring-white/50 backdrop-blur-sm shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCat(c);
                      setNewName(c.name);
                    }}
                    title="Rename Category"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                )}
                {onDeleteCategory && (
                  <button
                    className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-slate-500/10 text-slate-400 hover:text-rose-500 bg-white/90 ring-1 ring-white/50 backdrop-blur-sm shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCategory(c.id);
                    }}
                    title="Delete Category"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      <Dialog open={editingCat !== null} onOpenChange={(open) => !open && setEditingCat(null)}>
        <DialogContent className="sm:max-w-[400px] p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl">Rename Category</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Category Name</label>
              <Input
                className="h-11"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Diabetic Care"
                required
                disabled={saving}
              />
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/40">
              <Button type="button" variant="ghost" onClick={() => setEditingCat(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Rename'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
