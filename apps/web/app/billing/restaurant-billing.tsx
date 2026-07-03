'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { Search, Eye, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface Table {
  name: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  status: string;
  total_amount: string | number;
  guest_count: number | null;
  table: Table | null;
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

export function RestaurantBilling() {
  const { businessId, ready } = useBusiness();
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [saving, setSaving] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const loadData = async (bizId: string) => {
    setLoading(true);
    try {
      const [ordersRes, paymentsRes] = await Promise.all([
        apiClient.get<Order[]>('/api/orders', { params: { businessId: bizId } }),
        apiClient.get<Payment[]>('/api/billing/payments', { params: { businessId: bizId } }),
      ]);
      setOrders(ordersRes.data);
      setPayments(paymentsRes.data);
    } catch (err) {
      console.error('Failed to load billing data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && businessId) loadData(businessId);
  }, [ready, businessId]);

  const handleOpenPayment = (order: Order) => {
    setSelectedOrder(order);
    setPayAmount(Number(order.total_amount).toFixed(2));
    setPayMethod('Cash');
    setPaymentError('');
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !selectedOrder) return;
    setPaymentError('');
    if (Number(payAmount) <= 0) {
      setPaymentError('A bill of ₹0 cannot be paid — add items to the order first.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/api/billing/payments', {
        businessId,
        orderId: selectedOrder.id,
        customerId: selectedOrder.customer_id || undefined,
        amount: Number(payAmount),
        paymentMethod: payMethod,
      });
      // Optionally generate invoice automatically here if we want
      await apiClient.post(`/api/billing/invoices/from-order/${selectedOrder.id}`, {}, { params: { businessId } }).catch(() => null);

      setShowPaymentModal(false);
      loadData(businessId);
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  if (!ready || loading) return (
    <AppShell>
      <div className="p-6 text-center text-slate-400">Loading Billing Terminal...</div>
    </AppShell>
  );

  // Computed Stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayPayments = payments.filter(p => new Date(p.created_at) >= todayStart);
  const totalRevenueToday = todayPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const settledTransactionsCount = todayPayments.length;

  const awaitingPaymentOrders = orders.filter(o => o.status === 'delivered');
  // Consider drafts or confirmed as active bills
  const activeBills = orders.filter(o => o.status === 'draft' || o.status === 'confirmed');

  // Filter lists based on search
  const filteredAwaiting = awaitingPaymentOrders.filter(o => 
    (o.table?.name || 'Take Away').toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name.toLowerCase().includes(search.toLowerCase())
  );
  
  const filteredActive = activeBills.filter(o => 
    (o.table?.name || 'Take Away').toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name.toLowerCase().includes(search.toLowerCase())
  );

  // Settlement Log (join payments with orders to get table name)
  const settleLog = todayPayments.map(p => {
    const o = orders.find(ord => ord.id === p.order_id);
    return {
      id: p.id,
      tableName: o?.table?.name || 'Take Away',
      customerName: o?.customer_name || 'Guest',
      amount: Number(p.amount),
      time: new Date(p.created_at)
    };
  }).sort((a, b) => b.time.getTime() - a.time.getTime()); // Latest first

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-[1400px] mx-auto min-h-[calc(100vh-64px)] flex flex-col gap-6 bg-slate-50/50">
        
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="ring-emerald-300/40 bg-emerald-500/10">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-emerald-800 mb-1">Total Revenue Today</p>
              <h2 className="text-4xl font-black text-emerald-600 mb-1">₹{totalRevenueToday.toFixed(2)}</h2>
              <p className="text-xs font-medium text-emerald-600/70">From {settledTransactionsCount} settled transactions</p>
            </CardContent>
          </Card>
          
          <Card className="ring-white/50">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-slate-500 mb-1">Awaiting Payment</p>
              <h2 className="text-4xl font-black text-amber-500 mb-1">{awaitingPaymentOrders.length}</h2>
              <p className="text-xs font-medium text-slate-400">Tables waiting for bill checkout</p>
            </CardContent>
          </Card>

          <Card className="ring-white/50">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-slate-500 mb-1">Active Tables</p>
              <h2 className="text-4xl font-black text-blue-500 mb-1">{activeBills.length}</h2>
              <p className="text-xs font-medium text-slate-400">Currently dining/ordering</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left Column: Cashier Terminal */}
          <Card className="lg:col-span-2 ring-white/50 min-h-[500px] flex flex-col">
            <div className="p-5 border-b border-white/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="text-amber-500">🧾</span> Cashier Checkout Terminal
              </h2>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="Search table or name..." 
                  className="pl-9 bg-white/40 backdrop-blur-md ring-1 ring-white/50 h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            
            <div className="p-5 space-y-6 flex-1 overflow-y-auto">
              
              {/* Awaiting Payment Section */}
              <div>
                <h3 className="text-sm font-bold text-amber-600 mb-3 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                  Awaiting Payment ({filteredAwaiting.length})
                </h3>
                <div className="space-y-3">
                  {filteredAwaiting.map(order => (
                    <div key={order.id} className="p-4 rounded-2xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 glass-sheen-sm flex items-center justify-between hover:ring-amber-300/50 transition-colors">
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg">{order.table?.name || 'Take Away'}</h4>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">Customer: {order.customer_name} {order.guest_count ? `- ${order.guest_count} guests` : ''}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-xl font-bold text-emerald-600">₹{Number(order.total_amount).toFixed(2)}</div>
                        <Button variant="outline" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-600">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => handleOpenPayment(order)} className="bg-amber-500/15 backdrop-blur-md hover:bg-amber-500/25 text-amber-700 ring-1 ring-amber-500/25 h-9 font-semibold">
                          Close Bill
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredAwaiting.length === 0 && (
                    <div className="p-6 border border-dashed border-white/60 rounded-2xl bg-white/20 text-center text-sm text-slate-400 font-medium">
                      No tables currently awaiting payment
                    </div>
                  )}
                </div>
              </div>

              {/* Active Bills Section */}
              <div>
                <h3 className="text-sm font-bold text-blue-600 mb-3 flex items-center gap-2 mt-8">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  Dining / Active Bills ({filteredActive.length})
                </h3>
                <div className="space-y-3">
                  {filteredActive.map(order => (
                    <div key={order.id} className="p-4 rounded-2xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 glass-sheen-sm flex items-center justify-between hover:ring-blue-300/50 transition-colors">
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg">{order.table?.name || 'Take Away'}</h4>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">Customer: {order.customer_name} {order.guest_count ? `- ${order.guest_count} guests` : ''}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-xl font-bold text-emerald-600">₹{Number(order.total_amount).toFixed(2)}</div>
                        <Button variant="outline" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-600">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button onClick={() => handleOpenPayment(order)} className="bg-rose-500/15 backdrop-blur-md hover:bg-rose-500/25 text-rose-600 ring-1 ring-rose-500/25 h-9 font-semibold">
                          Close Bill
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredActive.length === 0 && (
                    <div className="p-6 border border-dashed border-white/60 rounded-2xl bg-white/20 text-center text-sm text-slate-400 font-medium">
                      No active tables right now
                    </div>
                  )}
                </div>
              </div>

            </div>
          </Card>

          {/* Right Column: Settlement Log */}
          <Card className="ring-white/50 min-h-[500px] max-h-[500px] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-white/40 shrink-0">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Transactions Settle Log
              </h2>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              {settleLog.map(log => (
                <div key={log.id} className="p-3 rounded-xl bg-white/25 backdrop-blur-sm ring-1 ring-white/40 flex justify-between items-center transition-colors hover:bg-white/40">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-emerald-400 rounded-full"></div>
                    <div>
                      <div className="text-sm font-bold text-emerald-900">
                        {log.tableName} <span className="text-slate-600 font-medium ml-1">{log.customerName}</span>
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400 mt-0.5 flex items-center gap-1">
                        🕒 {format(log.time, 'hh:mm a')}
                      </div>
                    </div>
                  </div>
                  <div className="font-bold text-emerald-600">
                    ₹{log.amount.toFixed(2)}
                  </div>
                </div>
              ))}
              {settleLog.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-400 font-medium">
                  No settlements today
                </div>
              )}
            </div>
          </Card>

        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Settle Bill for {selectedOrder?.table?.name || 'Take Away'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Amount to Collect (₹)</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
                className="text-lg font-bold text-emerald-600"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Payment Method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full h-10 rounded-xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 px-3 text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            {paymentError && <p className="text-sm text-rose-600 font-medium">{paymentError}</p>}
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || Number(payAmount) <= 0} className="font-bold px-6">
                {saving ? 'Processing...' : 'Confirm Payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </AppShell>
  );
}
