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
import { getCurrentUser, hasRole } from '@/lib/auth';
import { Plus, X, MapPin, UserRound, KeyRound, CheckCircle2, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';

interface Salesman {
  id: string;
  name: string;
  phone: string | null;
  route: string | null;
  user_id: string | null;
  email: string | null;
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
  const isSalesmanRole = hasRole('salesman');
  const myUserId = getCurrentUser()?.id;
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
  const [loginFormFor, setLoginFormFor] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [credFormFor, setCredFormFor] = useState<string | null>(null);
  const [credLoading, setCredLoading] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [credError, setCredError] = useState('');
  const [credShowPassword, setCredShowPassword] = useState(false);
  const [credForm, setCredForm] = useState({ email: '', currentPassword: '', newPassword: '' });

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
        // A salesman-role user only ever sees/checks in as themselves.
        const mine = isSalesmanRole ? salesmenRes.data.find((s) => s.user_id === myUserId) : undefined;
        setSelectedSalesman((mine ?? salesmenRes.data[0]).id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load salesman data');
    } finally {
      setLoading(false);
    }
  };

  const loadVisits = async (salesmanId: string) => {
    if (!businessId) return;
    const res = await apiClient.get<Visit[]>(`/api/salesman/${salesmanId}/visits`, { params: { businessId } });
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
    if (!selectedSalesman || !businessId) return;
    await apiClient.post('/api/salesman/visits/check-in', {
      businessId,
      salesmanId: selectedSalesman,
      customerId: visitCustomerId || undefined,
      gpsLocation: gps || undefined,
    });
    setVisitCustomerId('');
    setGps('');
    loadVisits(selectedSalesman);
  };

  const handleCreateLogin = async (e: React.FormEvent, salesmanId: string) => {
    e.preventDefault();
    if (!businessId) return;
    setCreatingLogin(true);
    setLoginError('');
    try {
      await apiClient.post(`/api/salesman/${salesmanId}/create-login`, loginForm, { params: { businessId } });
      setLoginForm({ email: '', password: '' });
      setLoginFormFor(null);
      load(businessId);
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Failed to create login');
    } finally {
      setCreatingLogin(false);
    }
  };

  const handleDeleteSalesman = async (salesmanId: string, name: string) => {
    if (!businessId) return;
    if (!confirm(`Delete ${name}? This removes their visit history and deactivates their login (if any). This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/api/salesman/${salesmanId}`, { params: { businessId } });
      load(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete salesman');
    }
  };

  const handleViewLogin = async (salesmanId: string) => {
    if (credFormFor === salesmanId) {
      setCredFormFor(null);
      return;
    }
    setCredFormFor(salesmanId);
    setCredError('');
    setCredShowPassword(false);
    setCredLoading(true);
    try {
      const res = await apiClient.get<{ email: string; password: string | null }>(`/api/salesman/${salesmanId}/login`, { params: { businessId } });
      setCredForm({ email: res.data.email, currentPassword: res.data.password || '', newPassword: '' });
    } catch (err: any) {
      setCredError(err.response?.data?.message || 'Failed to load login details');
    } finally {
      setCredLoading(false);
    }
  };

  const handleSaveLogin = async (e: React.FormEvent, salesmanId: string) => {
    e.preventDefault();
    if (!businessId) return;
    setCredSaving(true);
    setCredError('');
    try {
      const body: { email?: string; password?: string } = { email: credForm.email };
      if (credForm.newPassword) body.password = credForm.newPassword;
      await apiClient.patch(`/api/salesman/${salesmanId}/login`, body, { params: { businessId } });
      setCredFormFor(null);
      load(businessId);
    } catch (err: any) {
      setCredError(err.response?.data?.message || 'Failed to update login');
    } finally {
      setCredSaving(false);
    }
  };

  const handleCheckOut = async (visitId: string) => {
    if (!businessId) return;
    await apiClient.post(`/api/salesman/visits/${visitId}/check-out`, undefined, { params: { businessId } });
    if (selectedSalesman) loadVisits(selectedSalesman);
  };

  if (!ready) return null;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
        <PageHeader
          title="Salesman"
          description={isSalesmanRole ? 'Your customer visit log.' : 'Field salesmen and their customer visit log.'}
          action={
            !isSalesmanRole && (
              <div className="flex gap-2">
                {businessId && <ClearModuleButton module="salesman" businessId={businessId} />}
                <Button onClick={() => setShowForm((s) => !s)} className="gap-1.5">
                  {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {showForm ? 'Cancel' : 'Add Salesman'}
                </Button>
              </div>
            )
          }
        />

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {!isSalesmanRole && showForm && (
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
          <div className="p-12 text-center bg-white/40 backdrop-blur-xl backdrop-saturate-150 rounded-3xl ring-1 ring-white/50 glass-sheen-sm">
            <UserRound className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No salesmen yet.</p>
          </div>
        ) : (
          <>
            {!isSalesmanRole && (
            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <CardTitle className="text-base">Salesmen &amp; Logins</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {salesmen.map((s) => (
                    <div key={s.id} className="px-6 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                          <p className="text-xs text-slate-400 truncate">{[s.phone, s.route].filter(Boolean).join(' · ') || '—'}</p>
                          {s.email && <p className="text-xs text-slate-400 truncate">{s.email}</p>}
                        </div>
                        {s.user_id ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 gap-1.5"
                            onClick={() => handleViewLogin(s.id)}
                          >
                            <KeyRound className="w-3.5 h-3.5" /> {credFormFor === s.id ? 'Close' : 'View / Edit Login'}
                          </Button>
                        ) : loginFormFor === s.id ? null : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 gap-1.5"
                            onClick={() => { setLoginFormFor(s.id); setLoginForm({ email: '', password: '' }); setLoginError(''); setShowLoginPassword(false); }}
                          >
                            <KeyRound className="w-3.5 h-3.5" /> Create Login
                          </Button>
                        )}
                        <button
                          onClick={() => handleDeleteSalesman(s.id, s.name)}
                          className="shrink-0 p-1.5 text-slate-300 hover:text-rose-600 transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {loginFormFor === s.id && (
                        <form onSubmit={(e) => handleCreateLogin(e, s.id)} className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Input
                            type="email"
                            placeholder="Email"
                            value={loginForm.email}
                            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                            required
                          />
                          <div className="relative">
                            <Input
                              type={showLoginPassword ? 'text' : 'password'}
                              placeholder="Password (min 6 chars)"
                              value={loginForm.password}
                              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                              minLength={6}
                              required
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowLoginPassword((v) => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600"
                              aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                            >
                              {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={creatingLogin} className="flex-1">
                              {creatingLogin ? 'Creating...' : 'Save'}
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setLoginFormFor(null)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      )}
                      {credFormFor === s.id && (
                        <div className="mt-3">
                          {credLoading ? (
                            <p className="text-sm text-slate-400">Loading...</p>
                          ) : (
                            <form onSubmit={(e) => handleSaveLogin(e, s.id)} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <Input
                                type="email"
                                placeholder="Email"
                                value={credForm.email}
                                onChange={(e) => setCredForm({ ...credForm, email: e.target.value })}
                                required
                              />
                              <div className="relative">
                                <Input
                                  type={credShowPassword ? 'text' : 'password'}
                                  placeholder="Current password"
                                  value={credShowPassword ? credForm.currentPassword : '••••••••'}
                                  readOnly
                                  className="pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setCredShowPassword((v) => !v)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600"
                                  aria-label={credShowPassword ? 'Hide password' : 'Show password'}
                                >
                                  {credShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                              <Input
                                type="text"
                                placeholder="New password (leave blank to keep)"
                                value={credForm.newPassword}
                                onChange={(e) => setCredForm({ ...credForm, newPassword: e.target.value })}
                                minLength={6}
                              />
                              <div className="flex gap-2 sm:col-span-3">
                                <Button type="submit" size="sm" disabled={credSaving} className="gap-1.5">
                                  <Pencil className="w-3.5 h-3.5" /> {credSaving ? 'Saving...' : 'Save changes'}
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => setCredFormFor(null)}>
                                  Cancel
                                </Button>
                              </div>
                              {credError && <p className="sm:col-span-3 text-sm text-rose-600">{credError}</p>}
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {loginError && <p className="px-6 pb-3 text-sm text-rose-600">{loginError}</p>}
              </CardContent>
            </Card>
            )}

            {isSalesmanRole ? (
              <p className="text-sm font-semibold text-slate-600">
                {salesmen.find((s) => s.id === selectedSalesman)?.name}
                {salesmen.find((s) => s.id === selectedSalesman)?.route ? ` · ${salesmen.find((s) => s.id === selectedSalesman)?.route}` : ''}
              </p>
            ) : (
              <select
                value={selectedSalesman}
                onChange={(e) => setSelectedSalesman(e.target.value)}
                className="h-10 rounded-full border border-transparent bg-white/35 backdrop-blur-md px-4 text-sm ring-1 ring-white/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_3px_rgba(148,163,184,0.2)] focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
              >
                {salesmen.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.route ? ` - ${s.route}` : ''}</option>
                ))}
              </select>
            )}

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
                    className="h-10 rounded-full border border-transparent bg-white/35 backdrop-blur-md px-4 text-sm ring-1 ring-white/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_3px_rgba(148,163,184,0.2)] focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
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
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-500 backdrop-blur-sm ring-1 ring-slate-500/20">Checked out</span>
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
