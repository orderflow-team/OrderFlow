'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

const COLLAPSED_LIST_LIMIT = 5;

export function CollapsibleList<T>({
  items,
  renderRow,
  keyFor,
  containerClassName = 'space-y-2',
  rowClassName = 'flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0',
  buttonClassName = 'w-full text-xs font-semibold text-slate-500 hover:text-slate-700 pt-1 flex items-center justify-center gap-1',
}: {
  items: T[];
  renderRow: (item: T) => ReactNode;
  keyFor: (item: T) => string;
  containerClassName?: string;
  rowClassName?: string;
  buttonClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, COLLAPSED_LIST_LIMIT);
  const hiddenCount = items.length - COLLAPSED_LIST_LIMIT;

  return (
    <div className={containerClassName}>
      {visible.map((item) => (
        <div key={keyFor(item)} className={rowClassName}>
          {renderRow(item)}
        </div>
      ))}
      {hiddenCount > 0 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className={buttonClassName}>
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}
