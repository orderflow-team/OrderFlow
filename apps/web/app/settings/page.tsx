'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { AlertTriangle, Trash2, ImageUp } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  grocery: 'Grocery Store',
  restaurant: 'Restaurant',
  pharmacy: 'Pharmacy',
  wholesale: 'Wholesale',
  salesman: 'Salesman Order Collection',
  others: 'Others',
};

interface BusinessProfile {
  name: string;
  category: string | null;
  phone: string | null;
  address: string | null;
  gst_number: string | null;
  drug_license_number_1: string | null;
  drug_license_number_2: string | null;
  logo_url: string | null;
  inventory_enabled: boolean;
  ai_chat_enabled: boolean;
}

export default function SettingsPage() {
  const { businessId, ready } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: 'others',
    phone: '',
    address: '',
    gstNumber: '',
    drugLicenseNumber1: '',
    drugLicenseNumber2: '',
    logoUrl: '',
    inventoryEnabled: true,
    aiChatEnabled: true,
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');

  useEffect(() => {
    if (!ready || !businessId) return;
    apiClient
      .get<BusinessProfile>(`/api/businesses/${businessId}`)
      .then((res) => {
        setForm({
          name: res.data.name || '',
          category: res.data.category || 'others',
          phone: res.data.phone || '',
          address: res.data.address || '',
          gstNumber: res.data.gst_number || '',
          drugLicenseNumber1: res.data.drug_license_number_1 || '',
          drugLicenseNumber2: res.data.drug_license_number_2 || '',
          logoUrl: res.data.logo_url || '',
          inventoryEnabled: res.data.inventory_enabled,
          aiChatEnabled: res.data.ai_chat_enabled !== false,
        });
      })
      .catch((err: any) => setError(err.response?.data?.message || 'Failed to load business settings'))
      .finally(() => setLoading(false));
  }, [ready, businessId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await apiClient.patch(`/api/businesses/${businessId}`, {
        name: form.name,
        category: form.category,
        phone: form.phone || undefined,
        address: form.address || undefined,
        gstNumber: form.gstNumber || undefined,
        drugLicenseNumber1: form.drugLicenseNumber1 || undefined,
        drugLicenseNumber2: form.drugLicenseNumber2 || undefined,
        inventoryEnabled: form.inventoryEnabled,
        aiChatEnabled: form.aiChatEnabled,
      });
      // Nav visibility (Inventory link, dashboard widgets) is cached client-side —
      // reload so AppShell re-fetches and picks up the change immediately.
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save settings');
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !businessId) return;

    setLogoUploading(true);
    setLogoError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post<BusinessProfile>(`/api/businesses/${businessId}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((prev) => ({ ...prev, logoUrl: res.data.logo_url || '' }));
      // AppShell's business fetch is cached client-side — reload so the sidebar logo updates immediately.
      window.location.reload();
    } catch (err: any) {
      setLogoError(err.response?.data?.message || 'Failed to upload logo');
      setLogoUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!businessId) return;
    setLogoUploading(true);
    setLogoError('');
    try {
      await apiClient.delete(`/api/businesses/${businessId}/logo`);
      setForm((prev) => ({ ...prev, logoUrl: '' }));
      window.location.reload();
    } catch (err: any) {
      setLogoError(err.response?.data?.message || 'Failed to remove logo');
      setLogoUploading(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!businessId) return;
    setDeletingAll(true);
    setDeleteAllError('');
    try {
      await apiClient.delete('/api/dev/clear-all', { params: { businessId } });
      window.location.href = '/dashboard';
    } catch (err: any) {
      setDeleteAllError(err.response?.data?.message || 'Failed to delete data');
      setDeletingAll(false);
    }
  };

  if (!ready) return null;

  return (
    <>
    <AppShell>
      <div className="p-6 md:p-10 max-w-2xl lg:max-w-5xl mx-auto">
      <div className="lg:flex lg:gap-6 lg:items-start">
      <div className="lg:flex-1 lg:min-w-0 space-y-8">
        <PageHeader title="Settings" description="Manage your business profile and modules." />

        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <CardTitle className="text-base">Business profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Logo</label>
                  <p className="text-xs text-slate-500 mb-2">Shown on invoices and PDFs. PNG, JPG, WEBP or GIF up to 5MB.</p>
                  <div className="flex items-center gap-4">
                    {form.logoUrl ? (
                      <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-white/35 backdrop-blur-md ring-1 ring-white/50 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={form.logoUrl} alt="Business logo" className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={handleLogoRemove}
                          disabled={logoUploading}
                          className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 shadow-md transition-colors disabled:opacity-50"
                          title="Remove logo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-white/60 bg-white/25 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer hover:bg-white/35 transition-colors">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleLogoUpload}
                          disabled={logoUploading}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <ImageUp className="w-5 h-5 text-slate-400 mb-1" />
                        <span className="text-[10px] font-medium text-slate-500">
                          {logoUploading ? 'Uploading...' : 'Upload'}
                        </span>
                      </label>
                    )}
                    {logoError && <p className="text-xs text-rose-600 font-medium">{logoError}</p>}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Business name</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full h-11 rounded-full border border-transparent bg-white/35 backdrop-blur-md px-4 text-sm ring-1 ring-white/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_3px_rgba(148,163,184,0.2)] focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">Phone</label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">GST number</label>
                    <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Address</label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                {form.category === 'pharmacy' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1.5 block">Drug License No. 1</label>
                      <Input value={form.drugLicenseNumber1} onChange={(e) => setForm({ ...form, drugLicenseNumber1: e.target.value })} placeholder="e.g. Retail" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1.5 block">Drug License No. 2</label>
                      <Input value={form.drugLicenseNumber2} onChange={(e) => setForm({ ...form, drugLicenseNumber2: e.target.value })} placeholder="e.g. Wholesale" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <CardTitle className="text-base">Modules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-center gap-2.5 px-4 py-3 bg-white/35 backdrop-blur-md rounded-2xl border border-transparent ring-1 ring-white/50 cursor-pointer hover:bg-white/45 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.inventoryEnabled}
                    onChange={(e) => setForm({ ...form, inventoryEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Enable Inventory module
                    <span className="block text-xs font-normal text-slate-500">
                      Track stock, purchase orders, and low-stock alerts. Turning this off hides the Inventory tab and dashboard stock widgets.
                    </span>
                  </span>
                </label>

                <label className="flex items-center gap-2.5 px-4 py-3 bg-white/35 backdrop-blur-md rounded-2xl border border-transparent ring-1 ring-white/50 cursor-pointer hover:bg-white/45 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.aiChatEnabled}
                    onChange={(e) => setForm({ ...form, aiChatEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Enable AI Chat Assistant
                    <span className="block text-xs font-normal text-slate-500">
                      Show floating AI assistant widget to place orders via speech and chat commands instantly.
                    </span>
                  </span>
                </label>
              </CardContent>
            </Card>

            {error && <p className="text-sm text-rose-600">{error}</p>}
            {saved && <p className="text-sm text-emerald-600">Saved.</p>}

            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        )}

        {!loading && (
          <Card className="ring-rose-500/30 border border-rose-500/20 bg-rose-500/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-rose-700">
                <AlertTriangle className="w-4 h-4" /> Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                Permanently delete every customer, product, order, invoice, table, salesman, and supplier in
                this business. This cannot be undone. The business itself and your login are not deleted.
              </p>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setDeleteConfirmText('');
                  setDeleteAllError('');
                  setShowDeleteAllConfirm(true);
                }}
              >
                Delete All Data
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Rail — desktop-only live invoice header preview */}
      <aside className="hidden lg:block w-72 shrink-0 space-y-4 sticky top-10 self-start">
        <div className="bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Invoice preview</h3>
          <div className="bg-white rounded-xl ring-1 ring-slate-100 p-4 space-y-3">
            <div className="flex items-center gap-3">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-contain bg-slate-50 ring-1 ring-slate-100" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                  <ImageUp className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">{form.name || 'Your business name'}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                  {CATEGORY_LABELS[form.category] || form.category}
                </p>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 space-y-0.5 pt-2 border-t border-slate-100">
              {form.address && <p className="truncate">{form.address}</p>}
              {form.phone && <p>Ph: {form.phone}</p>}
              {form.gstNumber && <p>GST: {form.gstNumber}</p>}
              {form.drugLicenseNumber1 && <p>DL1: {form.drugLicenseNumber1}</p>}
              {form.drugLicenseNumber2 && <p>DL2: {form.drugLicenseNumber2}</p>}
              {!form.address && !form.phone && !form.gstNumber && !form.drugLicenseNumber1 && !form.drugLicenseNumber2 && (
                <p className="text-slate-300 italic">Fill in details to see them here</p>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-400">This is how your business header appears on invoices and PDFs.</p>
        </div>
      </aside>
      </div>
      </div>
    </AppShell>

    <Dialog open={showDeleteAllConfirm} onOpenChange={(open) => !deletingAll && setShowDeleteAllConfirm(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="w-4 h-4" /> Delete all data in {form.name || 'this business'}?
          </DialogTitle>
          <DialogDescription>
            This permanently deletes every customer, product, order, invoice, table, salesman, and supplier
            in this business. It cannot be undone. Type <strong>{form.name}</strong> below to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder={form.name}
          autoFocus
        />
        {deleteAllError && <p className="text-sm text-rose-600">{deleteAllError}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setShowDeleteAllConfirm(false)} disabled={deletingAll}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteAllData}
            disabled={deletingAll || deleteConfirmText !== form.name}
          >
            {deletingAll ? 'Deleting...' : 'Delete Everything'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
