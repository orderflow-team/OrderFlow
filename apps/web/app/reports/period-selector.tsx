'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { CalendarRange } from 'lucide-react';

const PRESETS = [
  { label: 'Today', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
  { label: '1 Year', days: 365 },
];

export function PeriodSelector({ days, onChange }: { days: number; onChange: (days: number) => void }) {
  const isPreset = PRESETS.some((p) => p.days === days);
  const [showCustom, setShowCustom] = useState(!isPreset);
  const [customValue, setCustomValue] = useState(isPreset ? '' : String(days));

  const handleSelect = (value: string) => {
    if (value === 'custom') {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    onChange(Number(value));
  };

  const applyCustom = () => {
    const parsed = Number(customValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      onChange(Math.round(parsed));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={showCustom ? 'custom' : String(days)} onValueChange={handleSelect}>
        <SelectTrigger className="min-w-[9.5rem]">
          <span className="flex items-center gap-2">
            <CalendarRange className="w-3.5 h-3.5 text-emerald-600" />
            <SelectValue>
              {(value: string) => {
                if (value === 'custom') return 'Custom...';
                return PRESETS.find((p) => String(p.days) === value)?.label ?? value;
              }}
            </SelectValue>
          </span>
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((preset) => (
            <SelectItem key={preset.days} value={String(preset.days)}>
              {preset.label}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom...</SelectItem>
        </SelectContent>
      </Select>
      {showCustom && (
        <>
          <Input
            type="number"
            min="1"
            placeholder="Days"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
            className="h-10 w-24 text-sm px-3"
          />
          <button
            type="button"
            onClick={applyCustom}
            className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold ring-1 ring-white/50 text-slate-700 bg-white/40 hover:bg-white/60 transition-colors"
          >
            Go
          </button>
        </>
      )}
    </div>
  );
}
