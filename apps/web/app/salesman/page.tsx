'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { ClearModuleButton } from '@/components/clear-module-button';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { Plus, X, MapPin, UserRound } from 'lucide-react';

interface Salesman {
  id: string;
  name: string;
  phone: string | null;
  route: string | null;
}

interface Customer {
  id: string;
  name: string;
}

interface Visit {
  id: string;
  customer_id: string | null;
  check_in_time: string;
  check_out_time: string | null;
  gps_location: string | null;
}

export default function SalesmanPage() {
  const { businessId, ready } = useBusiness();
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [visits, setVisits] = useState<Record<string, Visit[]>>({});
  const [selectedSalesman, setSelectedSalesman] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', route: '' });
  const [visitCustomerId, setVisitCustomerId] = useState('');
  const [gps, setGps] = useState('');

  const load = async (bizId: string) => {
    setLoading(true);
    try {
      const [salesmenRes, customersRes] = await Promise.all([
        apiClient.get<Salesman[]>('/api/salesman', { params: { businessId: bizId } }),
        apiClient.get<Customer[]>('/api/customers', { params: { businessId: bizId } }),
      ]);
      setSalesmen(salesmenRes.data);
      setCustomers(customersRes.data);
      if (salesmenRes.data.length && !selectedSalesman) {
        setSelectedSalesman(salesmenRes.data[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load salesman data');
    } finally {
      setLoading(false);
    }
  };

  const loadVisits = async (salesmanId: string) => {
    const res = await apiClient.get<Visit[]>(`/api/salesman/${salesmanId}/visits`);
    setVisits((prev) => ({ ...prev, [salesmanId]: res.data }));
  };

  useEffect(() => {
    if (ready && businessId) load(businessId);
  }, [ready, businessId]);

  useEffect(() => {
    if (selectedSalesman) loadVisits(selectedSalesman);
  }, [selectedSalesman]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    try {
      await apiClient.post('/api/salesman', { businessId, name: form.name, phone: form.phone || undefined, route: form.route || undefined });
      setForm({ name: '', phone: '', route: '' });
      setShowForm(false);
      load(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create salesman');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalesman) return;
    await apiClient.post('/api/salesman/visits/check-in', {
      salesmanId: selectedSalesman,
      customerId: visitCustomerId || undefined,
      gpsLocation: gps || undefined,
    });
    setVisitCustomerId('');
    setGps('');
    loadVisits(selectedSalesman);
  };

  const handleCheckOut = async (visitId: string) => {
    await apiClient.post(`/api/salesman/visits/${visitId}/check-out`);
    if (selectedSalesman) loadVisits(selectedSalesman);
  };

  if (!ready) return null;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
        <PageHeader
          title="Salesman"
          description="Field salesmen and their customer visit log."
          action={
            <div className="flex gap-2">
              {businessId && <ClearModuleButton module="salesman" businessId={businessId} />}
              <Button onClick={() => setShowForm((s) => !s)} className="gap-1.5">
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showForm ? 'Cancel' : 'Add Salesman'}
              </Button>
            </div>
          }
        />

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {showForm && (
          <Card className="ring-white/50 glass-sheen-sm">
            <CardContent className="pt-6">
              <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Input placeholder="Route" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} />
                <Button type="submit" disabled={saving} className="sm:col-span-3">{saving ? 'Saving...' : 'Save'}</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : salesmen.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl ring-1 ring-slate-200/70">
            <UserRound className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No salesmen yet.</p>
          </div>
        ) : (
          <>
            <select
              value={selectedSalesman}
              onChange={(e) => setSelectedSalesman(e.target.value)}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
            >
              {salesmen.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.route ? ` - ${s.route}` : ''}</option>
              ))}
            </select>

            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <CardTitle className="text-base">Check in a visit</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCheckIn} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <select
                    value={visitCustomerId}
                    onChange={(e) => setVisitCustomerId(e.target.value)}
                    className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="">No customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <Input placeholder="GPS location" value={gps} onChange={(e) => setGps(e.target.value)} />
                  <Button type="submit">Check In</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <CardTitle className="text-base">Visit History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {(visits[selectedSalesman] || []).length === 0 ? (
                  <p className="p-10 text-center text-slate-400 text-sm">No visits yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {(visits[selectedSalesman] || []).map((v) => (
                      <div key={v.id} className="px-6 py-3 flex justify-between items-center text-sm">
                        <div>
                          <p className="text-slate-800 font-medium">{customers.find((c) => c.id === v.customer_id)?.name || 'No customer'}</p>
                          <p className="text-slate-400 text-xs">{new Date(v.check_in_time).toLocaleString()}</p>
                        </div>
                        {v.check_out_time ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">Checked out</span>
                        ) : (
                          <button onClick={() => handleCheckOut(v.id)} className="text-xs text-emerald-600 font-semibold hover:text-emerald-700">
                            Check Out
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
