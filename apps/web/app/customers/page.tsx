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
import { getCachedBusinessCategory, getCurrentUser } from '@/lib/auth';
import { Plus, Trash2, Users, Search, ChevronRight, UserPlus, AlertTriangle, Pencil, RefreshCw, History as HistoryIcon, Bell } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Capacitor } from '@capacitor/core';
import { BusinessConnectionsPanel } from '@/components/business-connections-panel';
import { useObixPhoneMatch } from '@/lib/use-obix-phone-match';
import { ObixPhoneMatchBanner } from '@/components/obix-phone-match-banner';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: string | number;
  outstanding_amount: string | number;
  advance_balance?: string | number;
  gst_number?: string | null;
  payment_terms?: string | null;
  trade_discount_percentage?: string | number | null;
  custom_fields?: Record<string, any> | null;
  linked_business_id?: string | null;
}

const emptyForm = { name: '', phone: '', email: '', address: '', gstNumber: '', creditLimit: '', paymentTerms: 'due_on_receipt', tradeDiscountPercentage: '0' };

// A business's client list grows unbounded over time — fetching and
// rendering all of it up front doesn't scale. Load a page at a time
// instead, same pattern as the Orders page (generic-orders.tsx).
const CUSTOMERS_PAGE_SIZE = 50;

interface CustomerStats {
  totalOutstanding: number;
  totalClients: number;
  clientsWithDues: number;
  topOutstanding: Customer[];
}

