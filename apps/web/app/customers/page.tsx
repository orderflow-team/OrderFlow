'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { ClearModuleButton } from '@/components/clear-module-button';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { Plus, Trash2, Users, Search, ChevronRight, UserPlus, AlertTriangle, Pencil, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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

function CustomersPageContent() {
  const searchParams = useSearchParams();
  const { businessId, ready } = useBusiness();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerPayments, setCustomerPayments] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async (cId: string) => {
    if (!businessId) return;
    setHistoryLoading(true);
    try {
      const [ordersRes, paymentsRes] = await Promise.all([
        apiClient.get<any[]>('/api/orders', { params: { businessId, customerId: cId } }),
        apiClient.get<any[]>('/api/billing/payments', { params: { businessId, customerId: cId } }),
      ]);
      setCustomerOrders(ordersRes.data);
      setCustomerPayments(paymentsRes.data);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (historyCustomer) {
      loadHistory(historyCustomer.id);
    }
  }, [historyCustomer, businessId]);

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowForm(true);
  }, [searchParams]);

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

    if (form.phone && !/^\d{10}$/.test(form.phone)) {
      setError('Phone number must be exactly 10 digits');
      setSaving(false);
      return;
    }

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

  const filteredCustomers = search.trim()
    ? customers.filter((c) => {
        const q = search.trim().toLowerCase();
        return c.name.toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.address || '').toLowerCase().includes(q);
      })
    : customers;
  const totalOutstanding = customers.reduce((sum, c) => sum + Number(c.outstanding_amount || 0), 0);

  return (
    <AppShell>
      <div className="p-4 md:p-10 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Clients</h1>
          {!showForm && (
            <Button onClick={openCreateForm} className="gap-1.5 bg-tile-sky-fg hover:brightness-95 text-white">
              <Plus className="w-4 h-4" /> Add Customer
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, area or phone"
              className="w-full h-11 pl-10 pr-4 rounded-full bg-white/40 backdrop-blur-md ring-1 ring-white/50 glass-sheen-sm text-sm placeholder:text-slate-400 outline-none focus:ring-tile-sky-fg/40"
            />
          </div>
          {businessId && <ClearModuleButton module="customers" businessId={businessId} />}
        </div>

        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <Users className="w-3.5 h-3.5" /> {`${customers.length} client${customers.length === 1 ? '' : 's'} • Recent`}
          </p>
          {totalOutstanding > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-500/10 backdrop-blur-sm ring-1 ring-rose-500/20 px-2.5 py-1 rounded-full">
              <AlertTriangle className="w-3 h-3" /> &#8377;{totalOutstanding.toFixed(2)}
            </span>
          )}
        </div>

        {showForm && (
          <Card className="ring-white/50 glass-sheen-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{editingId ? 'Edit Customer' : 'New Customer'}</CardTitle>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setShowForm(false);
                }}
                className="text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
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
                  onChange={(e) => {
                    setForm({ ...form, phone: e.target.value });
                    if (error) setError('');
                  }}
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

        {loading ? (
          <p className="p-10 text-center text-slate-400 text-sm">Loading...</p>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm">
            <div className="w-24 h-24 bg-tile-sky rounded-full flex items-center justify-center mb-6">
              <Users className="w-10 h-10 text-tile-sky-fg" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">No customers found</h2>
            <p className="text-slate-500 mb-8 text-sm">Add details to create a new customer</p>
            <Button onClick={() => setShowForm(true)} className="bg-tile-sky-fg hover:brightness-95 text-white gap-2 px-6 h-11 shadow-sm">
              <Plus className="w-4 h-4" /> New Customer
            </Button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <p className="p-10 text-center text-slate-400 text-sm">No clients match &quot;{search}&quot;.</p>
        ) : (
          <div className="space-y-3">
            {filteredCustomers.map((c) => (
              <div key={c.id} className="flex items-center gap-3 bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm shadow-sm p-3.5">
                <button onClick={() => setHistoryCustomer(c)} className="flex-1 flex items-center gap-3 min-w-0 text-left">
                  <div className="w-11 h-11 rounded-xl bg-tile-sky-fg text-white flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 text-sm truncate">{c.name}</p>
                    {c.phone && <p className="text-xs text-slate-400 truncate mt-0.5">{c.phone}</p>}
                  </div>
                </button>
                {Number(c.outstanding_amount) > 0 && (
                  <span className="text-xs font-bold text-rose-600 shrink-0">{`₹${Number(c.outstanding_amount).toFixed(0)} due`}</span>
                )}
                <button
                  onClick={() => openEditForm(c)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 shrink-0 transition-colors"
                  aria-label="Edit Details"
                  title="Edit Details"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-300 hover:text-rose-600 shrink-0 transition-colors" aria-label="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 cursor-pointer" onClick={() => setHistoryCustomer(c)} />
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!historyCustomer} onOpenChange={(open) => !open && setHistoryCustomer(null)}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] p-0 overflow-hidden rounded-3xl bg-slate-50 border-none shadow-xl flex flex-col">
          <DialogHeader className="p-5 bg-white border-b border-slate-100 flex-shrink-0 flex flex-row items-center justify-between">
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold text-slate-800 truncate">
                {historyCustomer?.name}
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">{historyCustomer?.phone || 'No phone number'}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={() => {
                  if (historyCustomer) {
                    openEditForm(historyCustomer);
                    setHistoryCustomer(null);
                  }
                }}
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold border-slate-200 hover:bg-slate-50"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Details
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                <p className="text-xs font-medium">Fetching orders and payments...</p>
              </div>
            ) : (
              <>
                {(() => {
                  let totalBill = 0;
                  let totalPaid = 0;
                  
                  const ordersWithPayment = customerOrders.map(order => {
                    const orderPayments = customerPayments.filter(p => p.order_id === order.id);
                    const paid = orderPayments.reduce((sum, p) => sum + Number(p.amount), 0);
                    const remaining = Math.max(0, Number(order.total_amount) - paid);
                    
                    totalBill += Number(order.total_amount);
                    totalPaid += paid;
                    
                    return {
                      ...order,
                      paid,
                      remaining
                    };
                  });

                  const totalRemaining = Math.max(0, totalBill - totalPaid);

                  return (
                    <>
                      {/* Overall Summary Card */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                          <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">Total Paid</p>
                          <p className="text-xl font-black text-emerald-700">₹{totalPaid.toFixed(2)}</p>
                        </div>
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-center">
                          <p className="text-xs font-semibold text-rose-800 uppercase tracking-wider mb-1">Total Remaining</p>
                          <p className="text-xl font-black text-rose-700">₹{totalRemaining.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Orders History List */}
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Order History ({customerOrders.length})</p>
                        {ordersWithPayment.length === 0 ? (
                          <p className="text-center py-8 text-slate-400 text-sm bg-white rounded-2xl border border-slate-100">No orders placed yet.</p>
                        ) : (
                          ordersWithPayment.map(order => (
                            <div key={order.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-bold text-slate-800 text-sm">Order {order.order_number}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {new Date(order.created_at).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                                  order.status === 'paid' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-500/15 text-amber-700'
                                }`}>
                                  {order.status}
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-xs">
                                <div>
                                  <p className="text-slate-400 font-medium">Order Total</p>
                                  <p className="font-bold text-slate-700 mt-0.5">₹{Number(order.total_amount).toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-emerald-600 font-medium">Amount Paid</p>
                                  <p className="font-bold text-emerald-600 mt-0.5">₹{order.paid.toFixed(2)}</p>
                                </div>
                                <div>
                                  <p className="text-rose-600 font-medium">Remaining</p>
                                  <p className="font-bold text-rose-600 mt-0.5">₹{order.remaining.toFixed(2)}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </AppShell>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500">Loading...</div>}>
      <CustomersPageContent />
    </Suspense>
  );
}
