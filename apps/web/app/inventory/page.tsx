'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { ClearModuleButton } from '@/components/clear-module-button';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { getCachedBusinessCategory } from '@/lib/auth';
import { getPoFieldConfig, type CustomBusinessSettings } from '@/lib/business-modules';
import { Plus, X, AlertTriangle, Warehouse, Truck } from 'lucide-react';
import { ScanToInventoryDialog } from './scan-to-inventory';
import { PurchaseOrderForm, type EditingPo } from './purchase-order-form';
import { PurchaseOrderList } from './purchase-order-list';

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  stock_quantity: number;
  brand?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  last_supplier?: { id: string; name: string } | null;
}

export default function InventoryPage() {
  const { businessId, ready } = useBusiness();
  const [isPharmacy, setIsPharmacy] = useState(false);
  const [customSettings, setCustomSettings] = useState<CustomBusinessSettings | undefined>();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showPoForm, setShowPoForm] = useState(false);
  const [editingPo, setEditingPo] = useState<EditingPo | null>(null);

  const category = businessId ? getCachedBusinessCategory(businessId) : null;
  const fieldConfig = getPoFieldConfig(category, customSettings);

  useEffect(() => {
    if (businessId) setIsPharmacy(getCachedBusinessCategory(businessId) === 'pharmacy');
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    apiClient
      .get<{ customSettings?: CustomBusinessSettings }>(`/api/businesses/${businessId}`)
      .then((res) => setCustomSettings(res.data.customSettings))
      .catch(() => {});
  }, [businessId]);

  const load = async (bizId: string) => {
    setLoading(true);
    try {
      const [suppliersRes, productsRes, poRes, lowStockRes] = await Promise.all([
        apiClient.get<Supplier[]>('/api/suppliers', { params: { businessId: bizId } }),
        apiClient.get<Product[]>('/api/products', { params: { businessId: bizId, isDraft: 'all' } }),
        apiClient.get<any[]>('/api/inventory/purchase-orders', { params: { businessId: bizId } }),
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

  const openCreate = () => {
    setEditingPo(null);
    setShowPoForm(true);
  };

  const openEdit = (po: EditingPo) => {
    setEditingPo(po);
    setShowPoForm(true);
  };

  const handleSaved = () => {
    setShowPoForm(false);
    setEditingPo(null);
    if (businessId) load(businessId);
  };

  const closeForm = () => {
    setShowPoForm(false);
    setEditingPo(null);
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
              <CardTitle className="text-base">{isPharmacy ? 'Low Stock Medicines' : 'Low Stock'}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing low on stock.</p>
            ) : (
              <div className="space-y-2">
                {lowStock.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <div>
                      <span className="text-slate-800">{p.name}</span>
                      {fieldConfig.batchExpiry && p.batch_number && (
                        <span className="text-xs text-slate-400 ml-2">Batch {p.batch_number}</span>
                      )}
                      {p.last_supplier && (
                        <span className="text-xs text-slate-400 ml-2 inline-flex items-center gap-1">
                          <Truck className="w-3 h-3" /> {p.last_supplier.name}
                        </span>
                      )}
                    </div>
                    <span className="text-amber-600 font-semibold">{p.stock_quantity} left</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Suppliers</h2>
          <Link href="/inventory/suppliers">
            <Button variant="outline" className="gap-1.5">
              <Warehouse className="w-4 h-4" /> Manage Suppliers
            </Button>
          </Link>
        </div>
        <Card className="ring-white/50 glass-sheen-sm">
          <CardContent className="p-0">
            {suppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm">
                <div className="w-20 h-20 bg-white/40 backdrop-blur-sm ring-1 ring-white/50 rounded-full flex items-center justify-center mb-5">
                  <Warehouse className="w-9 h-9 text-slate-400" />
                </div>
                <h2 className="text-lg font-bold text-slate-800 mb-2">No suppliers found</h2>
                <p className="text-slate-500 mb-6 text-sm">Add a supplier to manage your supply chain</p>
                <Link href="/inventory/suppliers">
                  <Button className="gap-2 px-6 h-11">
                    <Plus className="w-4 h-4" /> Add Supplier
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <div key={s.id} className="px-6 py-3 text-sm flex justify-between">
                    <span className="font-medium text-slate-800">{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Purchase Orders</h2>
          <div className="flex items-center gap-2">
            {businessId && (
              <ScanToInventoryDialog businessId={businessId} suppliers={suppliers} onConfirmed={() => load(businessId)} />
            )}
            <Button
              variant="outline"
              onClick={() => (showPoForm ? closeForm() : openCreate())}
              className="gap-1.5"
            >
              {showPoForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showPoForm ? 'Cancel' : 'New Purchase Order'}
            </Button>
          </div>
        </div>

        {showPoForm && businessId && (
          <PurchaseOrderForm
            businessId={businessId}
            suppliers={suppliers}
            products={products}
            fieldConfig={fieldConfig}
            editingPo={editingPo}
            onSaved={handleSaved}
            onCancel={closeForm}
            onProductCreated={(p) => setProducts((prev) => [...prev, { id: p.id, name: p.name, stock_quantity: 0 }])}
          />
        )}

        {businessId && (
          <PurchaseOrderList
            businessId={businessId}
            purchaseOrders={purchaseOrders}
            suppliers={suppliers}
            fieldConfig={fieldConfig}
            loading={loading}
            onChanged={() => load(businessId)}
            onEdit={openEdit}
            onCreateNew={openCreate}
          />
        )}
      </div>
    </AppShell>
  );
}
