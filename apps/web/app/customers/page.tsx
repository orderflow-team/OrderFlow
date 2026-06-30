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
import { Plus, Pencil, Trash2, Users } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: string | number;
  outstanding_amount: string | number;
}

const emptyForm = { name: '', phone: '', email: '', address: '', creditLimit: '' };

export default function CustomersPage() {
  const { businessId, ready } = useBusiness();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async (bizId: string) => {
    setLoading(true);
    try {
      const res = await apiClient.get<Customer[]>('/api/customers', { params: { businessId: bizId } });
      setCustomers(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && businessId) load(businessId);
  }, [ready, businessId]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm((s) => (editingId ? true : !s));
  };

  const openEditForm = (c: Customer) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      creditLimit: String(c.credit_limit ?? ''),
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError('');
    const payload = {
      name: form.name,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
    };
    try {
      if (editingId) {
        await apiClient.patch(`/api/customers/${editingId}`, payload, { params: { businessId } });
      } else {
        await apiClient.post('/api/customers', { businessId, ...payload });
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      load(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!businessId) return;
    await apiClient.delete(`/api/customers/${id}`, { params: { businessId } });
    load(businessId);
  };

  if (!ready) return null;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="Customers"
          description="Manage your customer list and outstanding balances."
          action={
            <div className="flex gap-2">
              {businessId && <ClearModuleButton module="customers" businessId={businessId} />}
              <Button onClick={openCreateForm} className="gap-1.5">
                <Plus className="w-4 h-4" />
                {showForm && !editingId ? 'Cancel' : 'Add Customer'}
              </Button>
            </div>
          }
        />

        {showForm && (
          <Card className="ring-slate-200/70 shadow-sm shadow-slate-200/40">
            <CardHeader>
              <CardTitle className="text-base">{editingId ? 'Edit Customer' : 'New Customer'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <Input
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <Input
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <Input
                  placeholder="Credit limit"
                  type="number"
                  value={form.creditLimit}
                  onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                />
                <Input
                  placeholder="Address"
                  className="sm:col-span-2"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
                {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : editingId ? 'Update Customer' : 'Save Customer'}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingId(null);
                        setForm(emptyForm);
                        setShowForm(false);
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="ring-slate-200/70 shadow-sm shadow-slate-200/40">
          <CardContent className="p-0">
            {loading ? (
              <p className="p-10 text-center text-slate-400 text-sm">Loading...</p>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Users className="w-10 h-10 text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">No customers found</h2>
                <p className="text-slate-500 mb-8 text-sm">Add details to create a new customer</p>
                <Button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6 h-11 shadow-sm">
                  <Plus className="w-4 h-4" /> New Customer
                </Button>
              </div>
            ) : (
              <>
                {/* ── Mobile card list ── */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {customers.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{c.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{c.phone || 'No phone'}</p>
                      </div>
                      <div className="text-right shrink-0 mr-1">
                        {Number(c.outstanding_amount) > 0 && (
                          <p className="text-xs font-bold text-rose-600">₹{Number(c.outstanding_amount).toFixed(0)} due</p>
                        )}
                        {Number(c.credit_limit) > 0 && (
                          <p className="text-[11px] text-slate-400">Limit ₹{Number(c.credit_limit).toFixed(0)}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => openEditForm(c)}
                          className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Desktop table ── */}
                <div className="hidden sm:block overflow-x-auto w-full">
                  <table className="w-full text-sm text-left min-w-[600px]">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Phone</th>
                        <th className="px-6 py-3 text-right">Credit Limit</th>
                        <th className="px-6 py-3 text-right">Outstanding</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-slate-800">{c.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{c.phone || '-'}</td>
                          <td className="px-6 py-4 text-right text-slate-600">{Number(c.credit_limit).toFixed(2)}</td>
                          <td className={`px-6 py-4 text-right font-semibold ${Number(c.outstanding_amount) > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {Number(c.outstanding_amount).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEditForm(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" aria-label="Edit">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" aria-label="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
