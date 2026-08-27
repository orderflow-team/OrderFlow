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
  purchase_price?: string | number | null;
  tax_percentage?: string | number | null;
  hsn_code?: string | null;
}

export interface PoLine {
  id?: string;
  productId: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  taxPercentage: string;
  hsnCode: string;
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
    hsn_code?: string | null;
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
  hsnCode: '',
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

// Product name field with a custom suggestion dropdown rendered below the
// input — a native <datalist> looks and behaves inconsistently across
// browsers (especially on mobile, where many don't render it at all).
function ProductNameField({
  index,
  value,
  products,
  onNameChange,
  inputRef,
  className,
  creating,
}: {
  index: number;
  value: string;
  products: ProductOption[];
  onNameChange: (index: number, name: string) => void;
  inputRef?: (el: HTMLInputElement | null) => void;
  className: string;
  creating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const trimmed = value.trim().toLowerCase();
  const matches = trimmed ? products.filter((p) => p.name.toLowerCase().includes(trimmed)).slice(0, 8) : [];

  return (
    <div className="relative">
      <input
        ref={inputRef}
        placeholder="Type or select product"
        value={value}
        onChange={(e) => {
          onNameChange(index, e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // No create-on-blur here — a typed name that doesn't match anything
        // is only turned into a new product when the PO is actually submitted,
        // so abandoning or mistyping a row never leaves a stray draft product behind.
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className={className}
        required
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-48 overflow-y-auto rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onNameChange(index, p.name);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 truncate"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      {creating && (
        <span className="absolute -bottom-4 left-0 text-[10px] text-emerald-600 whitespace-nowrap">Adding to Medicines…</span>
      )}
    </div>
  );
}

function toLine(item: EditingPo['items'][number], products: ProductOption[]): PoLine {
  return {
    id: item.id,
    productId: item.product_id ?? '',
    productName: products.find((p) => p.id === item.product_id)?.name ?? '',
    quantity: String(item.quantity ?? ''),
    unitPrice: String(item.unit_price ?? ''),
    taxPercentage: item.tax_percentage != null ? String(item.tax_percentage) : '',
    hsnCode: item.hsn_code ?? '',
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
  initialLines,
  initialSupplierId,
  onSaved,
  onCancel,
  onProductCreated,
}: {
  businessId: string;
  suppliers: Supplier[];
  products: ProductOption[];
  fieldConfig: PoFieldConfig;
  editingPo: EditingPo | null;
  // Prefills a brand-new (unsaved) PO's lines/supplier — e.g. "Create purchase
  // order" from the Low Stock list. Ignored once editingPo is set, since an
  // existing order's own items always take precedence.
  initialLines?: PoLine[];
  initialSupplierId?: string;
  onSaved: () => void;
  onCancel: () => void;
  onProductCreated?: (product: { id: string; name: string; purchasePrice?: number; taxPercentage?: number; hsnCode?: string }) => void;
}) {
  const [supplierId, setSupplierId] = useState(editingPo?.supplier_id ?? initialSupplierId ?? '');
  const [orderNumber, setOrderNumber] = useState(editingPo?.order_number ?? '');
  const [lines, setLines] = useState<PoLine[]>(
    editingPo && editingPo.items.length > 0
      ? editingPo.items.map((item) => toLine(item, products))
      : initialLines && initialLines.length > 0
      ? initialLines
      : [emptyLine()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [creatingProductAt, setCreatingProductAt] = useState<number | null>(null);
  const focusNextRow = useRef(false);
  const productRefs = useRef<(HTMLInputElement | null)[]>([]);
  // Product ids created by resolveOrCreateProduct at submit time, seeded with
  // whatever price/tax was in the line at that instant — kept around so a
  // subsequent edit to the same line's price before the request resolves
  // still gets synced onto the product record (see the sync loop in handleSubmit).
  const createdThisSession = useRef<Set<string>>(new Set());
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
    setSupplierId(editingPo?.supplier_id ?? initialSupplierId ?? '');
    setOrderNumber(editingPo?.order_number ?? '');
    setLines(
      editingPo && editingPo.items.length > 0
        ? editingPo.items.map((item) => toLine(item, products))
        : initialLines && initialLines.length > 0
        ? initialLines
        : [emptyLine()],
    );
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

  // Prefills a line's cost/tax from the catalog the moment its product name
  // resolves to a known product — otherwise every line defaults to ₹0 unit
  // price even when restocking something already carried, forcing a manual
  // re-type of a cost the system already knows.
  const priceFieldsFor = (match: ProductOption): Partial<PoLine> => {
    const patch: Partial<PoLine> = {};
    const purchasePrice = Number(match.purchase_price);
    if (purchasePrice > 0) patch.unitPrice = String(purchasePrice);
    if (match.tax_percentage != null && match.tax_percentage !== '') patch.taxPercentage = String(Number(match.tax_percentage));
    if (match.hsn_code) patch.hsnCode = match.hsn_code;
    return patch;
  };

  const handleProductNameChange = (index: number, name: string) => {
    const match = findByName(name);
    updateLine(index, {
      productName: name,
      productId: match ? match.id : '',
      ...(match ? priceFieldsFor(match) : {}),
    });
  };

  // Guards against the same row resolving twice concurrently (e.g. a
  // double-click on submit) and creating two duplicate draft products for one
  // typed name.
  const resolvingRef = useRef<Map<number, Promise<string>>>(new Map());

  // Resolves the row's typed name to an existing product, or — if nothing
  // matches — creates a new draft product (unit price seeded from whatever
  // cost was entered on the line). Only runs at submit time, so a line
  // that's typed into and then abandoned never leaves a stray draft product behind.
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
        updateLine(index, { productId: match.id, ...priceFieldsFor(match) });
        return match.id;
      }

      setCreatingProductAt(index);
      try {
        const purchasePrice = Number(line.unitPrice) || 0;
        const taxPercentage = line.taxPercentage ? Number(line.taxPercentage) : undefined;
        const hsnCode = line.hsnCode || undefined;
        const res = await apiClient.post('/api/products', {
          businessId,
          name: trimmed,
          sellingPrice: purchasePrice,
          purchasePrice: line.unitPrice ? purchasePrice : undefined,
          taxPercentage,
          hsnCode,
          isDraft: true,
        });
        const created: ProductOption = { id: res.data.id, name: res.data.name, purchase_price: purchasePrice, tax_percentage: taxPercentage, hsn_code: hsnCode };
        createdThisSession.current.add(created.id);
        setKnownProducts((prev) => [...prev, created]);
        updateLine(index, { productId: created.id });
        onProductCreated?.({ id: created.id, name: created.name, purchasePrice, taxPercentage, hsnCode });
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

    // A product created earlier in this session (on the product-name field's
    // blur) was seeded with whatever price existed at that instant — usually
    // ₹0, since the price cell is filled in afterward. Catch it up to the
    // line's final price/tax now, before the price is lost as "just the PO
    // line's number" with no trace back on the product record itself.
    await Promise.all(
      lines.map((l, i) => {
        const productId = resolvedIds[i] || l.productId;
        if (!productId || !createdThisSession.current.has(productId)) return Promise.resolve();
        const purchasePrice = Number(l.unitPrice) || 0;
        const taxPercentage = l.taxPercentage ? Number(l.taxPercentage) : undefined;
        const hsnCode = l.hsnCode || undefined;
        return apiClient
          .patch(`/api/products/${productId}`, { purchasePrice, sellingPrice: purchasePrice, taxPercentage, hsnCode }, { params: { businessId } })
          .catch((err) => console.error('[purchase order] failed to sync new product price', err));
      }),
    );

    const items = lines.map((l, i) => ({
      ...(l.id ? { id: l.id } : {}),
      productId: resolvedIds[i] || l.productId,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      taxPercentage: l.taxPercentage ? Number(l.taxPercentage) : undefined,
      hsnCode: l.hsnCode || undefined,
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

            {/* Mobile: one card per line item — the table's columns are too
                narrow to be usable below sm, so line items stack instead. */}
            <div className="sm:hidden space-y-2">
              {lines.map((line, index) => {
                const subtotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                return (
                  <div key={index} className="rounded-xl ring-1 ring-white/50 bg-white/30 p-3 space-y-2.5" onKeyDown={handleRowKeyDown(index)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-400">#{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                        disabled={lines.length === 1}
                        className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400"
                        aria-label="Remove line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <ProductNameField
                      index={index}
                      value={line.productName}
                      products={knownProducts}
                      onNameChange={handleProductNameChange}
                      className={`${cellInput} h-9`}
                      creating={creatingProductAt === index}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Qty">
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, { quantity: e.target.value })}
                          className={`${cellInput} h-9`}
                        />
                      </Field>
                      <Field label="Unit price">
                        <input
                          type="number"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                          className={`${cellInput} h-9`}
                        />
                      </Field>
                      <Field label="Tax %">
                        <input
                          type="number"
                          value={line.taxPercentage}
                          onChange={(e) => updateLine(index, { taxPercentage: e.target.value })}
                          className={`${cellInput} h-9`}
                        />
                      </Field>
                    </div>
                    <Field label="HSN Code">
                      <input
                        value={line.hsnCode}
                        onChange={(e) => updateLine(index, { hsnCode: e.target.value })}
                        placeholder="e.g. 3004"
                        className={`${cellInput} h-9`}
                      />
                    </Field>
                    {(fieldConfig.batchExpiry || fieldConfig.schemeQuantity) && (
                      <div className="grid grid-cols-3 gap-2">
                        {fieldConfig.batchExpiry && (
                          <Field label="Batch" className="col-span-1">
                            <input
                              value={line.batchNumber}
                              onChange={(e) => updateLine(index, { batchNumber: e.target.value })}
                              className={`${cellInput} h-9`}
                            />
                          </Field>
                        )}
                        {fieldConfig.batchExpiry && (
                          <Field label="Expiry" className="col-span-1">
                            <input
                              type="date"
                              value={line.expiryDate}
                              onChange={(e) => updateLine(index, { expiryDate: e.target.value })}
                              className={`${cellInput} h-9`}
                            />
                          </Field>
                        )}
                        {fieldConfig.schemeQuantity && (
                          <Field label="Scheme" className="col-span-1">
                            <input
                              type="number"
                              value={line.schemeQuantity}
                              onChange={(e) => updateLine(index, { schemeQuantity: e.target.value })}
                              className={`${cellInput} h-9`}
                            />
                          </Field>
                        )}
                      </div>
                    )}
                    <div className="text-right text-xs font-semibold text-slate-700 pt-1 border-t border-white/40">
                      Subtotal: ₹{subtotal.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden sm:block rounded-xl ring-1 ring-white/50 bg-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-500 bg-white/40 border-b border-white/50">
                      <th className="px-2 py-2 text-left w-6">#</th>
                      <th className="px-2 py-2 text-left min-w-[160px]">Product</th>
                      <th className="px-2 py-2 text-left w-20">Qty</th>
                      <th className="px-2 py-2 text-left w-24">Unit price</th>
                      <th className="px-2 py-2 text-left w-16">Tax %</th>
                      <th className="px-2 py-2 text-left w-20">HSN</th>
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
                            <ProductNameField
                              index={index}
                              value={line.productName}
                              products={knownProducts}
                              onNameChange={handleProductNameChange}
                              inputRef={(el) => { productRefs.current[index] = el; }}
                              className={cellInput}
                              creating={creatingProductAt === index}
                            />
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
                          <td className="px-2 py-1.5">
                            <input
                              value={line.hsnCode}
                              onChange={(e) => updateLine(index, { hsnCode: e.target.value })}
                              placeholder="3004"
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
