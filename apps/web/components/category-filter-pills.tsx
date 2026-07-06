import { Trash2 } from 'lucide-react';

interface CategoryFilterPillsProps {
  categories: { id: string; name: string }[];
  selectedCategory: string | null;
  onSelect: (category: string | null) => void;
  totalCount: number;
  countFor: (categoryName: string) => number;
  onDeleteCategory?: (id: string) => void;
}

export function CategoryFilterPills({
  categories,
  selectedCategory,
  onSelect,
  totalCount,
  countFor,
  onDeleteCategory,
}: CategoryFilterPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <div
        className={`group relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold ring-1 cursor-pointer transition-colors backdrop-blur-sm ${
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
            className={`group relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold ring-1 cursor-pointer transition-colors backdrop-blur-sm ${
              isSel ? 'ring-emerald-500/30 text-emerald-700 bg-emerald-500/10' : 'ring-white/50 text-slate-700 bg-white/40 hover:bg-white/60'
            }`}
            onClick={() => onSelect(isSel ? null : c.name)}
          >
            {c.name} <span className="text-slate-400">({countFor(c.name)})</span>
            {onDeleteCategory && (
              <button
                className="hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full hover:bg-slate-500/10 text-slate-400 hover:text-rose-500 absolute -right-2 -top-2 bg-white/60 ring-1 ring-white/50 backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCategory(c.id);
                }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
