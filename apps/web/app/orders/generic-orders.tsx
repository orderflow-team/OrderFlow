'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { ClearModuleButton } from '@/components/clear-module-button';
import { GenericOrderModal, CartItem } from '@/components/generic-order-modal';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import {
  Plus, X, ShoppingCart, ChevronRight, FileText, Trash2,
  IndianRupee, CheckCircle2, Clock, Package, Truck, XCircle,
  Pencil, Minus, Check,
} from 'lucide-react';

interface Customer { id: string; name: string; phone?: string; }
interface Product { id: string; name: string; selling_price: string | number; unit: string; }
interface OrderItem {
  quantity: string | number;
  unit_price: string | number;
  subtotal: string | number;
  product?: Product;
  custom_product_name?: string;
}
interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_id?: string;
  status: string;
  total_amount: string | number;
  created_at: string;
  items?: OrderItem[];
}

const STATUSES = ['draft', 'confirmed', 'packed', 'dispatched', 'delivered', 'paid', 'cancelled'];

const STATUS_META: Record<string, { color: string; icon: typeof Clock }> = {
  draft:      { color: 'bg-slate-100 text-slate-600',   icon: Clock },
  confirmed:  { color: 'bg-blue-100 text-blue-700',     icon: CheckCircle2 },
  packed:     { color: 'bg-indigo-100 text-indigo-700', icon: Package },
  dispatched: { color: 'bg-purple-100 text-purple-700', icon: Truck },
  delivered:  { color: 'bg-teal-100 text-teal-700',     icon: CheckCircle2 },
  paid:       { color: 'bg-emerald-100 text-emerald-700', icon: IndianRupee },
  cancelled:  { color: 'bg-rose-100 text-rose-600',     icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { color: 'bg-slate-100 text-slate-600', icon: Clock };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.color}`}>
      {status}
    </span>
  );
}

export function GenericOrders() {
  const { businessId, ready } = useBusiness();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Drawer state
  const [drawerOrder, setDrawerOrder] = useState<Order | null>(null);
  const [drawerStatus, setDrawerStatus] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Credit'>('Cash');

  // Edit-items state
  type EditLine = { name: string; qty: string; price: string; productId?: string; unit?: string };
  const [editMode, setEditMode] = useState(false);
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const load = async (bizId: string) => {
    setLoading(true);
    try {
      const [ordersRes, customersRes] = await Promise.all([
        apiClient.get<Order[]>('/api/orders', { params: { businessId: bizId } }),
        apiClient.get<Customer[]>('/api/customers', { params: { businessId: bizId } }),
      ]);
      setOrders(ordersRes.data);
      setCustomers(customersRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && businessId) load(businessId);
  }, [ready, businessId]);

  const openDrawer = async (o: Order) => {
    setDrawerOrder(o);
    setDrawerStatus(o.status);
    setDeleteConfirm(false);
    setInvoiceId(null);
    setEditMode(false);
    setPaymentMethod('Cash');
    // Check for existing invoice
    if (businessId) {
      try {
        const res = await apiClient.get<{ id: string }[]>('/api/billing/invoices', {
          params: { businessId, orderId: o.id },
        });
        if (res.data.length > 0) setInvoiceId(res.data[0].id);
      } catch {
        // no invoice yet
      }
    }
  };

  const closeDrawer = () => {
    setDrawerOrder(null);
    setDeleteConfirm(false);
    setPaymentMethod('Cash');
  };

  const handleStatusSave = async () => {
    if (!businessId || !drawerOrder) return;
    setStatusSaving(true);
    try {
      await apiClient.patch(`/api/orders/${drawerOrder.id}/status`, { status: drawerStatus }, { params: { businessId } });
      setDrawerOrder({ ...drawerOrder, status: drawerStatus });
      setOrders((prev) => prev.map((o) => o.id === drawerOrder.id ? { ...o, status: drawerStatus } : o));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!businessId || !drawerOrder) return;
    setStatusSaving(true);
    try {
      await apiClient.patch(`/api/orders/${drawerOrder.id}/status`, { status: 'paid' }, { params: { businessId } });
      const amount = Number(drawerOrder.total_amount);
      if (amount > 0) {
        await apiClient.post('/api/billing/payments', {
          businessId,
          orderId: drawerOrder.id,
          customerId: drawerOrder.customer_id || undefined,
          amount,
          paymentMethod,
        });
      }
      setDrawerOrder({ ...drawerOrder, status: 'paid' });
      setDrawerStatus('paid');
      setOrders((prev) => prev.map((o) => o.id === drawerOrder.id ? { ...o, status: 'paid' } : o));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to mark as paid');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!businessId || !drawerOrder) return;
    if (invoiceId) { router.push(`/billing/invoices/${invoiceId}`); return; }
    setInvoiceLoading(true);
    try {
      const res = await apiClient.post<{ id: string }>(
        `/api/billing/invoices/from-order/${drawerOrder.id}`,
        {},
        { params: { businessId } },
      );
      const newId = res.data?.id;
      setInvoiceId(newId || null);
      if (newId) router.push(`/billing/invoices/${newId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!businessId || !drawerOrder) return;
    try {
      await apiClient.delete(`/api/orders/${drawerOrder.id}`, { params: { businessId } });
      setOrders((prev) => prev.filter((o) => o.id !== drawerOrder.id));
      closeDrawer();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete order');
    }
  };

  const startEdit = () => {
    if (!drawerOrder?.items) return;
    setEditLines(
      drawerOrder.items.map((i) => ({
        name: i.product?.name || i.custom_product_name || '',
        qty: String(Number(i.quantity)),
        price: String(Number(i.unit_price)),
        productId: i.product?.id,
        unit: i.product?.unit,
      })),
    );
    setEditMode(true);
  };

  const updateLine = (idx: number, field: keyof EditLine, value: string) => {
    setEditLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const addEditLine = () => setEditLines((prev) => [...prev, { name: '', qty: '1', price: '0' }]);

  const removeEditLine = (idx: number) => setEditLines((prev) => prev.filter((_, i) => i !== idx));

  const saveEditLines = async () => {
    if (!businessId || !drawerOrder) return;
    const valid = editLines.filter((l) => l.name.trim() && Number(l.qty) > 0);
    if (valid.length === 0) return;
    setEditSaving(true);
    try {
      const res = await apiClient.put<Order>(`/api/orders/${drawerOrder.id}/items`, {
        items: valid.map((l) => ({
          productId: l.productId,
          customProductName: l.productId ? undefined : l.name.trim(),
          unit: l.unit,
          quantity: Number(l.qty),
          unitPrice: Number(l.price),
        })),
      }, { params: { businessId } });
      const updated = { ...drawerOrder, items: res.data.items, total_amount: res.data.total_amount };
      setDrawerOrder(updated);
      setOrders((prev) => prev.map((o) => o.id === drawerOrder.id ? { ...o, total_amount: res.data.total_amount } : o));
      setEditMode(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save changes');
    } finally {
      setEditSaving(false);
    }
  };

  const handleCreate = async (cartItems: CartItem[], customerId: string, customerName: string, phone?: string) => {
    if (!businessId) return;
    setSaving(true);
    setError('');
    try {
      const selectedCustomer = customers.find((c) => c.id === customerId);
      await apiClient.post('/api/orders', {
        businessId,
        customerId: customerId || undefined,
        customerName: selectedCustomer?.name || customerName || 'Walk-in',
        phone: phone || undefined,
        orderType: 'regular',
        items: cartItems.map((it) => ({
          productId: it.product.id.startsWith('draft-') ? undefined : it.product.id,
          customProductName: it.product.id.startsWith('draft-') ? it.product.name : undefined,
          unit: it.product.id.startsWith('draft-') ? it.product.unit : undefined,
          quantity: Number(it.quantity),
          unitPrice: Number(it.product.selling_price),
        })),
      });
      setShowForm(false);
      load(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create order');
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  return (
    <AppShell>
      <div className="p-4 md:p-10 max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Orders"
          description="Quick Parchi mode: items can be a saved product or just free text."
          action={
        <div className="grid grid-cols-2 gap-3 pb-4">
              {businessId && <ClearModuleButton module="orders" businessId={businessId} />}
              <Button onClick={() => setShowForm((s) => !s)} className="gap-1.5">
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showForm ? 'Cancel' : 'New Order'}
              </Button>
            </div>
          }
        />

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {businessId && showForm && (
          <GenericOrderModal
            businessId={businessId}
            isOpen={showForm}
            customers={customers}
            onClose={() => setShowForm(false)}
            onSubmit={handleCreate}
          />
        )}

        <Card className="ring-slate-200/70 shadow-sm shadow-slate-200/40">
          <CardContent className="p-0">
            {loading ? (
              <p className="p-10 text-center text-slate-400 text-sm">Loading...</p>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <ShoppingCart className="w-10 h-10 text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">No active orders</h2>
                <p className="text-slate-500 mb-8 text-sm">Add items to create a new order</p>
                <Button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6 h-11 shadow-sm">
                  <Plus className="w-4 h-4" /> New Order
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile list */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {orders.map((o) => (
                    <button
                      key={o.id}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 active:bg-slate-50 transition-colors"
                      onClick={() => openDrawer(o)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{o.order_number}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{o.customer_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-800 text-sm">₹{Number(o.total_amount).toFixed(2)}</p>
                        <div className="mt-1"><StatusBadge status={o.status} /></div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </button>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto w-full">
                  <table className="w-full text-sm text-left min-w-[600px]">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3">Order #</th>
                        <th className="px-6 py-3">Customer</th>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3 text-right">Total</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map((o) => (
                        <tr
                          key={o.id}
                          className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                          onClick={() => openDrawer(o)}
                        >
                          <td className="px-6 py-4 font-medium text-slate-800">{o.order_number}</td>
                          <td className="px-6 py-4 text-slate-600">{o.customer_name}</td>
                          <td className="px-6 py-4 text-slate-500 text-xs">
                            {new Date(o.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-slate-800">₹{Number(o.total_amount).toFixed(2)}</td>
                          <td className="px-6 py-4"><StatusBadge status={o.status} /></td>
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

      {/* ── Order Detail Drawer ── */}
      {drawerOrder && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={closeDrawer} />

          {/* Panel: bottom sheet on mobile, right panel on desktop */}
          <div className="fixed z-50 bg-white flex flex-col
            inset-x-0 bottom-0 rounded-t-2xl max-h-[92dvh]
            md:inset-x-auto md:inset-y-0 md:right-0 md:rounded-none md:rounded-l-2xl md:w-[420px] md:max-h-none md:h-full
            shadow-2xl">

            {/* Drag handle – mobile */}
            <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <p className="font-bold text-slate-800 text-base">{drawerOrder.order_number}</p>
                <p className="text-sm text-slate-500 mt-0.5">{drawerOrder.customer_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(drawerOrder.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button onClick={closeDrawer} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors shrink-0">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Total */}
              <div className="bg-emerald-50 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-emerald-700 font-medium">Order Total</span>
                <span className="text-xl font-black text-emerald-700">₹{Number(drawerOrder.total_amount).toFixed(2)}</span>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items</p>
                  {!editMode ? (
                    <button onClick={startEdit} className="flex items-center gap-1 text-xs text-emerald-600 font-medium hover:text-emerald-700">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setEditMode(false)} className="text-xs text-slate-500 font-medium hover:text-slate-700">Cancel</button>
                      <button onClick={saveEditLines} disabled={editSaving} className="flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-700 disabled:opacity-50">
                        <Check className="w-3 h-3" />{editSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>

                {!editMode ? (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    {(drawerOrder.items ?? []).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {item.product?.name || item.custom_product_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-slate-400">×{Number(item.quantity)} · ₹{Number(item.unit_price).toFixed(2)} each</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 ml-3 shrink-0">₹{Number(item.subtotal).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editLines.map((line, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-slate-50 rounded-xl p-2">
                        <div className="flex-1 min-w-0">
                          <input
                            value={line.name}
                            onChange={(e) => updateLine(idx, 'name', e.target.value)}
                            placeholder="Item name"
                            className="w-full text-sm font-medium text-slate-800 bg-transparent outline-none placeholder:text-slate-400 mb-1"
                          />
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                              <button onClick={() => updateLine(idx, 'qty', String(Math.max(1, Number(line.qty) - 1)))} className="text-slate-400 hover:text-slate-600">
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                value={line.qty}
                                onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                                className="w-8 text-center text-sm font-semibold text-slate-800 bg-transparent outline-none"
                              />
                              <button onClick={() => updateLine(idx, 'qty', String(Number(line.qty) + 1))} className="text-slate-400 hover:text-slate-600">
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                              <span className="text-slate-400 text-xs">₹</span>
                              <input
                                value={line.price}
                                onChange={(e) => updateLine(idx, 'price', e.target.value)}
                                onFocus={(e) => e.target.select()}
                                type="number"
                                min="0"
                                className="w-16 text-sm font-semibold text-slate-800 bg-transparent outline-none"
                              />
                            </div>
                            <span className="text-xs text-slate-400 ml-auto">
                              ₹{(Number(line.qty) * Number(line.price)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => removeEditLine(idx)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button onClick={addEditLine} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add item
                    </button>
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Update Status</p>
                <div className="flex gap-2">
                  <select
                    value={drawerStatus}
                    onChange={(e) => setDrawerStatus(e.target.value)}
                    className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 capitalize"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <Button
                    onClick={handleStatusSave}
                    disabled={statusSaving || drawerStatus === drawerOrder.status}
                    className="h-10 bg-slate-800 hover:bg-slate-700 text-white"
                  >
                    {statusSaving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="shrink-0 px-5 py-4 border-t border-slate-100 space-y-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">

              {/* Mark as Paid */}
              {drawerOrder.status !== 'paid' && drawerOrder.status !== 'cancelled' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['Cash', 'UPI', 'Bank Transfer', 'Credit'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`h-8 rounded-lg text-xs font-semibold border transition-colors ${
                          paymentMethod === m
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <Button
                    onClick={handleMarkPaid}
                    disabled={statusSaving}
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    <IndianRupee className="w-4 h-4" />
                    Mark as Paid · {paymentMethod}
                  </Button>
                </div>
              )}

              {/* Invoice */}
              <Button
                onClick={handleGenerateInvoice}
                disabled={invoiceLoading}
                variant="outline"
                className="w-full h-11 gap-2 border-slate-200"
              >
                <FileText className="w-4 h-4" />
                {invoiceLoading ? 'Generating…' : invoiceId ? 'View Invoice' : 'Generate Invoice'}
              </Button>

              {/* Delete */}
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl text-rose-500 hover:bg-rose-50 active:bg-rose-100 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Order
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 h-11 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors"
                  >
                    Confirm Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
