'use client';

import { useEffect, useState, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { ClearModuleButton } from '@/components/clear-module-button';
import { GenericOrderModal, CartItem } from '@/components/generic-order-modal';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { Plus, X, ShoppingCart, ChevronDown, ChevronRight } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  selling_price: string | number;
  unit: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  total_amount: string | number;
  created_at: string;
  items?: { quantity: string | number; unit_price: string | number; subtotal: string | number; product?: Product; custom_product_name?: string }[];
}

const STATUSES = ['draft', 'confirmed', 'packed', 'dispatched', 'delivered', 'paid', 'cancelled'];

export function GenericOrders() {
  const { businessId, ready } = useBusiness();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const load = async (bizId: string) => {
    setLoading(true);
    try {
      const [ordersRes, customersRes, productsRes] = await Promise.all([
        apiClient.get<Order[]>('/api/orders', { params: { businessId: bizId } }),
        apiClient.get<Customer[]>('/api/customers', { params: { businessId: bizId } }),
        apiClient.get<Product[]>('/api/products', { params: { businessId: bizId } }),
      ]);
      setOrders(ordersRes.data);
      setCustomers(customersRes.data);
      setProducts(productsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && businessId) load(businessId);
  }, [ready, businessId]);



  const handleCreate = async (cartItems: CartItem[], customerId: string, customerName: string) => {
    if (!businessId) return;
    setSaving(true);
    setError('');
    try {
      const selectedCustomer = customers.find((c) => c.id === customerId);
      await apiClient.post('/api/orders', {
        businessId,
        customerId: customerId || undefined,
        customerName: selectedCustomer?.name || customerName || 'Walk-in',
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

  const handleStatusChange = async (orderId: string, status: string) => {
    if (!businessId) return;
    try {
      await apiClient.patch(`/api/orders/${orderId}/status`, { status }, { params: { businessId } });
      load(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  if (!ready) return null;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Orders"
          description="Quick Parchi mode: items can be a saved product or just free text."
          action={
            <div className="flex gap-2">
              {businessId && <ClearModuleButton module="orders" businessId={businessId} />}
              <Button onClick={() => setShowForm((s) => !s)} className="gap-1.5">
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showForm ? 'Cancel' : 'New Order'}
              </Button>
            </div>
          }
        />

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
              <div className="overflow-x-auto w-full pb-2"><table className="w-full text-sm text-left min-w-[800px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 w-10"></th>
                    <th className="px-6 py-3">Order #</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3 text-right">Total</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <Fragment key={o.id}>
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 cursor-pointer" onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}>
                          {expandedOrder === o.id ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-800 cursor-pointer" onClick={() => setExpandedOrder(expandedOrder === o.id ? null : o.id)}>{o.order_number}</td>
                        <td className="px-6 py-4 text-slate-600">{o.customer_name}</td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800">{Number(o.total_amount).toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <select
                            value={o.status}
                            onChange={(e) => handleStatusChange(o.id, e.target.value)}
                            className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 capitalize"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                      {expandedOrder === o.id && o.items && o.items.length > 0 && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={5} className="px-14 py-4">
                            <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                              <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200 uppercase">
                                  <tr>
                                    <th className="px-4 py-2">Item</th>
                                    <th className="px-4 py-2 text-right">Qty</th>
                                    <th className="px-4 py-2 text-right">Unit Price</th>
                                    <th className="px-4 py-2 text-right">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {o.items.map((item, idx) => (
                                    <tr key={idx}>
                                      <td className="px-4 py-2 font-medium text-slate-700">{item.product?.name || item.custom_product_name || 'Unknown Product'}</td>
                                      <td className="px-4 py-2 text-right text-slate-600">{Number(item.quantity)}</td>
                                      <td className="px-4 py-2 text-right text-slate-600">₹{Number(item.unit_price).toFixed(2)}</td>
                                      <td className="px-4 py-2 text-right font-medium text-slate-700">₹{Number(item.subtotal).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table></div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
