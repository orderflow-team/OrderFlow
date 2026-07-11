'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';

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
  inventory_enabled: boolean;
  ai_chat_enabled: boolean;
}

export default function SettingsPage() {
  const { businessId, ready } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'others',
    phone: '',
    address: '',
    gstNumber: '',
    inventoryEnabled: true,
    aiChatEnabled: true,
  });

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

  if (!ready) return null;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-2xl mx-auto space-y-8">
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
      </div>
    </AppShell>
  );
}