function CustomersPageContent() {
  const searchParams = useSearchParams();
  const { businessId, ready } = useBusiness();
  const [customers, setCustomers] = useState<Customer[]>([]);
  // The real total (from X-Total-Count), distinct from customers.length once
  // pagination means customers only holds however much has been loaded so
  // far. null until the first successful load.
  const [totalCustomers, setTotalCustomers] = useState<number | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const phoneMatch = useObixPhoneMatch(businessId);
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

  const [historyForm, setHistoryForm] = useState({ name: '', phone: '', email: '', address: '', creditLimit: '' });
  const [isEditingInHistory, setIsEditingInHistory] = useState(false);

  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payingSaving, setPayingSaving] = useState(false);
  const [payError, setPayError] = useState('');

  const [payingTotal, setPayingTotal] = useState(false);
  const [payTotalAmount, setPayTotalAmount] = useState('');
  const [payTotalMethod, setPayTotalMethod] = useState('Cash');
  const [payTotalSaving, setPayTotalSaving] = useState(false);
  const [payTotalError, setPayTotalError] = useState('');
  const [payTotalNotice, setPayTotalNotice] = useState('');

  const [applyingAdvance, setApplyingAdvance] = useState(false);
  const [applyAdvanceError, setApplyAdvanceError] = useState('');

  const openPayRemaining = (orderId: string, remaining: number) => {
    setPayingOrderId(orderId);
    setPayAmount(remaining.toFixed(2));
    setPayMethod('Cash');
    setPayError('');
  };

  const handlePayRemaining = async (e: React.FormEvent, orderId: string) => {
    e.preventDefault();
    if (!businessId || !historyCustomer) return;
    if (Number(payAmount) <= 0) {
      setPayError('Enter an amount greater than ₹0.');
      return;
    }
    setPayingSaving(true);
    setPayError('');
    try {
      await apiClient.post('/api/billing/payments', {
        businessId,
        orderId,
        customerId: historyCustomer.id,
        amount: Number(payAmount),
        paymentMethod: payMethod,
      });
      setPayingOrderId(null);
      loadHistory(historyCustomer.id);
      load(businessId);
    } catch (err: any) {
      setPayError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setPayingSaving(false);
    }
  };

  const openPayTotal = (totalRemaining: number) => {
    setPayingTotal(true);
    setPayTotalAmount(totalRemaining.toFixed(2));
    setPayTotalMethod('Cash');
    setPayTotalError('');
    setPayTotalNotice('');
  };

  const handlePayTotal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !historyCustomer) return;
    if (Number(payTotalAmount) <= 0) {
      setPayTotalError('Enter an amount greater than ₹0.');
      return;
    }
    setPayTotalSaving(true);
    setPayTotalError('');
    setPayTotalNotice('');
    try {
      const res = await apiClient.post<{ advanceApplied: number }>('/api/billing/payments/pay-total', {
        businessId,
        customerId: historyCustomer.id,
        amount: Number(payTotalAmount),
        paymentMethod: payTotalMethod,
      });
      setPayingTotal(false);
      if (res.data.advanceApplied > 0) {
        setPayTotalNotice(`All orders settled — ₹${res.data.advanceApplied.toFixed(2)} extra saved as advance credit for this customer.`);
      }
      loadHistory(historyCustomer.id);
      load(businessId);
    } catch (err: any) {
      setPayTotalError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setPayTotalSaving(false);
    }
  };

  const handleApplyAdvance = async () => {
    if (!businessId || !historyCustomer) return;
    setApplyingAdvance(true);
    setApplyAdvanceError('');
    setPayTotalNotice('');
    try {
      const res = await apiClient.post<{ applied: number }>('/api/billing/payments/apply-advance', {
        businessId,
        customerId: historyCustomer.id,
      });
      setPayTotalNotice(`₹${res.data.applied.toFixed(2)} advance credit applied to outstanding orders.`);
      loadHistory(historyCustomer.id);
      load(businessId);
    } catch (err: any) {
      setApplyAdvanceError(err.response?.data?.message || 'Failed to apply advance credit');
    } finally {
      setApplyingAdvance(false);
    }
  };

  const startHistoryEdit = () => {
    if (!historyCustomer) return;
    setHistoryForm({
      name: historyCustomer.name,
      phone: historyCustomer.phone || '',
      email: historyCustomer.email || '',
      address: historyCustomer.address || '',
      creditLimit: String(historyCustomer.credit_limit ?? ''),
    });
    setIsEditingInHistory(true);
  };

  const handleHistoryEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !historyCustomer) return;
    setSaving(true);
    setError('');

    if (historyForm.phone && !/^\d{10}$/.test(historyForm.phone)) {
      setError('Phone number must be exactly 10 digits');
      setSaving(false);
      return;
    }

    const payload = {
      name: historyForm.name,
      phone: historyForm.phone || undefined,
      email: historyForm.email || undefined,
      address: historyForm.address || undefined,
      creditLimit: historyForm.creditLimit ? Number(historyForm.creditLimit) : undefined,
    };

    try {
      await apiClient.patch(`/api/customers/${historyCustomer.id}`, payload, { params: { businessId } });
      const updatedCustomer: Customer = {
        ...historyCustomer,
        name: payload.name,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
        address: payload.address ?? null,
        credit_limit: payload.creditLimit ?? historyCustomer.credit_limit,
      };
      setHistoryCustomer(updatedCustomer);
      setIsEditingInHistory(false);
      load(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
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

  useEffect(() => {
    const handleOpen = () => {
      setEditingId(null);
      setForm(emptyForm);
      setShowForm(true);
    };
    window.addEventListener('open-new-form', handleOpen);
    return () => window.removeEventListener('open-new-form', handleOpen);
  }, []);

  const load = async (bizId: string, q?: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        apiClient.get<Customer[]>('/api/customers', {
          params: { businessId: bizId, search: q || undefined, limit: CUSTOMERS_PAGE_SIZE, offset: 0 },
        }),
        apiClient.get<CustomerStats>('/api/customers/stats', { params: { businessId: bizId } }),
      ]);
      setCustomers(res.data);
      const totalHeader = res.headers['x-total-count'];
      setTotalCustomers(totalHeader ? Number(totalHeader) : res.data.length);
      setLoadedCount(res.data.length);
      setStats(statsRes.data);
      setHistoryCustomer((current) => {
        if (!current) return current;
        const updated = res.data.find((c) => c.id === current.id);
        return updated || current;
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load customers');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!businessId || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await apiClient.get<Customer[]>('/api/customers', {
        params: { businessId, search: search.trim() || undefined, limit: CUSTOMERS_PAGE_SIZE, offset: loadedCount },
      });
      setCustomers((prev) => [...prev, ...res.data]);
      setLoadedCount((prev) => prev + res.data.length);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load more customers');
    } finally {
      setLoadingMore(false);
    }
  };

  // One debounced effect covers both the initial load AND every search
  // change — search moved server-side (previously a client-side .filter()
  // over the full array, which would stop finding anyone outside whatever
  // page happened to be loaded once this list paginates).
  useEffect(() => {
    if (!ready || !businessId) return;
    const t = setTimeout(() => load(businessId, search), 250);
    return () => clearTimeout(t);
  }, [search, ready, businessId]);

  useEffect(() => {
    if (!ready || !businessId) return;
    const handleUpdate = () => load(businessId, search, true); // Silent reload on background order/payment updates
    window.addEventListener('order-updated', handleUpdate);
    return () => window.removeEventListener('order-updated', handleUpdate);
  }, [ready, businessId, search]);

  const [customFieldSchema, setCustomFieldSchema] = useState<{ name: string; type: string }[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    if (!ready || !businessId) return;
    apiClient
      .get<{ name?: string; customSettings?: any }>(`/api/businesses/${businessId}`)
      .then((res) => {
        setBusinessName(res.data.name || '');
        const settings = res.data.customSettings;
        const schema = settings?.customerCustomFields || settings?.customFields || [];
        setCustomFieldSchema(schema);
      })
      .catch(() => {});
  }, [ready, businessId]);

  const buildWhatsappTarget = (phone?: string | null) => {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return '';
    // Bare 10-digit Indian mobile numbers arrive without a country code.
    return digits.length === 10 ? `91${digits}` : digits;
  };

  const sendReminder = (c: Customer) => {
    const target = buildWhatsappTarget(c.phone);
    if (!target) return;
    const ownerName = getCurrentUser()?.fullName;
    const signOff = ownerName ? `${businessName || 'Us'}(${ownerName})` : businessName || 'Us';
    const text = `Hi,\nIt's a friendly reminder to you for paying ${Number(c.outstanding_amount).toFixed(2)} to me.\n\nThank you,\n${signOff}`;
    // '_blank' opens inside Capacitor's own WebView on native, which can't
    // resolve a wa.me deep link and is left in a stuck/half-navigated state —
    // the reminder button then looks like it silently stopped working on a
    // repeat send. '_system' hands the URL to Android itself, which opens the
    // WhatsApp app directly (same as tapping the link from anywhere else on
    // the device) and leaves this WebView untouched.
    window.open(`https://wa.me/${target}?text=${encodeURIComponent(text)}`, Capacitor.isNativePlatform() ? '_system' : '_blank');
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCustomFieldValues({});
    setShowForm((s) => (editingId ? true : !s));
    phoneMatch.dismiss();
  };

  const openEditForm = (c: Customer) => {
    setEditingId(c.id);
    phoneMatch.dismiss();
    setForm({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      gstNumber: c.gst_number || '',
      creditLimit: String(c.credit_limit ?? ''),
      paymentTerms: c.payment_terms || 'due_on_receipt',
      tradeDiscountPercentage: String(c.trade_discount_percentage ?? '0'),
    });
    setCustomFieldValues(c.custom_fields || {});
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
      gstNumber: form.gstNumber || undefined,
      creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
      paymentTerms: form.paymentTerms || undefined,
      tradeDiscountPercentage: form.tradeDiscountPercentage ? Number(form.tradeDiscountPercentage) : 0,
      customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
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
    if (!confirm("Delete this customer? Their order history stays, but this contact can't be undone.")) return;
    await apiClient.delete(`/api/customers/${id}`, { params: { businessId } });
    load(businessId);
  };

  if (!ready) return null;

  // customers is already server-filtered by `search` (see load/loadMore) —
  // no client-side re-filtering needed, and importantly none SHOULD happen,
  // since customers only holds however much has been paginated in so far.
  //
  // Stats (total outstanding, clients-with-dues, total client count, top 5)
  // come from the dedicated /stats endpoint, which is deliberately NOT
  // scoped to the current search — this is a true whole-business snapshot,
  // same as before pagination existed (the old client-side
  // customers.length/customersWithDues.length were computed from the full
  // array regardless of the search box). totalCustomers (from
  // X-Total-Count) is a DIFFERENT number on purpose — how many rows match
  // the CURRENT search, used only to drive "Load more (N older)" below.
  const totalOutstanding = stats?.totalOutstanding ?? 0;
  const totalClients = stats?.totalClients ?? 0;
  const clientsWithDues = stats?.clientsWithDues ?? 0;
  const topOutstanding = stats?.topOutstanding ?? [];

  return (
    <AppShell>
      <div className="p-4 md:p-10 max-w-3xl lg:max-w-6xl mx-auto">
      <div className="lg:flex lg:gap-6 lg:items-start">
      <div className="lg:flex-1 lg:min-w-0 space-y-5">
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
          {businessId && <ClearModuleButton module="customers" businessId={businessId} onCleared={() => load(businessId, search)} />}
        </div>

        {businessId && <BusinessConnectionsPanel businessId={businessId} role="wholesaler" />}

        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <Users className="w-3.5 h-3.5" /> {`${totalClients} client${totalClients === 1 ? '' : 's'} • Recent`}
          </p>
          {totalOutstanding > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-500/10 backdrop-blur-sm ring-1 ring-rose-500/20 px-2.5 py-1 rounded-full">
              <AlertTriangle className="w-3 h-3" /> &#8377;{totalOutstanding.toFixed(2)}
            </span>
          )}
        </div>

        {showForm && !editingId && (
          <Card className="ring-white/50 glass-sheen-sm border-dashed border-emerald-400/30 bg-emerald-50/5">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-bold text-slate-700">New Customer</CardTitle>
              <button
                type="button"
                onClick={() => {
                  setForm(emptyForm);
                  setShowForm(false);
                }}
                className="text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </CardHeader>
            <CardContent className="pb-4">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  placeholder={
                    getCachedBusinessCategory(businessId || '') === 'restaurant'
                      ? 'Guest / Customer Name (e.g. Rahul Sharma)'
                      : getCachedBusinessCategory(businessId || '') === 'pharmacy'
                      ? 'Patient Name (e.g. Anita Roy)'
                      : getCachedBusinessCategory(businessId || '') === 'wholesale'
                      ? 'Dealer / Buyer Firm Name (e.g. Sunrise Wholesalers)'
                      : 'Customer / Client Name (e.g. Ramesh Kumar)'
                  }
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <div>
                  <Input
                    placeholder="10-Digit Mobile # (e.g. 9876543210)"
                    value={form.phone}
                    onChange={(e) => {
                      setForm({ ...form, phone: e.target.value });
                      if (error) setError('');
                      if (phoneMatch.match) phoneMatch.dismiss();
                    }}
                    onBlur={() => phoneMatch.check(form.phone)}
                  />
                  <ObixPhoneMatchBanner
                    match={phoneMatch.match}
                    connectionStatus={phoneMatch.connectionStatus}
                    connecting={phoneMatch.connecting}
                    error={phoneMatch.error}
                    role="wholesaler"
                    onConnect={() => {
                      if (phoneMatch.match) setForm((f) => ({ ...f, name: phoneMatch.match!.name }));
                      phoneMatch.connect('wholesaler', form.phone);
                    }}
                    onDismiss={phoneMatch.dismiss}
                  />
                </div>
                <Input
                  placeholder="Email (e.g. client@domain.com)"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <Input
                  placeholder="Khata Credit Limit (₹ e.g. 100000)"
                  type="number"
                  value={form.creditLimit}
                  onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                />
                <Input
                  placeholder="GSTIN / Tax ID (e.g. 27AAAAA0000A1Z5)"
                  value={form.gstNumber}
                  onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
                />
                <select
                  value={form.paymentTerms}
                  onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                  className="h-10 w-full rounded-xl border border-input bg-transparent px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="due_on_receipt">Payment Term: Due on Receipt</option>
                  <option value="net_7">Payment Term: Net 7 Days</option>
                  <option value="net_15">Payment Term: Net 15 Days</option>
                  <option value="net_30">Payment Term: Net 30 Days</option>
                  <option value="net_60">Payment Term: Net 60 Days</option>
                </select>
                <Input
                  placeholder="Trade Discount % (e.g. 5)"
                  type="number"
                  value={form.tradeDiscountPercentage}
                  onChange={(e) => setForm({ ...form, tradeDiscountPercentage: e.target.value })}
                />
                <Input
                  placeholder="Store / Delivery Address (e.g. Shop 12, Main Market)"
                  className="sm:col-span-2"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />

                {customFieldSchema.length > 0 && (
                  <div className="sm:col-span-2 space-y-2.5 pt-2 border-t border-slate-200/60">
                    <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-sky-600" /> Custom Customer Attributes
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {customFieldSchema.map((field) => (
                        <div key={field.name} className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">{field.name}</label>
                          {field.type === 'boolean' ? (
                            <select
                              value={customFieldValues[field.name] ? 'true' : 'false'}
                              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.name]: e.target.value === 'true' })}
                              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none"
                            >
                              <option value="false">No</option>
                              <option value="true">Yes</option>
                            </select>
                          ) : (
                            <Input
                              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                              placeholder={`Enter ${field.name}...`}
                              value={customFieldValues[field.name] || ''}
                              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.name]: e.target.value })}
                              className="h-9 text-xs"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Customer'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <p className="p-10 text-center text-slate-400 text-sm">Loading...</p>
        ) : customers.length === 0 && !search.trim() ? (
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
        ) : customers.length === 0 ? (
          <p className="p-10 text-center text-slate-400 text-sm">No clients match &quot;{search}&quot;.</p>
        ) : (
          <div className="space-y-3">
            {customers.map((c) => (
              <div key={c.id} className="flex flex-col bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm shadow-sm p-3.5 transition-all">
                <div className="flex items-center gap-3 w-full">
                  <button onClick={() => setHistoryCustomer(c)} className="flex-1 flex items-center gap-3 min-w-0 text-left">
                    <div className="w-11 h-11 rounded-xl bg-tile-sky-fg text-white flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 text-sm truncate">
                        {c.name}
                        {c.linked_business_id && (
                          <span className="ml-1.5 text-[10px] font-semibold text-sky-700 bg-sky-100/80 px-1.5 py-0.5 rounded-full">Linked via OBIX</span>
                        )}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate mt-0.5 flex-wrap">
                        {c.phone && <span>{c.phone}</span>}
                        {c.gst_number && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">GST: {c.gst_number}</span>}
                        {c.payment_terms && c.payment_terms !== 'due_on_receipt' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-800 text-[10px] font-semibold uppercase">{c.payment_terms.replace('_', ' ')}</span>
                        )}
                        {Number(c.trade_discount_percentage) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100/80 text-emerald-800 text-[10px] font-bold">Disc: {c.trade_discount_percentage}%</span>
                        )}
                      </div>
                    </div>
                  </button>
                  {Number(c.outstanding_amount) > 0.01 && (
                    <span className="text-xs font-bold text-rose-600 shrink-0">{`₹${Number(c.outstanding_amount).toFixed(0)} due`}</span>
                  )}
                  {c.phone && Number(c.outstanding_amount) > 0.01 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sendReminder(c);
                      }}
                      className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 shrink-0 transition-colors rounded-lg"
                      aria-label="Send Payment Reminder"
                      title="Send Payment Reminder via WhatsApp"
                    >
                      <Bell className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (editingId === c.id && showForm) {
                        setEditingId(null);
                        setShowForm(false);
                      } else {
                        openEditForm(c);
                      }
                    }}
                    className={`p-1.5 shrink-0 transition-colors rounded-lg ${
                      editingId === c.id && showForm
                        ? 'bg-slate-200/60 text-slate-700'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                    }`}
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

                {/* Inline dropdown edit form */}
                {editingId === c.id && showForm && (
                  <div className="border-t border-slate-100/60 mt-3 pt-3.5 w-full animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="text-xs font-semibold text-slate-500 mb-3">Edit Client Details</p>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        placeholder="Name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        required
                        className="h-10 text-xs bg-white/60"
                      />
                      <div>
                        <Input
                          placeholder="Phone"
                          value={form.phone}
                          onChange={(e) => {
                            setForm({ ...form, phone: e.target.value });
                            if (error) setError('');
                            if (phoneMatch.match) phoneMatch.dismiss();
                          }}
                          onBlur={() => phoneMatch.check(form.phone)}
                          className="h-10 text-xs bg-white/60"
                        />
                        <ObixPhoneMatchBanner
                          match={phoneMatch.match}
                          connectionStatus={phoneMatch.connectionStatus}
                          connecting={phoneMatch.connecting}
                          error={phoneMatch.error}
                          role="wholesaler"
                          onConnect={() => {
                            if (phoneMatch.match) setForm((f) => ({ ...f, name: phoneMatch.match!.name }));
                            phoneMatch.connect('wholesaler', form.phone);
                          }}
                          onDismiss={phoneMatch.dismiss}
                        />
                      </div>
                      <Input
                        placeholder="Email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="h-10 text-xs bg-white/60"
                      />
                      <Input
                        placeholder="Credit limit"
                        type="number"
                        value={form.creditLimit}
                        onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                        className="h-10 text-xs bg-white/60"
                      />
                      <Input
                        placeholder="Address"
                        className="sm:col-span-2 h-10 text-xs bg-white/60"
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                      />
                      {error && <p className="text-xs text-rose-600 sm:col-span-2 font-medium">{error}</p>}
                      <div className="sm:col-span-2 flex gap-2 mt-1">
                        <Button type="submit" size="sm" disabled={saving} className="flex-1 h-9 bg-slate-800 hover:bg-slate-900 text-white font-semibold">
                          {saving ? 'Updating...' : 'Update Details'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingId(null);
                            setForm(emptyForm);
                            setShowForm(false);
                          }}
                          className="flex-1 h-9 font-semibold border-slate-200"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ))}
            {totalCustomers !== null && loadedCount < totalCustomers && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full h-11 rounded-2xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 text-sm font-semibold text-slate-600 hover:bg-white/55 disabled:opacity-60 transition-colors"
              >
                {loadingMore ? 'Loading…' : `Load more (${totalCustomers - loadedCount} older)`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Rail — desktop-only outstanding balances */}
      <aside className="hidden lg:block w-72 shrink-0 space-y-4 sticky top-10 self-start">
        <div className="bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm shadow-sm p-5 space-y-3.5">
          <h3 className="text-sm font-bold text-slate-800">Quick stats</h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Total clients</span>
            <span className="text-sm font-bold text-slate-800">{totalClients}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Clients with dues</span>
            <span className="text-sm font-bold text-slate-800">{clientsWithDues}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Total outstanding</span>
            <span className="text-sm font-bold text-rose-600">₹{totalOutstanding.toFixed(2)}</span>
          </div>
        </div>

        {topOutstanding.length > 0 && (
          <div className="bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Top outstanding balances
            </h3>
            <div className="space-y-2.5">
              {topOutstanding.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setHistoryCustomer(c)}
                  className="flex items-center justify-between gap-2 w-full text-left hover:bg-white/40 rounded-lg -mx-1 px-1 py-0.5 transition-colors"
                >
                  <span className="text-xs text-slate-600 truncate">{c.name}</span>
                  <span className="text-xs font-semibold text-rose-600 shrink-0">₹{Number(c.outstanding_amount).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
      </div>
      </div>

      <Dialog open={!!historyCustomer} onOpenChange={(open) => {
        if (!open) {
          setHistoryCustomer(null);
          setIsEditingInHistory(false);
          setError('');
          setPayingTotal(false);
          setPayTotalNotice('');
          setPayTotalError('');
          setApplyAdvanceError('');
        }
      }}>
        <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[85vh] p-0 overflow-hidden rounded-3xl bg-slate-50 border-none shadow-xl flex flex-col">
          <DialogHeader className="p-5 bg-white border-b border-slate-100 flex-shrink-0 flex flex-row items-center justify-between">
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold text-slate-800 truncate">
                {historyCustomer?.name}
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-0.5">{historyCustomer?.phone || 'No phone number'}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isEditingInHistory && historyCustomer?.phone && Number(historyCustomer?.outstanding_amount) > 0.01 && (
                <Button
                  onClick={() => sendReminder(historyCustomer)}
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-semibold border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <Bell className="w-3.5 h-3.5" /> Remind
                </Button>
              )}
              <Button
                onClick={() => {
                  if (isEditingInHistory) {
                    setIsEditingInHistory(false);
                    setError('');
                  } else {
                    startHistoryEdit();
                  }
                }}
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold border-slate-200 hover:bg-slate-50"
              >
                {isEditingInHistory ? (
                  <>
                    <HistoryIcon className="w-3.5 h-3.5" /> View History
                  </>
                ) : (
                  <>
                    <Pencil className="w-3.5 h-3.5" /> Edit Details
                  </>
                )}
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {isEditingInHistory ? (
              <form onSubmit={handleHistoryEditSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Name</label>
                    <Input
                      placeholder="Name"
                      value={historyForm.name}
                      onChange={(e) => setHistoryForm({ ...historyForm, name: e.target.value })}
                      required
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Phone</label>
                    <Input
                      placeholder="Phone"
                      value={historyForm.phone}
                      onChange={(e) => {
                        setHistoryForm({ ...historyForm, phone: e.target.value });
                        if (error) setError('');
                      }}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Email</label>
                    <Input
                      placeholder="Email"
                      value={historyForm.email}
                      onChange={(e) => setHistoryForm({ ...historyForm, email: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Credit Limit</label>
                    <Input
                      placeholder="Credit limit"
                      type="number"
                      value={historyForm.creditLimit}
                      onChange={(e) => setHistoryForm({ ...historyForm, creditLimit: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-500">Address</label>
                    <Input
                      placeholder="Address"
                      value={historyForm.address}
                      onChange={(e) => setHistoryForm({ ...historyForm, address: e.target.value })}
                      className="bg-white"
                    />
                  </div>
                </div>

                {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}

                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={saving} className="flex-1 h-10 font-semibold bg-slate-800 hover:bg-slate-900 text-white">
                    {saving ? 'Updating...' : 'Update Details'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditingInHistory(false);
                      setError('');
                    }}
                    className="flex-1 h-10 font-semibold border-slate-200"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : historyLoading ? (
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
                    const isCancelledOrReturned = order.status === 'cancelled' || order.status === 'returned';
                    const remaining = isCancelledOrReturned
                      ? 0
                      : Math.max(0, Number(order.total_amount) - paid);
                    
                    if (!isCancelledOrReturned) {
                      totalBill += Number(order.total_amount);
                      totalPaid += paid;
                    }
                    
                    return {
                      ...order,
                      paid,
                      remaining
                    };
                  });

                  const totalRemaining = Math.max(0, totalBill - totalPaid);

                  const advanceBalance = Number(historyCustomer?.advance_balance || 0);

                  return (
                    <>
                      {/* Overall Summary Card */}
                      <div className={`grid gap-2 sm:gap-3 ${advanceBalance > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        <div className="min-w-0 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-2.5 sm:p-4 text-center">
                          <p className="text-[10px] sm:text-xs font-semibold text-emerald-800 uppercase tracking-wide sm:tracking-wider mb-1">Total Paid</p>
                          <p className="text-sm sm:text-xl font-black text-emerald-700 truncate">₹{totalPaid.toFixed(2)}</p>
                        </div>
                        <div className="min-w-0 bg-rose-500/10 border border-rose-500/20 rounded-2xl p-2.5 sm:p-4 text-center">
                          <p className="text-[10px] sm:text-xs font-semibold text-rose-800 uppercase tracking-wide sm:tracking-wider mb-1">Total Remaining</p>
                          <p className="text-sm sm:text-xl font-black text-rose-700 truncate">₹{totalRemaining.toFixed(2)}</p>
                        </div>
                        {advanceBalance > 0 && (
                          <div className="min-w-0 bg-sky-500/10 border border-sky-500/20 rounded-2xl p-2.5 sm:p-4 text-center">
                            <p className="text-[10px] sm:text-xs font-semibold text-sky-800 uppercase tracking-wide sm:tracking-wider mb-1">Advance Credit</p>
                            <p className="text-sm sm:text-xl font-black text-sky-700 truncate">₹{advanceBalance.toFixed(2)}</p>
                          </div>
                        )}
                      </div>

                      {payTotalNotice && (
                        <p className="text-xs font-medium text-sky-700 bg-sky-500/10 border border-sky-500/20 rounded-xl px-3 py-2">{payTotalNotice}</p>
                      )}

                      {/* Apply existing advance credit first — no new cash needed */}
                      {advanceBalance > 0 && totalRemaining > 0 && (
                        <div className="space-y-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleApplyAdvance}
                            disabled={applyingAdvance}
                            className="w-full h-10 text-sm font-semibold border-sky-300 text-sky-700 hover:bg-sky-50"
                          >
                            {applyingAdvance ? 'Applying...' : `Apply Advance Credit (₹${Math.min(advanceBalance, totalRemaining).toFixed(2)})`}
                          </Button>
                          {applyAdvanceError && <p className="text-xs text-rose-600 font-medium">{applyAdvanceError}</p>}
                        </div>
                      )}

                      {/* Pay Total — settle every outstanding order at once instead of one at a time */}
                      {totalRemaining > 0 && (
                        payingTotal ? (
                          <form onSubmit={handlePayTotal} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2.5">
                            <p className="text-xs font-bold text-slate-600">Pay Total Across All Orders</p>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Amount"
                                value={payTotalAmount}
                                onChange={(e) => setPayTotalAmount(e.target.value)}
                                className="h-9 text-sm bg-white"
                                required
                              />
                              <select
                                value={payTotalMethod}
                                onChange={(e) => setPayTotalMethod(e.target.value)}
                                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                              >
                                {['Cash', 'UPI', 'Bank Transfer', 'Credit'].map((m) => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              Oldest orders are settled first. Paying more than ₹{totalRemaining.toFixed(2)} saves the extra as advance credit for this customer.
                            </p>
                            {payTotalError && <p className="text-xs text-rose-600 font-medium">{payTotalError}</p>}
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" disabled={payTotalSaving} className="flex-1 h-8 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white">
                                {payTotalSaving ? 'Recording...' : 'Confirm Total Payment'}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPayingTotal(false)}
                                className="h-8 text-xs font-semibold border-slate-200"
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <Button
                            type="button"
                            onClick={() => openPayTotal(totalRemaining)}
                            className="w-full h-10 text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white"
                          >
                            Pay Total (₹{totalRemaining.toFixed(2)}) — All Orders
                          </Button>
                        )
                      )}

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
                                  order.status === 'paid' ? 'bg-emerald-500/15 text-emerald-700' :
                                  order.status === 'cancelled' ? 'bg-rose-500/15 text-rose-700' :
                                  order.status === 'returned' ? 'bg-yellow-500/15 text-yellow-700' :
                                  'bg-amber-500/15 text-amber-700'
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

                              {order.remaining > 0 && (
                                payingOrderId === order.id ? (
                                  <form onSubmit={(e) => handlePayRemaining(e, order.id)} className="border-t border-slate-100 pt-3 space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="Amount"
                                        value={payAmount}
                                        onChange={(e) => setPayAmount(e.target.value)}
                                        className="h-9 text-sm bg-white"
                                        required
                                      />
                                      <select
                                        value={payMethod}
                                        onChange={(e) => setPayMethod(e.target.value)}
                                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                                      >
                                        {['Cash', 'UPI', 'Bank Transfer', 'Credit'].map((m) => (
                                          <option key={m} value={m}>{m}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <p className="text-[11px] text-slate-400">
                                      Paying more than ₹{order.remaining.toFixed(2)} saves the extra as advance credit for this customer.
                                    </p>
                                    {payError && <p className="text-xs text-rose-600 font-medium">{payError}</p>}
                                    <div className="flex gap-2">
                                      <Button type="submit" size="sm" disabled={payingSaving} className="flex-1 h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                                        {payingSaving ? 'Recording...' : 'Confirm Payment'}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPayingOrderId(null)}
                                        className="h-8 text-xs font-semibold border-slate-200"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </form>
                                ) : (
                                  <div className="border-t border-slate-100 pt-3">
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => openPayRemaining(order.id, order.remaining)}
                                      className="w-full h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                      Pay Remaining
                                    </Button>
                                  </div>
                                )
                              )}
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
