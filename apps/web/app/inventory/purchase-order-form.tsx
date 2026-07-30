'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import type { PoFieldConfig } from '@/lib/business-modules';
import { AlertTriangle, Trash2, Plus } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
}

export interface PoLine {
  id?: string;
  productId: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  taxPercentage: string;
  schemeQuantity: string;
  batchNumber: string;
  expiryDate: string;
}

export interface EditingPo {
  id: string;
  order_number: string;
  status: string;
  supplier_id: string | null;
  items: {
    id: string;
    product_id: string | null;
    quantity: string | number;
    unit_price: string | number;
    tax_percentage?: string | number;
    scheme_quantity?: string | number | null;
    batch_number?: string | null;
    expiry_date?: string | null;
  }[];
}

const emptyLine = (): PoLine => ({
  productId: '',
  productName: '',
  quantity: '1',
  unitPrice: '',
  taxPercentage: '',
  schemeQuantity: '',
  batchNumber: '',
  expiryDate: '',
});

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 min-w-0 ${className ?? ''}`}>
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

// Compact cell input — shared styling for every table-cell field, sized for
// a dense row rather than a full-height form field.
const cellInput = 'h-8 w-full rounded-md bg-white/50 ring-1 ring-white/50 px-2 text-xs outline-none focus:ring-emerald-400/60';

function toLine(item: EditingPo['items'][number], products: ProductOption[]): PoLine {
  return {
    id: item.id,
    productId: item.product_id ?? '',
    productName: products.find((p) => p.id === item.product_id)?.name ?? '',
    quantity: String(item.quantity ?? ''),
    unitPrice: String(item.unit_price ?? ''),
    taxPercentage: item.tax_percentage != null ? String(item.tax_percentage) : '',
    schemeQuantity: item.scheme_quantity != null ? String(item.scheme_quantity) : '',
    batchNumber: item.batch_number ?? '',
    expiryDate: item.expiry_date ? item.expiry_date.slice(0, 10) : '',
  };
}

export function PurchaseOrderForm({
  businessId,
  suppliers,
  products,
  fieldConfig,
  editingPo,
  onSaved,
  onCancel,
  onProductCreated,
}: {
  businessId: string;
  suppliers: Supplier[];
  products: ProductOption[];
  fieldConfig: PoFieldConfig;
  editingPo: EditingPo | null;
  onSaved: () => void;
  onCancel: () => void;
  onProductCreated?: (product: ProductOption) => void;
}) {
  const [supplierId, setSupplierId] = useState(editingPo?.supplier_id ?? '');
  const [orderNumber, setOrderNumber] = useState(editingPo?.order_number ?? '');
  const [lines, setLines] = useState<PoLine[]>(
    editingPo && editingPo.items.length > 0 ? editingPo.items.map((item) => toLine(item, products)) : [emptyLine()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [creatingProductAt, setCreatingProductAt] = useState<number | null>(null);
  const focusNextRow = useRef(false);
  const productRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Local mirror of `products` so a product created mid-session (before the
  // parent's own reload) is immediately matchable/selectable in other rows.
  const [knownProducts, setKnownProducts] = useState<ProductOption[]>(products);

  useEffect(() => {
    setKnownProducts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      const merged = [...prev];
      for (const p of products) {
        if (!seen.has(p.id)) merged.push(p);
      }
      return merged;
    });
  }, [products]);

  useEffect(() => {
    setSupplierId(editingPo?.supplier_id ?? '');
    setOrderNumber(editingPo?.order_number ?? '');
    setLines(editingPo && editingPo.items.length > 0 ? editingPo.items.map((item) => toLine(item, products)) : [emptyLine()]);
  }, [editingPo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus the new row's product picker whenever a row is appended via
  // "Add item" or the Enter-to-add-next-row shortcut, so bulk entry never
  // needs a mouse click to keep going.
  useEffect(() => {
    if (focusNextRow.current) {
      focusNextRow.current = false;
      productRefs.current[lines.length - 1]?.focus();
    }
  }, [lines.length]);

  const updateLine = (index: number, patch: Partial<PoLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const findByName = (name: string) => knownProducts.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());

  const handleProductNameChange = (index: number, name: string) => {
    const match = findByName(name);
    updateLine(index, { productName: name, productId: match ? match.id : '' });
  };

  // Guards against the same row's create-on-blur firing twice concurrently
  // (e.g. blur followed immediately by Enter-to-submit) and creating two
  // duplicate draft products for one typed name.
  const resolvingRef = useRef<Map<number, Promise<string>>>(new Map());

  // Resolves the row's typed name to an existing product, or — if nothing
  // matches — creates a new draft product on the spot (unit price seeded from
  // whatever cost was already entered) so it shows up in the Medicines grid
  // right away instead of silently failing at submit time.
  const resolveOrCreateProduct = (index: number): Promise<string> => {
    const inFlight = resolvingRef.current.get(index);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const line = lines[index];
      const trimmed = line.productName.trim();
      if (!trimmed) return '';
      if (line.productId) return line.productId;

      const match = findByName(trimmed);
      if (match) {
        updateLine(index, { productId: match.id });
        return match.id;
      }

      setCreatingProductAt(index);
      try {
        const res = await apiClient.post('/api/products', {
          businessId,
          name: trimmed,
          sellingPrice: Number(line.unitPrice) || 0,
          purchasePrice: line.unitPrice ? Number(line.unitPrice) : undefined,
          isDraft: true,
        });
        const created: ProductOption = { id: res.data.id, name: res.data.name };
        setKnownProducts((prev) => [...prev, created]);
        updateLine(index, { productId: created.id });
        onProductCreated?.(created);
        return created.id;
      } catch (err) {
        console.error('[purchase order] failed to create new product', err);
        return '';
      } finally {
        setCreatingProductAt((prev) => (prev === index ? null : prev));
      }
    })().finally(() => {
      resolvingRef.current.delete(index);
    });

    resolvingRef.current.set(index, promise);
    return promise;
  };

  const addLine = () => {
    focusNextRow.current = true;
    setLines((prev) => [...prev, emptyLine()]);
  };

  // Pressing Enter anywhere in the last row adds a fresh row and jumps focus
  // there — lets someone punch in a whole invoice's worth of items without
  // ever reaching for the mouse.
  const handleRowKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && index === lines.length - 1) {
      e.preventDefault();
      addLine();
    }
  };

  const totals = lines.reduce(
    (acc, l) => {
      const qty = Number(l.quantity) || 0;
      const price = Number(l.unitPrice) || 0;
      const subtotal = qty * price;
      const tax = subtotal * ((Number(l.taxPercentage) || 0) / 100);
      return { subtotal: acc.subtotal + subtotal, tax: acc.tax + tax };
    },
    { subtotal: 0, tax: 0 },
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Enter/click-to-submit can outrun a row's onBlur — make sure every typed
    // product name is resolved (matched or newly created) before building the payload.
    const resolvedIds = await Promise.all(lines.map((_, i) => resolveOrCreateProduct(i)));
    if (resolvedIds.some((id, i) => !id && lines[i].productName.trim())) {
      setError('Could not resolve one of the product names — please try again.');
      setSaving(false);
      return;
    }

    const items = lines.map((l, i) => ({
      ...(l.id ? { id: l.id } : {}),
      productId: resolvedIds[i] || l.productId,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      taxPercentage: l.taxPercentage ? Number(l.taxPercentage) : undefined,
      schemeQuantity: fieldConfig.schemeQuantity && l.schemeQuantity ? Number(l.schemeQuantity) : undefined,
      batchNumber: fieldConfig.batchExpiry ? l.batchNumber || undefined : undefined,
      expiryDate: fieldConfig.batchExpiry ? l.expiryDate || undefined : undefined,
    }));
    try {
      if (editingPo) {
        await apiClient.patch(`/api/inventory/purchase-orders/${editingPo.id}`, {
          supplierId: supplierId || undefined,
          orderNumber: orderNumber || undefined,
          items,
        }, { params: { businessId } });
      } else {
        await apiClient.post('/api/inventory/purchase-orders', {
          businessId,
          supplierId: supplierId || undefined,
          orderNumber: orderNumber || undefined,
          items,
        });
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save purchase order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="ring-white/50 glass-sheen-sm">
      <CardContent className="pt-6 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          {(editingPo?.status === 'received' || editingPo?.status === 'paid') && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-500/10 ring-1 ring-amber-500/20 rounded-xl px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              This order was already received{editingPo.status === 'paid' ? ' and paid' : ''} — changing quantities will adjust stock by the difference and log it in stock history.
            </div>
          )}

          {/* Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Supplier">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="h-10 rounded-xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 px-3 text-sm w-full"
              >
                <option value="">No supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Order number">
              <Input
                placeholder="Auto-generated if left blank"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
              />
            </Field>
          </div>

          {/* Line items — compact spreadsheet-style rows so ordering many
              items at once stays quick: every field lives in one row, columns
              line up naturally, and Enter on the last row adds the next one. */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Line items</div>
              <span className="text-[11px] text-slate-400">Press Enter in the last row to add another</span>
            </div>

            <div className="rounded-xl ring-1 ring-white/50 bg-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-500 bg-white/40 border-b border-white/50">
                      <th className="px-2 py-2 text-left w-6">#</th>
                      <th className="px-2 py-2 text-left min-w-[160px]">Product</th>
                      <th className="px-2 py-2 text-left w-20">Qty</th>
                      <th className="px-2 py-2 text-left w-24">Unit price</th>
                      <th className="px-2 py-2 text-left w-16">Tax %</th>
                      {fieldConfig.batchExpiry && <th className="px-2 py-2 text-left w-28">Batch</th>}
                      {fieldConfig.batchExpiry && <th className="px-2 py-2 text-left w-32">Expiry</th>}
                      {fieldConfig.schemeQuantity && <th className="px-2 py-2 text-left w-20">Scheme</th>}
                      <th className="px-2 py-2 text-right w-24">Subtotal</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/40">
                    {lines.map((line, index) => {
                      const subtotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                      return (
                        <tr key={index} className="hover:bg-white/30" onKeyDown={handleRowKeyDown(index)}>
                          <td className="px-2 py-1.5 text-slate-400">{index + 1}</td>
                          <td className="px-2 py-1.5">
                            <div className="relative">
                              <input
                                ref={(el) => { productRefs.current[index] = el; }}
                                list="po-product-options"
                                placeholder="Type or select product"
                                value={line.productName}
                                onChange={(e) => handleProductNameChange(index, e.target.value)}
                                onBlur={() => resolveOrCreateProduct(index)}
                                className={cellInput}
                                required
                              />
                              {creatingProductAt === index && (
                                <span className="absolute -bottom-4 left-0 text-[10px] text-emerald-600 whitespace-nowrap">Adding to Medicines…</span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              value={line.quantity}
                              onChange={(e) => updateLine(index, { quantity: e.target.value })}
                              className={cellInput}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              value={line.unitPrice}
                              onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                              className={cellInput}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              value={line.taxPercentage}
                              onChange={(e) => updateLine(index, { taxPercentage: e.target.value })}
                              className={cellInput}
                            />
                          </td>
                          {fieldConfig.batchExpiry && (
                            <td className="px-2 py-1.5">
                              <input
                                value={line.batchNumber}
                                onChange={(e) => updateLine(index, { batchNumber: e.target.value })}
                                className={cellInput}
                              />
                            </td>
                          )}
                          {fieldConfig.batchExpiry && (
                            <td className="px-2 py-1.5">
                              <input
                                type="date"
                                value={line.expiryDate}
                                onChange={(e) => updateLine(index, { expiryDate: e.target.value })}
                                className={cellInput}
                              />
                            </td>
                          )}
                          {fieldConfig.schemeQuantity && (
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                value={line.schemeQuantity}
                                onChange={(e) => updateLine(index, { schemeQuantity: e.target.value })}
                                className={cellInput}
                              />
                            </td>
                          )}
                          <td className="px-2 py-1.5 text-right font-semibold text-slate-700 whitespace-nowrap">
                            ₹{subtotal.toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                              disabled={lines.length === 1}
                              className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400"
                              aria-label="Remove line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <datalist id="po-product-options">
              {knownProducts.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>

            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-medium hover:text-emerald-800 bg-emerald-500/10 hover:bg-emerald-500/15 ring-1 ring-emerald-500/20 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add item
            </button>
          </div>

          {/* Totals footer */}
          <div className="flex items-center justify-end gap-6 pt-2 border-t border-white/40 text-sm">
            <span className="text-slate-500">Subtotal: <strong className="text-slate-700">₹{totals.subtotal.toFixed(2)}</strong></span>
            <span className="text-slate-500">Tax: <strong className="text-slate-700">₹{totals.tax.toFixed(2)}</strong></span>
            <span className="text-slate-800 font-semibold">Total: ₹{(totals.subtotal + totals.tax).toFixed(2)}</span>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingPo ? 'Save Changes' : 'Create Purchase Order'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
