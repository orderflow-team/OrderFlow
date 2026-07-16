'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { ScanLine, UploadCloud, FileText, CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
}

interface ScanItem {
  id: string;
  raw_product_name: string;
  matched_product_id: string | null;
  matched_product?: { id: string; name: string; stock_quantity: number } | null;
  is_duplicate: boolean;
  included: boolean;
  quantity: string | number;
  scheme_quantity: string | number | null;
  unit_price: string | number | null;
  mrp: string | number | null;
  batch_number: string | null;
  expiry_month_year: string | null;
}

interface ScanResult {
  id: string;
  file_url: string;
  file_type: string;
  status: string;
  items: ScanItem[];
}

type Step = 'upload' | 'processing' | 'verify' | 'success';

export function ScanToInventoryDialog({
  businessId,
  suppliers,
  onConfirmed,
}: {
  businessId: string;
  suppliers: Supplier[];
  onConfirmed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [items, setItems] = useState<ScanItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setError('');
    setScan(null);
    setItems([]);
    setSupplierId('');
    setDragOver(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const handleFile = async (file: File) => {
    setError('');
    setStep('processing');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiClient.post<ScanResult>('/api/invoice-scans/upload', formData, {
        params: { businessId, supplierId: supplierId || undefined },
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setScan(res.data);
      setItems(res.data.items);
      setStep('verify');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not read this invoice. Try a clearer photo.');
      setStep('upload');
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const updateItem = (id: string, patch: Partial<ScanItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const includedCount = items.filter((i) => i.included).length;

  const handleConfirm = async () => {
    if (!scan) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post(`/api/invoice-scans/${scan.id}/confirm`, {
        businessId,
        supplierId: supplierId || undefined,
        items: items.map((it) => ({
          id: it.id,
          included: it.included,
          productName: it.raw_product_name,
          matchedProductId: it.matched_product_id || undefined,
          quantity: Number(it.quantity) || 0,
          schemeQuantity: it.scheme_quantity !== null && it.scheme_quantity !== '' ? Number(it.scheme_quantity) : undefined,
          unitPrice: it.unit_price !== null && it.unit_price !== '' ? Number(it.unit_price) : undefined,
          mrp: it.mrp !== null && it.mrp !== '' ? Number(it.mrp) : undefined,
          batchNumber: it.batch_number || undefined,
          expiryMonthYear: it.expiry_month_year || undefined,
        })),
      });
      setAddedCount(includedCount);
      setStep('success');
      onConfirmed();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to confirm inventory update.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <ScanLine className="w-4 h-4" /> Scan Invoice
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={step === 'verify' ? 'sm:max-w-5xl p-6 max-h-[85vh] overflow-hidden flex flex-col' : 'sm:max-w-md p-6'}
          showCloseButton={step !== 'processing'}
        >
          {step === 'upload' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Scan-to-Inventory</DialogTitle>
                <p className="text-sm text-slate-500">
                  Upload a photo or PDF of a distributor invoice — we&apos;ll read the products, quantities, batches, and
                  expiry dates for you.
                </p>
              </DialogHeader>

              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="h-10 rounded-xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 px-3 text-sm w-full"
              >
                <option value="">No supplier (optional)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 rounded-2xl ring-1 ring-white/50 bg-white/30 backdrop-blur-sm py-12 px-6 cursor-pointer transition-colors ${dragOver ? 'bg-emerald-50/60 ring-emerald-300' : 'hover:bg-white/40'}`}
              >
                <div className="w-16 h-16 rounded-full bg-white/50 ring-1 ring-white/60 flex items-center justify-center">
                  <UploadCloud className="w-7 h-7 text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-slate-700">Drag & drop, or click to upload</p>
                <p className="text-xs text-slate-400">JPEG, PNG, WEBP, or PDF — up to 15MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={onFileInputChange}
                />
              </div>

              {error && (
                <p className="text-sm text-rose-600 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {error}</p>
              )}
            </>
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center gap-5 py-14">
              <div className="relative w-28 h-36 rounded-xl bg-white/60 ring-1 ring-white/70 overflow-hidden glass-sheen-sm">
                <FileText className="w-full h-full p-6 text-slate-300" />
                <div className="scan-beam absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_2px_rgba(16,185,129,0.6)]" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-slate-800">Reading your invoice…</p>
                <p className="text-sm text-slate-500 mt-1">Extracting products, quantities, batches, and expiry dates</p>
              </div>
            </div>
          )}

          {step === 'verify' && scan && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">Verify extracted items</DialogTitle>
                <p className="text-sm text-slate-500">
                  Items already in your inventory are unchecked by default to avoid duplicates. Review, edit, then confirm.
                </p>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
                <div className="rounded-2xl ring-1 ring-white/50 bg-white/20 overflow-hidden flex items-center justify-center">
                  {scan.file_type === 'pdf' ? (
                    <embed src={scan.file_url} type="application/pdf" className="w-full h-full min-h-[300px]" />
                  ) : (
                    <img src={scan.file_url} alt="Uploaded invoice" className="w-full h-full object-contain max-h-[60vh]" />
                  )}
                </div>

                <div className="overflow-auto scrollbar-subtle rounded-2xl ring-1 ring-white/50 bg-white/20">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] text-slate-500 uppercase bg-white/40 sticky top-0 backdrop-blur-sm">
                      <tr>
                        <th className="px-2 py-2 w-8"></th>
                        <th className="px-2 py-2">Product</th>
                        <th className="px-2 py-2 w-16">Qty</th>
                        <th className="px-2 py-2 w-16">Scheme</th>
                        <th className="px-2 py-2 w-20">Rate (cost)</th>
                        <th className="px-2 py-2 w-20">MRP (sale)</th>
                        <th className="px-2 py-2 w-24">Batch</th>
                        <th className="px-2 py-2 w-20">Expiry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item) => (
                        <tr key={item.id} className={item.is_duplicate && !item.included ? 'opacity-50' : ''}>
                          <td className="px-2 py-1.5 align-top">
                            <input
                              type="checkbox"
                              checked={item.included}
                              onChange={(e) => updateItem(item.id, { included: e.target.checked })}
                              className="mt-1"
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <Input
                              value={item.raw_product_name}
                              onChange={(e) => updateItem(item.id, { raw_product_name: e.target.value })}
                              className="h-7 rounded-lg text-xs px-2 w-full min-w-[140px]"
                            />
                            {item.is_duplicate && (
                              <span className="mt-1 inline-block text-[10px] text-amber-600 font-medium">
                                Already in inventory{item.matched_product ? ` (${item.matched_product.name})` : ''}
                                {item.matched_product && item.matched_product.stock_quantity <= 0 ? ' - Out of stock' : ''}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                              className="h-7 rounded-lg text-xs px-2 w-16"
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <Input
                              type="number"
                              value={item.scheme_quantity ?? ''}
                              onChange={(e) => updateItem(item.id, { scheme_quantity: e.target.value })}
                              className="h-7 rounded-lg text-xs px-2 w-16"
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <Input
                              type="number"
                              value={item.unit_price ?? ''}
                              onChange={(e) => updateItem(item.id, { unit_price: e.target.value })}
                              className="h-7 rounded-lg text-xs px-2 w-20"
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <Input
                              type="number"
                              value={item.mrp ?? ''}
                              onChange={(e) => updateItem(item.id, { mrp: e.target.value })}
                              className="h-7 rounded-lg text-xs px-2 w-20"
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <Input
                              value={item.batch_number ?? ''}
                              onChange={(e) => updateItem(item.id, { batch_number: e.target.value })}
                              className="h-7 rounded-lg text-xs px-2 w-24"
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <Input
                              placeholder="MM/YYYY"
                              value={item.expiry_month_year ?? ''}
                              onChange={(e) => updateItem(item.id, { expiry_month_year: e.target.value })}
                              className="h-7 rounded-lg text-xs px-2 w-20"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && (
                <p className="text-sm text-rose-600 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {error}</p>
              )}

              <DialogFooter className="items-center">
                <span className="text-xs text-slate-500 sm:mr-auto">{includedCount} of {items.length} items selected</span>
                <Button variant="outline" onClick={() => reset()}>
                  <X className="w-4 h-4" /> Start over
                </Button>
                <Button onClick={handleConfirm} disabled={saving || includedCount === 0}>
                  {saving ? 'Adding to inventory…' : `Confirm & Add ${includedCount} Item${includedCount === 1 ? '' : 's'}`}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center gap-4 py-14">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center animate-in zoom-in-50 duration-300">
                <CheckCircle2 className="w-11 h-11 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-800">Inventory updated!</p>
                <p className="text-sm text-slate-500 mt-1">{addedCount} item{addedCount === 1 ? '' : 's'} added to stock.</p>
              </div>
              <Button onClick={() => handleOpenChange(false)} className="px-8">Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
