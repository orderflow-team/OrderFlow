'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import { dateRangePreset } from '@/lib/report-export';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: '7 days' },
  { id: 'month', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'fy', label: 'This FY' },
] as const;

export function DateRangeBar({ from, to, onChange, onApply, loading, onCsv, onPrint, disabled }: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  onApply: () => void;
  loading: boolean;
  onCsv?: () => void;
  onPrint?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(dateRangePreset(p.id))}
            className="px-3 py-1 rounded-full text-xs font-semibold ring-1 ring-white/50 text-slate-700 bg-white/40 hover:bg-white/60 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">From</label>
          <Input type="date" value={from} max={to} onChange={(e) => onChange({ from: e.target.value, to })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">To</label>
          <Input type="date" value={to} min={from} onChange={(e) => onChange({ from, to: e.target.value })} />
        </div>
        <Button onClick={onApply} disabled={loading || !from || !to}>{loading ? 'Loading...' : 'Generate'}</Button>
        {onCsv && (
          <Button variant="outline" onClick={onCsv} disabled={disabled} className="gap-1.5">
            <Download className="w-4 h-4" /> CSV
          </Button>
        )}
        {onPrint && (
          <Button variant="outline" onClick={onPrint} disabled={disabled} className="gap-1.5">
            <Printer className="w-4 h-4" /> Print / PDF
          </Button>
        )}
      </div>
    </div>
  );
}
