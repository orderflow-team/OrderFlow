'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { ClearModuleButton } from '@/components/clear-module-button';
import apiClient from '@/lib/api-client';
import { getCachedBusinessCategory } from '@/lib/auth';
import { getOptionalModulesForCategory } from '@/lib/business-modules';
import { useBusiness } from '@/lib/use-business';
import { Plus, Trash2, Package, Search, ChevronRight, Tag } from 'lucide-react';
import { MenuGrid } from './menu-grid';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  selling_price: string | number;
  purchase_price: string | number | null;
  tax_percentage: string | number;
  stock_quantity: number;
  is_draft?: boolean;
  description: string | null;
  is_available: boolean;
  category: string | null;
}

const emptyForm = { name: '', sku: '', unit: '', sellingPrice: '', purchasePrice: '', taxPercentage: '', stockQuantity: '', description: '', isAvailable: true, category: '' };

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const { businessId, ready } = useBusiness();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const category = businessId ? getCachedBusinessCategory(businessId) : null;
  const isRestaurant = getOptionalModulesForCategory(category).includes('restaurant');

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowForm(true);
  }, [searchParams]);

  const entityName = 'Product';
  const entityNamePlural = 'Products';

  const load = async (bizId: string, q?: string) => {
    setLoading(true);
    try {
      const res = await apiClient.get<Product[]>('/api/products', { params: { businessId: bizId, search: q, isDraft: 'all' } });
      setProducts(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to load ${entityNamePlural.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isRestaurant || !ready || !businessId) return;
    const t = setTimeout(() => load(businessId, search), 250);
    return () => clearTimeout(t);
  }, [search, ready, businessId, isRestaurant]);

  if (isRestaurant && businessId) {
    return <MenuGrid businessId={businessId} />;
  }

  const openCreateForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm((s) => (editingId ? true : !s));
  };

  const openEditForm = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku || '',
      unit: p.unit,
      sellingPrice: String(p.selling_price ?? ''),
      purchasePrice: p.purchase_price != null ? String(p.purchase_price) : '',
      taxPercentage: String(p.tax_percentage ?? ''),
      stockQuantity: String(p.stock_quantity ?? ''),
      description: p.description || '',
      isAvailable: p.is_available ?? true,
      category: p.category || '',
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
      sku: form.sku || undefined,
      unit: form.unit || undefined,
      sellingPrice: Number(form.sellingPrice),
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
      taxPercentage: form.taxPercentage ? Number(form.taxPercentage) : undefined,
      stockQuantity: form.stockQuantity ? Number(form.stockQuantity) : undefined,
      description: form.description || undefined,
      isAvailable: form.isAvailable,
      category: form.category || undefined,
    };
    try {
      if (editingId) {
        await apiClient.patch(`/api/products/${editingId}`, payload, { params: { businessId } });
      } else {
        await apiClient.post('/api/products', { businessId, ...payload });
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      load(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to save ${entityName.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!businessId) return;
    await apiClient.delete(`/api/products/${id}`, { params: { businessId } });
    load(businessId);
  };

  if (!ready) return null;

  const commonUnits = ['kg', 'gram', 'litre', 'ml', 'piece', 'packet', 'box', 'dozen', 'carton', 'pallet', 'strip', 'bottle', 'vial', 'tube', 'roll', 'bundle', 'pair', 'set', 'meter', 'inch'];
  const existingUnits = products.map((p) => p.unit).filter(Boolean);
  const availableUnits = Array.from(new Set([...commonUnits, ...existingUnits]));

  return (
    <AppShell>
      <div className="p-4 md:p-10 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">{entityNamePlural}</h1>
          {!showForm && (
            <Button onClick={openCreateForm} className="gap-1.5 bg-tile-lavender-fg hover:brightness-95 text-white">
              <Plus className="w-4 h-4" /> Add {entityName}
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full h-11 pl-10 pr-4 rounded-full bg-white ring-1 ring-slate-200/70 shadow-sm text-sm placeholder:text-slate-400 outline-none focus:ring-tile-lavender-fg/40"
            />
          </div>
          {businessId && <ClearModuleButton module="products" businessId={businessId} />}
        </div>

        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          {`Total: ${products.length} • Recent`}
        </p>

        {showForm && (
          <Card className="ring-white/50 glass-sheen-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{editingId ? `Edit ${entityName}` : `New ${entityName}`}</CardTitle>
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
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="sm:col-span-2"
                />
                <Input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                <input 
                  placeholder="Unit (e.g. 350 ml, kg...)" 
                  value={form.unit} 
                  onChange={(e) => setForm({ ...form, unit: e.target.value })} 
                  list="unit-options"
                  className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                />
                <datalist id="unit-options">
                  {availableUnits.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
                <Input
                  placeholder="Selling price"
                  type="number"
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                  required
                />
                <Input
                  placeholder="Purchase price"
                  type="number"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                />
                <Input
                  placeholder="GST tax %"
                  type="number"
                  value={form.taxPercentage}
                  onChange={(e) => setForm({ ...form, taxPercentage: e.target.value })}
                />
                <Input
                  placeholder="Opening stock"
                  type="number"
                  value={form.stockQuantity}
                  onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                />
                {error && <p className="text-sm text-rose-600 sm:col-span-3">{error}</p>}
                <div className="sm:col-span-3 flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : editingId ? `Update ${entityName}` : `Save ${entityName}`}
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
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl ring-1 ring-slate-200/70">
            <div className="w-24 h-24 bg-tile-lavender rounded-full flex items-center justify-center mb-6">
              <Package className="w-10 h-10 text-tile-lavender-fg" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">No {entityNamePlural.toLowerCase()} found</h2>
            <p className="text-slate-500 mb-8 text-sm">Add items to create a new {entityName.toLowerCase()}</p>
            <Button onClick={() => setShowForm(true)} className="bg-tile-lavender-fg hover:brightness-95 text-white gap-2 px-6 h-11 shadow-sm">
              <Plus className="w-4 h-4" /> New {entityName}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((p) => {
              const stockTone =
                p.stock_quantity === 0 ? 'bg-rose-50 text-rose-600' : p.stock_quantity <= 10 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500';
              return (
                <div key={p.id} className="flex items-center gap-3 bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-3.5">
                  <button onClick={() => openEditForm(p)} className="flex-1 flex items-center gap-3 min-w-0 text-left">
                    <div className="w-11 h-11 rounded-xl bg-tile-lavender-fg text-white flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 text-sm truncate">
                        {p.name}
                        {p.unit ? ` (${p.unit})` : ''}
                        {p.is_draft && (
                          <span className="ml-2 inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 align-middle">Draft</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1">
                        <Tag className="w-3 h-3 shrink-0" />
                        {`Base Price ₹${Number(p.selling_price).toFixed(2)}${p.unit ? ` / ${p.unit}` : ''}`}
                      </p>
                    </div>
                  </button>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${stockTone}`}>{p.stock_quantity} left</span>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-slate-300 hover:text-rose-600 shrink-0 transition-colors" aria-label="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

    </AppShell>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500">Loading...</div>}>
      <ProductsPageContent />
    </Suspense>
  );
}

