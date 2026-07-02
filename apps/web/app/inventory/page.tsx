'use client';

import { useEffect, useState, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { ClearModuleButton } from '@/components/clear-module-button';
import { StatusBadge } from '@/components/status-badge';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { Plus, X, AlertTriangle, Warehouse, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
}

interface Product {
  id: string;
  name: string;
  stock_quantity: number;
}

interface PurchaseOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: string | number;
  items?: { quantity: string | number; unit_price: string | number; subtotal: string | number; product?: Product }[];
}

interface PoLine {
  productId: string;
  quantity: string;
  unitPrice: string;
}

export default function InventoryPage() {
  const { businessId, ready } = useBusiness();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedPo, setExpandedPo] = useState<string | null>(null);

  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '' });
  const [showSupplierForm, setShowSupplierForm] = useState(false);

  const [poSupplierId, setPoSupplierId] = useState('');
  const [poLines, setPoLines] = useState<PoLine[]>([{ productId: '', quantity: '1', unitPrice: '' }]);
  const [showPoForm, setShowPoForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async (bizId: string) => {
    setLoading(true);
    try {
      const [suppliersRes, productsRes, poRes, lowStockRes] = await Promise.all([
        apiClient.get<Supplier[]>('/api/suppliers', { params: { businessId: bizId } }),
        apiClient.get<Product[]>('/api/products', { params: { businessId: bizId, isDraft: 'all' } }),
        apiClient.get<PurchaseOrder[]>('/api/inventory/purchase-orders', { params: { businessId: bizId } }),
        apiClient.get<Product[]>('/api/inventory/low-stock', { params: { businessId: bizId } }),
      ]);
      setSuppliers(suppliersRes.data);
      setProducts(productsRes.data);
      setPurchaseOrders(poRes.data);
      setLowStock(lowStockRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && businessId) load(businessId);
  }, [ready, businessId]);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    try {
      await apiClient.post('/api/suppliers', { businessId, name: supplierForm.name, phone: supplierForm.phone || undefined });
      setSupplierForm({ name: '', phone: '' });
      setShowSupplierForm(false);
      load(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/api/inventory/purchase-orders', {
        businessId,
        supplierId: poSupplierId || undefined,
        items: poLines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
      });
      setPoSupplierId('');
      setPoLines([{ productId: '', quantity: '1', unitPrice: '' }]);
      setShowPoForm(false);
      load(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async (id: string) => {
    if (!businessId) return;
    await apiClient.post(`/api/inventory/purchase-orders/${id}/receive`, {}, { params: { businessId } });
    load(businessId);
  };

  if (!ready) return null;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
        <PageHeader
          title="Inventory"
          description="Suppliers, purchase orders, and stock levels."
          action={businessId && <ClearModuleButton module="inventory" businessId={businessId} />}
        />

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <Card className="ring-white/50 glass-sheen-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <CardTitle className="text-base">Low Stock</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing low on stock.</p>
            ) : (
              <div className="space-y-2">
                {lowStock.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <span className="text-slate-800">{p.name}</span>
                    <span className="text-amber-600 font-semibold">{p.stock_quantity} left</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Suppliers</h2>
          <Button variant="outline" onClick={() => setShowSupplierForm((s) => !s)} className="gap-1.5">
            {showSupplierForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showSupplierForm ? 'Cancel' : 'Add Supplier'}
          </Button>
        </div>
        {showSupplierForm && (
          <Card className="ring-white/50 glass-sheen-sm">
            <CardContent className="pt-6">
              <form onSubmit={handleCreateSupplier} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input placeholder="Name" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} required />
                <Input placeholder="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
              </form>
            </CardContent>
          </Card>
        )}
        <Card className="ring-white/50 glass-sheen-sm">
          <CardContent className="p-0">
            {suppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Warehouse className="w-10 h-10 text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">No suppliers found</h2>
                <p className="text-slate-500 mb-8 text-sm">Add a supplier to manage your supply chain</p>
                <Button onClick={() => setShowSupplierForm(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6 h-11 shadow-sm">
                  <Plus className="w-4 h-4" /> Add Supplier
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <div key={s.id} className="px-6 py-3 text-sm flex justify-between">
                    <span className="font-medium text-slate-800">{s.name}</span>
                    <span className="text-slate-500">{s.phone || '-'}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Purchase Orders</h2>
          <Button variant="outline" onClick={() => setShowPoForm((s) => !s)} className="gap-1.5">
            {showPoForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showPoForm ? 'Cancel' : 'New Purchase Order'}
          </Button>
        </div>
        {showPoForm && (
          <Card className="ring-white/50 glass-sheen-sm">
            <CardContent className="pt-6 space-y-4">
              <form onSubmit={handleCreatePo} className="space-y-4">
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm w-full sm:w-64"
                >
                  <option value="">No supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {poLines.map((line, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center bg-slate-50 rounded-xl p-3">
                    <select
                      value={line.productId}
                      onChange={(e) =>
                        setPoLines((prev) => prev.map((l, i) => (i === index ? { ...l, productId: e.target.value } : l)))
                      }
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                      required
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <Input
                      placeholder="Quantity"
                      type="number"
                      value={line.quantity}
                      onChange={(e) =>
                        setPoLines((prev) => prev.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)))
                      }
                    />
                    <Input
                      placeholder="Unit price"
                      type="number"
                      value={line.unitPrice}
                      onChange={(e) =>
                        setPoLines((prev) => prev.map((l, i) => (i === index ? { ...l, unitPrice: e.target.value } : l)))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setPoLines((prev) => prev.filter((_, i) => i !== index))}
                      className="text-xs text-slate-400 hover:text-rose-600 text-left"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setPoLines((prev) => [...prev, { productId: '', quantity: '1', unitPrice: '' }])}
                    className="text-sm text-emerald-600 font-medium hover:text-emerald-700"
                  >
                    + Add item
                  </button>
                  <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Purchase Order'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        <Card className="ring-white/50 glass-sheen-sm">
          <CardContent className="p-0">
            {loading ? (
              <p className="p-10 text-center text-slate-400 text-sm">Loading...</p>
            ) : purchaseOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Warehouse className="w-10 h-10 text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">No purchase orders</h2>
                <p className="text-slate-500 mb-8 text-sm">Create a purchase order to restock items</p>
                <Button onClick={() => setShowPoForm(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6 h-11 shadow-sm">
                  <Plus className="w-4 h-4" /> New Purchase Order
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto w-full pb-2"><table className="w-full text-sm text-left min-w-[800px]">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 w-10"></th>
                    <th className="px-6 py-3">PO #</th>
                    <th className="px-6 py-3 text-right">Total</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseOrders.map((po) => (
                    <Fragment key={po.id}>
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 cursor-pointer" onClick={() => setExpandedPo(expandedPo === po.id ? null : po.id)}>
                          {expandedPo === po.id ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-800 cursor-pointer" onClick={() => setExpandedPo(expandedPo === po.id ? null : po.id)}>{po.order_number}</td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800">{Number(po.total_amount).toFixed(2)}</td>
                        <td className="px-6 py-4"><StatusBadge status={po.status} /></td>
                        <td className="px-6 py-4 text-right">
                          {po.status !== 'received' && (
                            <button
                              onClick={() => handleReceive(po.id)}
                              className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-700"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Mark Received
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedPo === po.id && po.items && po.items.length > 0 && (
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
                                  {po.items.map((item, idx) => (
                                    <tr key={idx}>
                                      <td className="px-4 py-2 font-medium text-slate-700">{item.product?.name || 'Unknown Product'}</td>
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
