'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Delete, X } from 'lucide-react';

interface CalcKeypadProps {
  /** Cart ids currently present, so lines removed elsewhere drop out of the bar. */
  liveIds: string[];
  /** Adds a nameless line to the cart and returns its id. */
  onQuickAdd: (rate: number, qty: number) => string;
  onQuickRemove: (id: string) => void;
  /** When set, the keypad types into this rate instead of adding new lines. */
  rateEdit?: {
    label: string;
    value: string;
    onDigit: (d: string) => void;
    onBackspace: () => void;
    onDone: () => void;
  };
  /** Shows a drop-down handle that hides the keypad. */
  onCollapse?: () => void;
}

const fmt = (n: number) => Number(n.toFixed(2)).toString();

/** Ezo-style entry: type a rate, "×" for quantity, "+" to add the line. */
export function CalcKeypad({ liveIds, onQuickAdd, onQuickRemove, rateEdit, onCollapse }: CalcKeypadProps) {
  const [entry, setEntry] = useState('');
  const [pendingRate, setPendingRate] = useState<string | null>(null);
  const [tokens, setTokens] = useState<{ id: string; rate: number; qty: number }[]>([]);
  const barRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (barRef.current) barRef.current.scrollLeft = barRef.current.scrollWidth; }, [tokens, entry, pendingRate]);
  // Lines removed from the list by hand should drop out of the bar too.
  useEffect(() => {
    const live = new Set(liveIds);
    setTokens(t => (t.every(x => live.has(x.id)) ? t : t.filter(x => live.has(x.id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveIds.join('|')]);

  const pressDigit = (d: string) => {
    if (rateEdit) { rateEdit.onDigit(d); return; }
    setEntry(prev => {
      // Quantities are whole numbers, so no decimal point once "x" is pressed.
      if (d === '.' && pendingRate !== null) return prev;
      if (d === '.') return prev.includes('.') ? prev : (prev === '' ? '0.' : prev + '.');
      if (prev.length >= 9) return prev;
      return prev === '0' ? d : prev + d;
    });
  };
  const pressTimes = () => {
    if (rateEdit) return;
    if (pendingRate !== null || !(parseFloat(entry) > 0)) return;
    setPendingRate(entry);
    setEntry('');
  };
  const pressPlus = () => {
    if (rateEdit) { rateEdit.onDone(); return; }
    const rate = parseFloat(pendingRate ?? entry);
    if (!(rate > 0)) return;
    const qty = pendingRate !== null ? (parseInt(entry, 10) || 1) : 1;
    const id = onQuickAdd(rate, qty);
    setTokens(t => [...t, { id, rate, qty }]);
    setPendingRate(null);
    setEntry('');
  };
  const pressBackspace = () => {
    if (rateEdit) { rateEdit.onBackspace(); return; }
    if (entry) { setEntry(e => e.slice(0, -1)); return; }
    if (pendingRate !== null) { setEntry(pendingRate); setPendingRate(null); return; }
    const last = tokens[tokens.length - 1];
    if (last) { onQuickRemove(last.id); setTokens(t => t.slice(0, -1)); }
  };
  const clearCalc = () => { setEntry(''); setPendingRate(null); };

  return (
    <div className="border-t border-slate-200 bg-slate-50 px-3 pt-1">
      {onCollapse && (
        <button type="button" onClick={onCollapse} className="mx-auto flex items-center gap-1 px-4 py-0.5 text-[11px] text-slate-400 hover:text-slate-600" aria-label="Hide keypad">
          <ChevronDown className="w-4 h-4" /> Hide
        </button>
      )}
      {rateEdit ? (
        <div className={`relative rounded-lg border-2 border-emerald-500 bg-white px-3 pt-3 pb-1.5 ${onCollapse ? '' : 'mt-2'}`} data-testid="rate-bar">
          <span className="absolute -top-2 left-2 max-w-[80%] truncate bg-slate-50 px-1 text-[10px] text-emerald-700">Rate for {rateEdit.label || 'item'}</span>
          <div className="flex items-center gap-1 text-lg font-semibold text-slate-800 min-h-[1.75rem]">
            <span className="text-slate-400">₹</span>
            <span>{rateEdit.value}</span>
            {!rateEdit.value && <span className="text-slate-300 text-sm font-normal">Type the rate</span>}
          </div>
        </div>
      ) : (
      <div className={`relative rounded-lg border border-slate-300 bg-white px-3 pt-3 pb-1.5 ${onCollapse ? '' : 'mt-2'}`}>
        <span className="absolute -top-2 left-2 bg-slate-50 px-1 text-[10px] text-slate-500">Rate * Quantity + Rate * Quantity + ..</span>
        <div ref={barRef} className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-lg font-semibold text-slate-800 min-h-[1.75rem] [scrollbar-width:none]" data-testid="calc-bar">
          {tokens.map((t, i) => (
            <span key={t.id + i} className="flex items-center gap-1.5">
              {t.qty > 1 ? <>{fmt(t.rate)}<span className="text-amber-500">×</span>{t.qty}</> : fmt(t.rate)}
              <span className="text-emerald-600">+</span>
            </span>
          ))}
          {pendingRate !== null && <span>{pendingRate}<span className="text-amber-500"> ×</span></span>}
          <span>{entry}</span>
          {!entry && pendingRate === null && tokens.length === 0 && <span className="text-slate-300 text-sm font-normal">Type a rate, then +</span>}
          {(entry || pendingRate !== null) && (
            <button type="button" onClick={clearCalc} className="ml-auto flex-shrink-0 p-1 text-slate-300 hover:text-slate-500" aria-label="Clear entry"><X className="w-4 h-4" /></button>
          )}
        </div>
      </div>
      )}
      <div className="grid grid-cols-4 grid-rows-4 gap-1.5 mt-2 pb-2">
        {['1', '2', '3'].map(d => <button key={d} type="button" onClick={() => pressDigit(d)} className="h-11 rounded-lg border border-indigo-200 bg-white text-lg font-medium active:bg-indigo-50">{d}</button>)}
        <button type="button" onClick={pressBackspace} className="h-11 rounded-lg bg-rose-500 text-white flex items-center justify-center active:brightness-90" aria-label="Backspace"><Delete className="w-5 h-5" /></button>
        {['4', '5', '6'].map(d => <button key={d} type="button" onClick={() => pressDigit(d)} className="h-11 rounded-lg border border-indigo-200 bg-white text-lg font-medium active:bg-indigo-50">{d}</button>)}
        <button type="button" onClick={pressTimes} disabled={!!rateEdit} className="h-11 rounded-lg bg-amber-400 text-white text-2xl leading-none active:brightness-90 disabled:opacity-30" aria-label="Times">×</button>
        {['7', '8', '9'].map(d => <button key={d} type="button" onClick={() => pressDigit(d)} className="h-11 rounded-lg border border-indigo-200 bg-white text-lg font-medium active:bg-indigo-50">{d}</button>)}
        <button type="button" onClick={pressPlus} className="row-span-2 rounded-lg bg-emerald-600 text-white text-3xl leading-none active:brightness-90 flex items-center justify-center" aria-label={rateEdit ? 'Done' : 'Add line'}>{rateEdit ? <Check className="w-8 h-8" /> : '+'}</button>
        <button type="button" onClick={() => pressDigit('.')} className="h-11 rounded-lg border border-indigo-200 bg-white text-lg font-medium active:bg-indigo-50">.</button>
        <button type="button" onClick={() => pressDigit('0')} className="h-11 rounded-lg border border-indigo-200 bg-white text-lg font-medium active:bg-indigo-50">0</button>
        <button type="button" onClick={() => { if (rateEdit) rateEdit.onDigit('00'); else if (entry) { pressDigit('0'); pressDigit('0'); } }} className="h-11 rounded-lg border border-indigo-200 bg-white text-lg font-medium active:bg-indigo-50">00</button>
      </div>
    </div>
  );
}
