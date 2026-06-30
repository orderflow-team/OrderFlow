'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { ClearModuleButton } from '@/components/clear-module-button';
import { StatusBadge } from '@/components/status-badge';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { Receipt, FileText } from 'lucide-react';

interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  status: string;
  total_amount: string | number;
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

  const load = async (bizId: string) => {
    setLoading(true);
    try {
      const [ordersRes, invoicesRes, paymentsRes] = await Promise.all([
        apiClient.get<Order[]>('/api/orders', { params: { businessId: bizId } }),
        apiClient.get<Invoice[]>('/api/billing/invoices', { params: { businessId: bizId } }),
        apiClient.get<Payment[]>('/api/billing/payments', { params: { businessId: bizId } }),
      ]);
      setOrders(ordersRes.data);
      setInvoices(invoicesRes.data);
      setPayments(paymentsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && businessId) load(businessId);
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
    try {
      const order = orders.find((o) => o.id === payOrderId);
      await apiClient.post('/api/billing/payments', {
        businessId,
        orderId: payOrderId,
        customerId: order?.customer_id || undefined,
        amount: Number(payAmount),
        paymentMethod: payMethod,
      });
      setPayOrderId('');
      setPayAmount('');
      load(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
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

        <Card className="ring-slate-200/70 shadow-sm shadow-slate-200/40">
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
                  setPayAmount(order ? Number(order.total_amount).toFixed(2) : '');
                }}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
                required
              >
                <option value="">Select order</option>
                {orders.filter(o => o.status !== 'paid').map((o) => (
                  <option key={o.id} value={o.id}>{o.order_number} - {o.customer_name} ({Number(o.total_amount).toFixed(0)})</option>
                ))}
              </select>
              <Input placeholder="Amount" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required />
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="ring-slate-200/70 shadow-sm shadow-slate-200/40">
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
                {orders.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-slate-500">{o.order_number}</span>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="text-sm font-medium text-slate-800 truncate mt-0.5">{o.customer_name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="font-bold text-slate-800">₹{Number(o.total_amount).toFixed(2)}</span>
                      {invoiceByOrderId.has(o.id) ? (
                        <a
                          href={`/billing/invoices/${invoiceByOrderId.get(o.id)}`}
                          className="text-xs text-emerald-600 font-semibold hover:text-emerald-700"
                        >
                          View Invoice
                        </a>
                      ) : (
                        <button onClick={() => handleGenerateInvoice(o.id)} className="text-xs text-emerald-600 font-semibold hover:text-emerald-700">
                          + Invoice
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="ring-slate-200/70 shadow-sm shadow-slate-200/40">
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
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{p.payment_method}</span>
                    <span className="text-slate-500">{new Date(p.created_at).toLocaleString()}</span>
                    <span className="font-semibold text-slate-800">{Number(p.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
