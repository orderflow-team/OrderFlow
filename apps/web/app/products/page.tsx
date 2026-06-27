'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { ClearModuleButton } from '@/components/clear-module-button';
import apiClient from '@/lib/api-client';
import { getCachedBusinessCategory } from '@/lib/auth';
import { getOptionalModulesForCategory } from '@/lib/business-modules';
import { useBusiness } from '@/lib/use-business';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
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
  description: string | null;
  is_available: boolean;
  category: string | null;
}

const emptyForm = { name: '', sku: '', unit: 'piece', sellingPrice: '', purchasePrice: '', taxPercentage: '', stockQuantity: '', description: '', isAvailable: true, category: '' };

export default function ProductsPage() {
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

  const entityName = 'Product';
  const entityNamePlural = 'Products';

  const load = async (bizId: string, q?: string) => {
    setLoading(true);
    try {
      const res = await apiClient.get<Product[]>('/api/products', { params: { businessId: bizId, search: q } });
      setProducts(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to load ${entityNamePlural.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isRestaurant && ready && businessId) load(businessId);
  }, [ready, businessId, isRestaurant]);

  if (isRestaurant && businessId) {
    return <MenuGrid businessId={businessId} />;
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (businessId) load(businessId, search);
  };

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
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
        <PageHeader
          title={entityNamePlural}
          description="Product master is optional — orders work fine without it too."
          action={
            <div className="flex gap-2">
              {businessId && <ClearModuleButton module="products" businessId={businessId} />}
              <Button onClick={openCreateForm} className="gap-1.5">
                <Plus className="w-4 h-4" />
                {showForm && !editingId ? 'Cancel' : `Add ${entityName}`}
              </Button>
            </div>
          }
        />

        {showForm && (
          <Card className="ring-slate-200/70 shadow-sm shadow-slate-200/40">
            <CardHeader>
              <CardTitle className="text-base">{editingId ? `Edit ${entityName}` : `New ${entityName}`}</CardTitle>
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
                  placeholder="Unit (kg, piece, packet...)" 
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

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input placeholder="Search by name, SKU, barcode" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit" variant="outline">Search</Button>
        </form>

        <Card className="ring-slate-200/70 shadow-sm shadow-slate-200/40">
          <CardContent className="p-0">
            {loading ? (
              <p className="p-10 text-center text-slate-400 text-sm">Loading...</p>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Package className="w-10 h-10 text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">No {entityNamePlural.toLowerCase()} found</h2>
                <p className="text-slate-500 mb-8 text-sm">Add items to create a new {entityName.toLowerCase()}</p>
                <Button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6 h-11 shadow-sm">
                  <Plus className="w-4 h-4" /> New {entityName}
                </Button>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 bg-slate-50/50">
                {products.map((p) => (
                  <Card key={p.id} className="relative group overflow-hidden border-slate-200 hover:border-emerald-300 transition-all hover:shadow-md bg-white">
                    <CardContent className="p-4 flex flex-col h-full">
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-lg p-1 backdrop-blur-sm shadow-sm">
                        <button
                          onClick={() => openEditForm(p)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="flex-1 mt-2">
                        <h3 className="font-bold text-slate-800 line-clamp-2 leading-snug">{p.name}</h3>
                        {p.sku && <p className="text-xs font-mono text-slate-400 mt-1">{p.sku}</p>}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-end justify-between gap-2">
                        <div>
                          <div className="text-emerald-600 font-black text-lg">
                            ${Number(p.selling_price).toFixed(2)}
                          </div>
                          {p.unit && <div className="text-xs font-medium text-slate-400">per {p.unit}</div>}
                        </div>
                        <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            p.stock_quantity <= 10 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {p.stock_quantity} left
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
