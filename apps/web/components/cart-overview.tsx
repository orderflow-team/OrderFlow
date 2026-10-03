'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Keyboard, Lock, Minus, Plus, Save, Trash2 } from 'lucide-react';
import { CalcKeypad } from '@/components/calc-keypad';
import { Button } from '@/components/ui/button';
import type { CartItem } from '@/components/generic-order-modal';

interface CartOverviewProps {
  items: CartItem[];
  total: number;
  /** Salesmen only record what the customer wants — rates stay read-only. */
  priceReadOnly: boolean;
  submitting: boolean;
  submitLabel: string;
  error?: string;
  unitSaveState: Record<string, 'saving' | 'saved'>;
  getMaxQty: (item: CartItem) => number;
  onBack: () => void;
  onSubmit: () => void;
  onName: (id: string, name: string) => void;
  onRate: (id: string, rate: string) => void;
  onUnit: (id: string, unit: string) => void;
  onQty: (item: CartItem, qty: number) => void;
  onRemove: (id: string) => void;
  onSaveUnitPrice?: (item: CartItem) => void;
  /** Calculator entry: adds a nameless line and returns its cart id. */
  onQuickAdd: (rate: number, qty: number) => string;
  onQuickRemove: (id: string) => void;
}

const rateOf = (item: CartItem) => Number(item.product.selling_price) || 0;
const fmt = (n: number) => Number(n.toFixed(2)).toString();

