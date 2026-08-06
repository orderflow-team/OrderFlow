'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { ScanBarcode } from 'lucide-react';

interface CreatedProduct {
  id: string;
  name: string;
  selling_price: string | number;
  category: string | null;
  is_available: boolean;
  barcode?: string | null;
  sku?: string | null;
}

interface QuickAddProductDialogProps {
  open: boolean;
  barcode: string;
  businessId: string;
  onClose: () => void;
  onCreated: (product: CreatedProduct) => void;
}

/**
 * Minimal "unrecognized barcode" fallback: name + price only, so scanning
 * stays seamless instead of dead-ending when a product doesn't exist yet.
 * Everything else (unit, category, stock) takes the API's own sensible
 * defaults and can be filled in later from the Products page.
 */
export function QuickAddProductDialog({ open, barcode, businessId, onClose, onCreated }: QuickAddProductDialogProps) {
  const [name, setName] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setSellingPrice('');
    setError('');
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sellingPrice) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.post<CreatedProduct>('/api/products', {
        businessId,
        name: name.trim(),
        sellingPrice: Number(sellingPrice),
        barcode,
      });
      onCreated(res.data);
      reset();
    } catch (err) {
      console.error(err);
      setError('Could not save this product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-[400px] p-6">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl">New Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ScanBarcode className="w-3.5 h-3.5" /> Scanned barcode: {barcode}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Product Name</label>
            <Input
              className="h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Parle-G Gold 100g"
              autoFocus
              required
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Selling Price</label>
            <Input
              className="h-11"
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="0.00"
              required
              disabled={saving}
            />
          </div>
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/40">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim() || !sellingPrice}>
              {saving ? 'Adding…' : 'Add & Continue Scanning'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
