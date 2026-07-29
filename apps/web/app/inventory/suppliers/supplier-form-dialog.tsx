'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  alternate_phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gst_number: string | null;
  pan_number: string | null;
  drug_license_number: string | null;
  supplier_type: string | null;
  payment_terms: string | null;
  credit_limit: string | number;
  trade_discount_percentage: string | number;
  bank_details: { accountName?: string; accountNumber?: string; ifsc?: string; bankName?: string } | null;
  is_active: boolean;
  notes: string | null;
}

const emptyForm = {
  name: '',
  contactPerson: '',
  phone: '',
  alternatePhone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  gstNumber: '',
  panNumber: '',
  drugLicenseNumber: '',
  supplierType: '',
  paymentTerms: 'due_on_receipt',
  creditLimit: '',
  tradeDiscountPercentage: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankName: '',
  isActive: true,
  notes: '',
};

function toForm(s: Supplier): typeof emptyForm {
  return {
    name: s.name,
    contactPerson: s.contact_person || '',
    phone: s.phone || '',
    alternatePhone: s.alternate_phone || '',
    email: s.email || '',
    address: s.address || '',
    city: s.city || '',
    state: s.state || '',
    pincode: s.pincode || '',
    gstNumber: s.gst_number || '',
    panNumber: s.pan_number || '',
    drugLicenseNumber: s.drug_license_number || '',
    supplierType: s.supplier_type || '',
    paymentTerms: s.payment_terms || 'due_on_receipt',
    creditLimit: s.credit_limit != null ? String(s.credit_limit) : '',
    tradeDiscountPercentage: s.trade_discount_percentage != null ? String(s.trade_discount_percentage) : '',
    bankAccountName: s.bank_details?.accountName || '',
    bankAccountNumber: s.bank_details?.accountNumber || '',
    bankIfsc: s.bank_details?.ifsc || '',
    bankName: s.bank_details?.bankName || '',
    isActive: s.is_active,
    notes: s.notes || '',
  };
}

export function SupplierFormDialog({
  businessId,
  open,
  onOpenChange,
  editingSupplier,
  onSaved,
}: {
  businessId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSupplier: Supplier | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(editingSupplier ? toForm(editingSupplier) : emptyForm);
    setError('');
  }, [editingSupplier, open]);

  const set = (patch: Partial<typeof emptyForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const bankDetails =
      form.bankAccountName || form.bankAccountNumber || form.bankIfsc || form.bankName
        ? {
            accountName: form.bankAccountName || undefined,
            accountNumber: form.bankAccountNumber || undefined,
            ifsc: form.bankIfsc || undefined,
            bankName: form.bankName || undefined,
          }
        : undefined;
    const payload = {
      name: form.name,
      contactPerson: form.contactPerson || undefined,
      phone: form.phone || undefined,
      alternatePhone: form.alternatePhone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      pincode: form.pincode || undefined,
      gstNumber: form.gstNumber || undefined,
      panNumber: form.panNumber || undefined,
      drugLicenseNumber: form.drugLicenseNumber || undefined,
      supplierType: form.supplierType || undefined,
      paymentTerms: form.paymentTerms || undefined,
      creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
      tradeDiscountPercentage: form.tradeDiscountPercentage ? Number(form.tradeDiscountPercentage) : undefined,
      bankDetails,
      isActive: form.isActive,
      notes: form.notes || undefined,
    };
    try {
      if (editingSupplier) {
        await apiClient.patch(`/api/suppliers/${editingSupplier.id}`, payload, { params: { businessId } });
      } else {
        await apiClient.post('/api/suppliers', { businessId, ...payload });
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-6 max-h-[85vh] overflow-y-auto scrollbar-subtle">
        <DialogHeader>
          <DialogTitle className="text-xl">{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Identity &amp; Contact</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="Supplier / company name" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
              <Input placeholder="Contact person" value={form.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} />
              <Input placeholder="Phone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              <Input placeholder="Alternate phone" value={form.alternatePhone} onChange={(e) => set({ alternatePhone: e.target.value })} />
              <Input placeholder="Email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
              <select
                value={form.supplierType}
                onChange={(e) => set({ supplierType: e.target.value })}
                className="h-10 rounded-xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 px-3 text-sm w-full"
              >
                <option value="">Supplier type (optional)</option>
                <option value="distributor">Distributor</option>
                <option value="manufacturer">Manufacturer</option>
                <option value="wholesaler">Wholesaler</option>
                <option value="local_vendor">Local Vendor</option>
              </select>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Address</h3>
            <div className="grid grid-cols-1 gap-3">
              <Input placeholder="Address" value={form.address} onChange={(e) => set({ address: e.target.value })} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input placeholder="City" value={form.city} onChange={(e) => set({ city: e.target.value })} />
                <Input placeholder="State" value={form.state} onChange={(e) => set({ state: e.target.value })} />
                <Input placeholder="Pincode" value={form.pincode} onChange={(e) => set({ pincode: e.target.value })} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Compliance &amp; Tax</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input placeholder="GST number" value={form.gstNumber} onChange={(e) => set({ gstNumber: e.target.value })} />
              <Input placeholder="PAN number" value={form.panNumber} onChange={(e) => set({ panNumber: e.target.value })} />
              <Input placeholder="Drug license number" value={form.drugLicenseNumber} onChange={(e) => set({ drugLicenseNumber: e.target.value })} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Commercial Terms</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={form.paymentTerms}
                onChange={(e) => set({ paymentTerms: e.target.value })}
                className="h-10 rounded-xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 px-3 text-sm w-full"
              >
                <option value="due_on_receipt">Due on receipt</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_45">Net 45</option>
                <option value="net_60">Net 60</option>
              </select>
              <Input placeholder="Credit limit (₹)" type="number" value={form.creditLimit} onChange={(e) => set({ creditLimit: e.target.value })} />
              <Input placeholder="Trade discount %" type="number" value={form.tradeDiscountPercentage} onChange={(e) => set({ tradeDiscountPercentage: e.target.value })} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Banking (optional)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="Account holder name" value={form.bankAccountName} onChange={(e) => set({ bankAccountName: e.target.value })} />
              <Input placeholder="Bank name" value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} />
              <Input placeholder="Account number" value={form.bankAccountNumber} onChange={(e) => set({ bankAccountNumber: e.target.value })} />
              <Input placeholder="IFSC" value={form.bankIfsc} onChange={(e) => set({ bankIfsc: e.target.value })} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Notes</h3>
            <textarea
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Any other notes about this supplier..."
              rows={2}
              className="w-full rounded-xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
              Active (visible when choosing a supplier for a purchase order)
            </label>
          </section>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editingSupplier ? 'Save Changes' : 'Add Supplier'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