export function CartOverview(props: CartOverviewProps) {
  const {
    items, total, priceReadOnly, submitting, submitLabel, error, unitSaveState,
    getMaxQty, onBack, onSubmit, onName, onRate, onUnit, onQty, onRemove, onSaveUnitPrice, onQuickAdd, onQuickRemove,
  } = props;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [calcOpen, setCalcOpen] = useState(true);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Salesmen can't set rates, so a missing rate never blocks them.
  const zeroCount = priceReadOnly ? 0 : items.filter(i => rateOf(i) <= 0).length;
  const firstZeroId = priceReadOnly ? undefined : items.find(i => rateOf(i) <= 0)?.product.id;
  // Rates are typed on the in-app keypad (never the phone's keyboard). `fresh` means the
  // next key replaces the existing rate, like a selected field.
  const [rateEditId, setRateEditId] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const [rateDraft, setRateDraft] = useState<Record<string, string>>({});
  // True while a name / qty / unit field has the phone keyboard up: our keypad steps aside.
  const [typing, setTyping] = useState(false);
  const editing = rateEditId && items.some(i => i.product.id === rateEditId) ? rateEditId : null;

  const startRateEdit = (id: string) => {
    if (priceReadOnly) return;
    setCalcOpen(true);
    setRateEditId(id);
    setFresh(true);
    requestAnimationFrame(() => rowRefs.current[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };
  const setRate = (id: string, v: string) => {
    setRateDraft(p => ({ ...p, [id]: v }));
    onRate(id, v === '' || v === '.' ? '0' : v);
  };
  const rateDigit = (d: string) => {
    if (!editing) return;
    const base = fresh ? '' : (rateDraft[editing] ?? '');
    setFresh(false);
    if (d === '.') { if (!base.includes('.')) setRate(editing, base === '' ? '0.' : base + '.'); return; }
    if (d === '00') { if (base !== '' && base !== '0' && base.length + 2 <= 9) setRate(editing, base + '00'); return; }
    if (base.length >= 9) return;
    setRate(editing, base === '0' ? d : base + d);
  };
  const rateBackspace = () => {
    if (!editing) return;
    const base = fresh ? '' : (rateDraft[editing] ?? '');
    setFresh(false);
    setRate(editing, base.slice(0, -1));
  };
  const rateDone = () => {
    const current = editing;
    setRateDraft({});
    setFresh(false);
    // Hop to the next line that still has no rate, otherwise close the editor.
    const next = items.find(i => i.product.id !== current && rateOf(i) <= 0);
    if (next && !priceReadOnly) startRateEdit(next.product.id);
    else setRateEditId(null);
  };
  // Open straight on the first missing rate.
  useEffect(() => { if (firstZeroId) startRateEdit(firstZeroId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') e.currentTarget.blur();
  };
  const typingProps = {
    onFocus: () => { setTyping(true); setRateEditId(null); setRateDraft({}); },
    onBlur: () => setTyping(false),
  };

  // Jump to the first line that still needs a rate when the user tries to place the order.
  const [attempted, setAttempted] = useState(false);
  useEffect(() => { if (zeroCount === 0) setAttempted(false); }, [zeroCount]);

  const handlePlace = () => {
    if (firstZeroId) {
      setAttempted(true);
      rowRefs.current[firstZeroId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onSubmit();
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-white/95 backdrop-blur-3xl rounded-3xl overflow-hidden" data-testid="cart-overview">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
        <button type="button" onClick={onBack} className="p-1.5 -ml-1.5 rounded-full text-slate-600 hover:bg-slate-100" aria-label="Back to items">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-slate-800">Cart Overview</h2>
        <span className="text-xs text-slate-500">({items.length} items)</span>
        <Button type="button" variant="outline" size="sm" className="ml-auto gap-1" onClick={onBack}>
          <Plus className="w-3.5 h-3.5" /> Add more
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_4.5rem_6.5rem_4.5rem] gap-1.5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-100">
        <span>Item</span><span className="text-right">Rate</span><span className="text-center">Qty</span><span className="text-right">Total</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {items.length === 0 && <p className="text-center text-sm text-slate-400 py-10">Your cart is empty.</p>}
        {items.map(item => {
          const id = item.product.id;
          const rate = rateOf(item);
          const needsRate = rate <= 0 && !priceReadOnly;
          const isOpen = !!expanded[id];
          const noUnit = !item.product.unit || !item.product.unit.trim();
          return (
            <div key={id} ref={el => { rowRefs.current[id] = el; }} className="py-2.5 border-b border-slate-100 last:border-0" data-testid="cart-row">
              <div className="grid grid-cols-[1fr_4.5rem_6.5rem_4.5rem] gap-1.5 items-center">
                <input
                  type="text"
                  value={item.product.name}
                  onChange={e => onName(id, e.target.value)}
                  onKeyDown={blurOnEnter}
                  enterKeyHint="done"
                  {...typingProps}
                  className="min-w-0 text-sm font-medium text-slate-800 bg-transparent rounded px-1 -mx-1 outline-none focus:ring-1 focus:ring-emerald-500"
                  aria-label="Item name"
                />

                <button
                  type="button"
                  disabled={priceReadOnly}
                  onClick={() => startRateEdit(id)}
                  aria-label="Rate"
                  title={priceReadOnly ? undefined : 'Tap to change rate'}
                  className={`flex items-center justify-end gap-0.5 h-8 px-1.5 rounded-md text-sm border ${
                    editing === id
                      ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 text-slate-900'
                      : needsRate
                        ? 'border-rose-400 bg-rose-50 text-rose-500'
                        : 'border-transparent text-slate-700'
                  } ${priceReadOnly ? 'cursor-default' : ''}`}
                >
                  {editing === id
                    ? <>₹{rateDraft[id] ?? (rate > 0 ? String(rate) : '')}<span className="w-px h-4 bg-emerald-500 animate-pulse" /></>
                    : needsRate
                      ? <span className="text-xs">Rate</span>
                      : <>{!priceReadOnly && <Lock className="w-2.5 h-2.5 text-slate-300" />}₹{fmt(rate)}</>}
                </button>

                <div className="flex items-center justify-center gap-0.5">
                  <button type="button" onClick={() => onQty(item, item.quantity - 1)} className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100" aria-label="Decrease">
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={item.quantity === 0 ? '' : item.quantity}
                    onChange={e => {
                      const v = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 0) onQty(item, v);
                    }}
                    onFocus={e => { e.target.select(); typingProps.onFocus(); }}
                    onBlur={() => { typingProps.onBlur(); if (item.quantity === 0) onQty(item, 0); }}
                    onKeyDown={blurOnEnter}
                    enterKeyHint="done"
                    aria-label="Quantity"
                    className="w-8 text-center text-sm font-medium bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    disabled={item.quantity >= getMaxQty(item)}
                    onClick={() => onQty(item, item.quantity + 1)}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    aria-label="Increase"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-right text-sm font-semibold text-slate-800">₹{fmt(rate * item.quantity)}</div>
              </div>

              <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                <span>{needsRate ? '' : `${fmt(rate)} × ${item.quantity}`}{item.product.unit ? ` · ${item.product.unit}` : ''}</span>
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => setExpanded(p => ({ ...p, [id]: !p[id] }))} className={`flex items-center gap-0.5 px-1 rounded hover:bg-slate-100 ${noUnit ? 'text-rose-500' : ''}`}>
                    {noUnit ? 'Set unit' : 'Unit'} {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <button type="button" onClick={() => onRemove(id)} className="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Remove item">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>

              {(isOpen || noUnit) && (
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="text"
                    list="cart-overview-unit-options"
                    value={item.product.unit || ''}
                    placeholder="Unit"
                    onChange={e => onUnit(id, e.target.value)}
                    onKeyDown={blurOnEnter}
                    enterKeyHint="done"
                    {...typingProps}
                    className={`w-24 h-7 text-xs rounded border px-1.5 outline-none ${noUnit ? 'border-rose-400' : 'border-slate-300'} focus:ring-1 focus:ring-emerald-500`}
                  />
                  {!priceReadOnly && onSaveUnitPrice && (
                    <button
                      type="button"
                      onClick={() => onSaveUnitPrice(item)}
                      disabled={id.startsWith('draft-') || unitSaveState[id] === 'saving'}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 disabled:opacity-30"
                    >
                      {unitSaveState[id] === 'saved' ? <Check className="w-3 h-3 text-emerald-600" /> : <Save className="w-3 h-3" />} Save price for this unit
                    </button>
                  )}
                </div>
              )}

              {needsRate && attempted && (
                <p className="mt-1 text-[11px] text-rose-500">Enter a rate for this item to continue.</p>
              )}
            </div>
          );
        })}
        <datalist id="cart-overview-unit-options">
          {['pcs', 'kg', 'g', '100g', '250g', '500g', 'L', 'ml', '100ml', '250ml', '500ml', 'pl', 'box', 'pkt'].map(u => <option key={u} value={u} />)}
        </datalist>
      </div>

      {calcOpen && !typing && (
        <CalcKeypad
          liveIds={items.map(i => i.product.id)}
          onQuickAdd={onQuickAdd}
          onQuickRemove={onQuickRemove}
          onCollapse={() => { setCalcOpen(false); setRateEditId(null); setRateDraft({}); }}
          rateEdit={editing ? {
            label: items.find(i => i.product.id === editing)?.product.name ?? '',
            value: rateDraft[editing] ?? (rateOf(items.find(i => i.product.id === editing)!) > 0 ? String(rateOf(items.find(i => i.product.id === editing)!)) : ''),
            onDigit: rateDigit,
            onBackspace: rateBackspace,
            onDone: rateDone,
          } : undefined}
        />
      )}

      <div className="px-4 pt-2 pb-3 border-t border-slate-200 bg-white/80">
        {error && <p className="mb-1 text-xs text-rose-600">{error}</p>}
        {zeroCount > 0 && (
          <p className="mb-1 text-xs text-rose-500">{zeroCount} item{zeroCount > 1 ? 's' : ''} need{zeroCount > 1 ? '' : 's'} a rate.</p>
        )}
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setCalcOpen(o => !o)} className="p-2 rounded-lg border border-slate-300 text-slate-600" aria-label={calcOpen ? 'Hide calculator' : 'Show calculator'}>
            <Keyboard className="w-5 h-5" />
          </button>
          <div className="leading-tight">
            <div className="text-[11px] text-slate-500">Total</div>
            <div className="font-bold text-xl text-slate-800" data-testid="cart-total">₹{total.toFixed(2)}</div>
          </div>
          <Button className="flex-1 h-11 text-base font-semibold" disabled={items.length === 0 || submitting} onClick={handlePlace}>
            {submitting ? 'Submitting...' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
