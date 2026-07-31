'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { ClearModuleButton } from '@/components/clear-module-button';
import { StatusBadge } from '@/components/status-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { getCached, setCached, listOutbox, type OutboxOrderItem } from '@/lib/offline-db';
import { useOfflineStore } from '@/lib/offline-store';
import { Receipt, FileText, Undo2 } from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  status: string;
  total_amount: string | number;
}

function syntheticOrderFromOutbox(item: OutboxOrderItem): Order {
  const payload = item.payload as { customerId?: string; customerName?: string; items: { quantity: number; unitPrice: number }[] };
  return {
    id: item.id,
    order_number: 'Queued…',
    customer_id: payload.customerId || null,
    customer_name: payload.customerName || 'Walk-in',
    status: item.status === 'failed' ? 'sync_failed' : 'queued',
    total_amount: payload.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0),
  };
}

interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  total_amount: string | number;
  created_at: string;
}

interface Payment {
  id: string;
  order_id: string | null;
  amount: string | number;
  payment_method: string;
  status: string;
  created_at: string;
}

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Credit'];

export function StandardBilling() {
  const { businessId, ready } = useBusiness();
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [payOrderId, setPayOrderId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [saving, setSaving] = useState(false);
  const enqueuePayment = useOfflineStore((s) => s.enqueuePayment);

  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [undoError, setUndoError] = useState('');

  const withQueuedOrders = async (bizId: string, baseOrders: Order[]): Promise<Order[]> => {
    const outbox = await listOutbox(bizId);
    const queued = outbox
      .filter((item): item is OutboxOrderItem => item.type === 'order' && item.status !== 'synced')
      .map(syntheticOrderFromOutbox)
      .reverse();
    return [...queued, ...baseOrders];
  };

  const load = async (bizId: string) => {
    setLoading(true);
    try {
      const [ordersRes, invoicesRes, paymentsRes] = await Promise.all([
        apiClient.get<Order[]>('/api/orders', { params: { businessId: bizId } }),
        apiClient.get<Invoice[]>('/api/billing/invoices', { params: { businessId: bizId } }),
        apiClient.get<Payment[]>('/api/billing/payments', { params: { businessId: bizId } }),
      ]);
      setCached(bizId, 'orders', ordersRes.data);
      setCached(bizId, 'invoices', invoicesRes.data);
      setCached(bizId, 'payments', paymentsRes.data);
      setOrders(await withQueuedOrders(bizId, ordersRes.data));
      setInvoices(invoicesRes.data);
      setPayments(paymentsRes.data);
    } catch (err: any) {
      if (!err.response) {
        const [cachedOrders, cachedInvoices, cachedPayments] = await Promise.all([
          getCached<Order[]>(bizId, 'orders'),
          getCached<Invoice[]>(bizId, 'invoices'),
          getCached<Payment[]>(bizId, 'payments'),
        ]);
        if (cachedOrders || cachedInvoices || cachedPayments) {
          setOrders(await withQueuedOrders(bizId, cachedOrders || []));
          setInvoices(cachedInvoices || []);
          setPayments(cachedPayments || []);
          return;
        }
      }
      setError(err.response?.data?.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && businessId) load(businessId);
  }, [ready, businessId]);

  // The offline sync engine (triggered from AppShell, globally) dispatches
  // this after syncing queued orders/payments in the background — without
  // this listener the screen would keep showing "Queued…" and stale
  // remaining-balance figures even after everything has actually synced.
  useEffect(() => {
    const handleOrderUpdated = () => {
      if (ready && businessId) load(businessId);
    };
    window.addEventListener('order-updated', handleOrderUpdated);
    return () => window.removeEventListener('order-updated', handleOrderUpdated);
  }, [ready, businessId]);

  const handleGenerateInvoice = async (orderId: string) => {
    if (!businessId) return;
    setError('');
    const order = orders.find((o) => o.id === orderId);
    if (order && Number(order.total_amount) <= 0) {
      setError('Cannot generate an invoice for a ₹0 order — add items first.');
      return;
    }
    try {
      await apiClient.post(`/api/billing/invoices/from-order/${orderId}`, {}, { params: { businessId } });
      load(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate invoice');
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !payOrderId) return;
    setError('');
    if (Number(payAmount) <= 0) {
      setError('A bill of ₹0 cannot be paid — select an order with items first.');
      return;
    }
    setSaving(true);
    const order = orders.find((o) => o.id === payOrderId);
    // An order still shown as 'queued'/'sync_failed' hasn't synced yet — its id
    // is only a local outbox id, not a real order id the payments API knows.
    const isLocalOrder = order?.status === 'queued' || order?.status === 'sync_failed';
    const paymentPayload = {
      businessId,
      orderId: isLocalOrder ? undefined : payOrderId,
      customerId: order?.customer_id || undefined,
      amount: Number(payAmount),
      paymentMethod: payMethod,
    };
    try {
      if (isLocalOrder) {
        await enqueuePayment(businessId, paymentPayload, payOrderId);
      } else {
        await apiClient.post('/api/billing/payments', paymentPayload);
      }
      setPayOrderId('');
      setPayAmount('');
      load(businessId);
    } catch (err: any) {
      if (!err.response) {
        await enqueuePayment(businessId, paymentPayload, isLocalOrder ? payOrderId : undefined);
        setPayOrderId('');
        setPayAmount('');
        load(businessId);
      } else {
        setError(err.response?.data?.message || 'Failed to record payment');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUndoPayment = async (paymentId: string) => {
    if (!businessId) return;
    setUndoError('');
    setUndoingId(paymentId);
    try {
      await apiClient.post(`/api/billing/payments/${paymentId}/undo`, {}, { params: { businessId } });
      await load(businessId);
    } catch (err: any) {
      setUndoError(err.response?.data?.message || 'Failed to undo payment');
    } finally {
      setUndoingId(null);
    }
  };

  if (!ready) return null;

  const invoiceByOrderId = new Map(invoices.map((i) => [i.order_id, i.id]));

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
        <PageHeader
          title="Billing"
          description="Generate invoices from orders and record payments."
          action={businessId && <ClearModuleButton module="billing" businessId={businessId} />}
        />

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <Card className="ring-white/50 glass-sheen-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <CardTitle className="text-base">Record a Payment</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePayment} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <select
                value={payOrderId}
                onChange={(e) => {
                  const orderId = e.target.value;
                  setPayOrderId(orderId);
                  const order = orders.find((o) => o.id === orderId);
                  if (order) {
                    const paid = payments
                      .filter((p) => p.order_id === order.id)
                      .reduce((sum, p) => sum + Number(p.amount), 0);
                    const remaining = Math.max(0, Number(order.total_amount) - paid);
                    setPayAmount(remaining.toFixed(2));
                  } else {
                    setPayAmount('');
                  }
                }}
                className="h-10 rounded-xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 px-3 text-sm"
                required
              >
                <option value="">Select order</option>
                {orders.filter(o => o.status !== 'paid' && o.status !== 'returned' && o.status !== 'cancelled').map((o) => {
                  const paid = payments
                    .filter((p) => p.order_id === o.id)
                    .reduce((sum, p) => sum + Number(p.amount), 0);
                  const remaining = Math.max(0, Number(o.total_amount) - paid);
                  return (
                    <option key={o.id} value={o.id}>
                      {o.order_number} - {o.customer_name} (₹{remaining.toFixed(0)} remaining)
                    </option>
                  );
                })}
              </select>
              <Input placeholder="Amount" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required />
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="h-10 rounded-xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 px-3 text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="ring-white/50 glass-sheen-sm">
          <CardHeader>
            <CardTitle className="text-base">Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-10 text-center text-slate-400 text-sm">Loading...</p>
            ) : orders.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No orders yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {orders.map((o) => {
                  const isLocal = o.status === 'queued' || o.status === 'sync_failed';
                  return (
                  <div
                    key={o.id}
                    onClick={() => { if (!isLocal) setDetailOrderId(o.id); }}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-white/40 transition-colors ${!isLocal ? 'cursor-pointer' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-slate-500">{o.order_number}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="text-sm font-medium text-slate-800 truncate mt-0.5">{o.customer_name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="font-bold text-slate-800">₹{Number(o.total_amount).toFixed(2)}</span>
                      {(() => {
                        const paid = payments
                          .filter((p) => p.order_id === o.id)
                          .reduce((sum, p) => sum + Number(p.amount), 0);
                        const remaining = Math.max(0, Number(o.total_amount) - paid);
                        if (paid > 0 && remaining > 0) {
                          return (
                            <span className="text-[10px] text-slate-400 font-medium">
                              ₹{paid.toFixed(0)} paid · ₹{remaining.toFixed(0)} due
                            </span>
                          );
                        }
                        return null;
                      })()}
                      {isLocal ? (
                        <span className="text-[10px] text-amber-600 font-medium">Not synced yet</span>
                      ) : invoiceByOrderId.has(o.id) ? (
                        <a
                          href={`/billing/invoices/${invoiceByOrderId.get(o.id)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-emerald-600 font-semibold hover:text-emerald-700"
                        >
                          View Invoice
                        </a>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); handleGenerateInvoice(o.id); }} className="text-xs text-emerald-600 font-semibold hover:text-emerald-700">
                          + Invoice
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="ring-white/50 glass-sheen-sm">
          <CardHeader>
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <p className="p-10 text-center text-slate-400 text-sm">No payments yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <div key={p.id} className="px-6 py-3 flex justify-between items-center text-sm">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/40 backdrop-blur-sm ring-1 ring-white/50 text-slate-600">{p.payment_method}</span>
                    <span className="text-slate-500">{new Date(p.created_at).toLocaleString()}</span>
                    <span className="font-semibold text-slate-800">{Number(p.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!detailOrderId} onOpenChange={(open) => { if (!open) { setDetailOrderId(null); setUndoError(''); } }}>
        <DialogContent className="sm:max-w-md">
          {(() => {
            const order = orders.find((o) => o.id === detailOrderId);
            if (!order) return null;
            const orderPayments = payments.filter((p) => p.order_id === order.id);
            const paid = orderPayments.reduce((sum, p) => sum + Number(p.amount), 0);
            const remaining = Math.max(0, Number(order.total_amount) - paid);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <span className="font-mono">{order.order_number}</span>
                    <StatusBadge status={order.status} />
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm font-medium text-slate-700">{order.customer_name}</p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs bg-white/50 rounded-xl p-3 ring-1 ring-white/60">
                    <div>
                      <p className="text-slate-400 font-medium">Order Total</p>
                      <p className="font-bold text-slate-800 mt-0.5">₹{Number(order.total_amount).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-600 font-medium">Paid</p>
                      <p className="font-bold text-emerald-600 mt-0.5">₹{paid.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-rose-600 font-medium">Remaining</p>
                      <p className="font-bold text-rose-600 mt-0.5">₹{remaining.toFixed(2)}</p>
                    </div>
                  </div>

                  {undoError && <p className="text-xs text-rose-600 font-medium">{undoError}</p>}

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Payments</p>
                    {orderPayments.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">No payments recorded on this order.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {orderPayments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800">₹{Number(p.amount).toFixed(2)} <span className="text-xs font-normal text-slate-400">· {p.payment_method}</span></p>
                              <p className="text-[11px] text-slate-400">{new Date(p.created_at).toLocaleString()}</p>
                            </div>
                            {Number(p.amount) > 0 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={undoingId === p.id}
                                onClick={() => handleUndoPayment(p.id)}
                                className="h-8 gap-1.5 text-xs font-semibold border-rose-200 text-rose-600 hover:bg-rose-50 shrink-0"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                {undoingId === p.id ? 'Undoing...' : 'Undo'}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
