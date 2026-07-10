import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Plus, FolderPlus, Tag, ShieldAlert, CalendarClock } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { AppShell } from '@/components/app-shell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CategoryFilterPills } from '@/components/category-filter-pills';
import { getDefaultItemCategories } from '@/lib/business-modules';
import { getCachedInventoryEnabled, setCachedInventoryEnabled } from '@/lib/auth';

interface Product {
  id: string;
  name: string;
  brand: string | null;
  generic_name: string | null;
  unit: string;
  selling_price: string | number;
  purchase_price: string | number | null;
  stock_quantity: number;
  batch_number: string | null;
  expiry_date: string | null;
  description: string | null;
  is_available: boolean;
  prescription_required: boolean;
  category: string | null;
}

interface Category {
  id: string;
  name: string;
}

function expiryStatus(dateStr: string | null) {
  if (!dateStr) return null;
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: 'Expired', tone: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20' };
  if (days <= 60) return { label: `Expires in ${days}d`, tone: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20' };
  return {
    label: `Exp ${new Date(dateStr).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}`,
    tone: 'bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/20',
  };
}

export function PharmacyGrid({ businessId }: { businessId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const isSeeding = useRef(false);
  const [inventoryEnabled, setInventoryEnabled] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    const cached = getCachedInventoryEnabled(businessId);
    if (cached !== null) {
      setInventoryEnabled(cached);
    }
    apiClient
      .get<{ category: string | null; inventory_enabled: boolean }>(`/api/businesses/${businessId}`)
      .then((res) => {
        setInventoryEnabled(res.data.inventory_enabled);
        setCachedInventoryEnabled(businessId, res.data.inventory_enabled);
      })
      .catch(() => {});
  }, [businessId]);

  // Form states
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');

  const emptyForm = {
    name: '',
    brand: '',
    genericName: '',
    category: '',
    unit: '',
    sellingPrice: '',
    purchasePrice: '',
    stockQuantity: '',
    batchNumber: '',
    expiryDate: '',
    prescriptionRequired: false,
    isAvailable: true,
    description: '',
  };
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiClient.get<Product[]>('/api/products', { params: { businessId, search } }),
        apiClient.get<Category[]>('/api/categories', { params: { businessId } }),
      ]);
      const fetchedProducts = prodRes.data;
      setProducts(fetchedProducts);
      const extractCategories = (data: Category[]) => {
        const seen = new Set<string>();
        const result: Category[] = [];
        for (const c of data) {
          if (!seen.has(c.name)) {
            seen.add(c.name);
            result.push(c);
          }
        }
        for (const p of fetchedProducts) {
          if (p.category && !seen.has(p.category)) {
            seen.add(p.category);
            result.push({ id: `cat-${p.category}`, name: p.category });
          }
        }
        return result;
      };

      if (catRes.data.length === 0 && !isSeeding.current) {
        isSeeding.current = true;
        const defaults = getDefaultItemCategories('pharmacy');
        if (defaults.length > 0) {
          await Promise.all(
            defaults.map((name) => apiClient.post('/api/categories', { businessId, name }).catch(() => null)),
          );
        }
        const newCatRes = await apiClient.get<Category[]>('/api/categories', { params: { businessId } });
        setCategories(extractCategories(newCatRes.data));
      } else {
        setCategories(extractCategories(catRes.data));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) loadData();
  }, [businessId, search]);

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/api/categories', { businessId, name: categoryName });
      setCategoryName('');
      setShowCategoryForm(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await apiClient.delete(`/api/categories/${id}`, { params: { businessId } });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      businessId,
      name: form.name,
      brand: form.brand || undefined,
      genericName: form.genericName || undefined,
      category: form.category || undefined,
      unit: form.unit || undefined,
      sellingPrice: Number(form.sellingPrice),
      purchasePrice: inventoryEnabled && form.purchasePrice ? Number(form.purchasePrice) : undefined,
      stockQuantity: inventoryEnabled && form.stockQuantity ? Number(form.stockQuantity) : 0,
      batchNumber: form.batchNumber || undefined,
      expiryDate: form.expiryDate || undefined,
      prescriptionRequired: form.prescriptionRequired,
      isAvailable: form.isAvailable,
      description: form.description || undefined,
      taxPercentage: 0,
    };

    try {
      if (editingItem) {
        await apiClient.patch(`/api/products/${editingItem.id}`, payload, { params: { businessId } });
      } else {
        await apiClient.post('/api/products', payload);
      }
      setShowItemForm(false);
      setEditingItem(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await apiClient.delete(`/api/products/${id}`, { params: { businessId } });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (p: Product) => {
    setEditingItem(p);
    setForm({
      name: p.name,
      brand: p.brand || '',
      genericName: p.generic_name || '',
      category: p.category || '',
      unit: p.unit || '',
      sellingPrice: String(p.selling_price),
      purchasePrice: p.purchase_price != null ? String(p.purchase_price) : '',
      stockQuantity: String(p.stock_quantity ?? ''),
      batchNumber: p.batch_number || '',
      expiryDate: p.expiry_date ? p.expiry_date.slice(0, 10) : '',
      prescriptionRequired: p.prescription_required,
      isAvailable: p.is_available,
      description: p.description || '',
    });
    setShowItemForm(true);
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setShowItemForm(true);
  };

  const filteredProducts = selectedCategory ? products.filter((p) => p.category === selectedCategory) : products;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Medicines</h1>
          <p className="text-slate-500 font-medium mt-1">Manage your medicine inventory, batches & expiry</p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <Input
              className="pl-9 h-11"
              placeholder="Search medicines..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 gap-1.5" onClick={() => setShowCategoryForm(!showCategoryForm)}>
              <FolderPlus className="h-4 w-4" /> Category
            </Button>
            <Button className="h-11 gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Medicine
            </Button>
          </div>
        </div>

        {/* Category Form Dialog */}
        <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
          <DialogContent className="sm:max-w-[400px] p-6">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-xl">Add New Category</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Category Name</label>
                <Input className="h-11" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="e.g. Diabetic Care" required />
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/40">
                <Button type="button" variant="ghost" onClick={() => setShowCategoryForm(false)}>Cancel</Button>
                <Button type="submit">Save Category</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Item Form Dialog */}
        <Dialog open={showItemForm} onOpenChange={setShowItemForm}>
          <DialogContent className="sm:max-w-[560px] p-6 max-h-[85vh] overflow-y-auto">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-xl">{editingItem ? 'Edit Medicine' : 'Add Medicine'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleItemSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Medicine Name</label>
                <Input className="h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Crocin Advance" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Manufacturer</label>
                <Input className="h-11" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="e.g. GSK" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Generic Name / Composition</label>
                <Input className="h-11" value={form.genericName} onChange={(e) => setForm({ ...form, genericName: e.target.value })} placeholder="e.g. Paracetamol 500mg" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Category</label>
                <select
                  className="w-full h-11 rounded-full bg-white/40 backdrop-blur-md ring-1 ring-white/50 px-3 text-sm"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Pack Size</label>
                <Input className="h-11" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. 10 tablets/strip, 100ml bottle" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">MRP (₹)</label>
                <Input className="h-11" type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} required />
              </div>
              {inventoryEnabled && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Purchase Price (₹)</label>
                  <Input className="h-11" type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
                </div>
              )}
              {inventoryEnabled && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Stock Quantity</label>
                  <Input className="h-11" type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Batch Number</label>
                <Input className="h-11" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} placeholder="e.g. CR2024A" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Expiry Date</label>
                <Input className="h-11" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Usage / Dosage Notes</label>
                <Input className="h-11" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Take 1 tablet twice daily after food" />
              </div>
              <div className="md:col-span-2 flex items-center gap-2 mt-1 bg-white/30 backdrop-blur-sm p-3 rounded-xl ring-1 ring-white/40">
                <input
                  type="checkbox"
                  id="rx"
                  checked={form.prescriptionRequired}
                  onChange={(e) => setForm({ ...form, prescriptionRequired: e.target.checked })}
                  className="h-4 w-4 text-rose-600 rounded border-slate-300"
                />
                <label htmlFor="rx" className="text-sm font-medium text-slate-700">Requires a doctor's prescription (Rx)</label>
              </div>
              <div className="md:col-span-2 flex items-center gap-2 bg-white/30 backdrop-blur-sm p-3 rounded-xl ring-1 ring-white/40">
                <input
                  type="checkbox"
                  id="avail"
                  checked={form.isAvailable}
                  onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })}
                  className="h-4 w-4 text-emerald-600 rounded border-slate-300"
                />
                <label htmlFor="avail" className="text-sm font-medium text-slate-700">In stock / available for sale</label>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 mt-2 pt-4 border-t border-white/40">
                <Button type="button" variant="ghost" onClick={() => setShowItemForm(false)}>Cancel</Button>
                <Button type="submit" className="px-6">
                  {editingItem ? 'Update Medicine' : 'Save Medicine'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Categories Tabs */}
        <CategoryFilterPills
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          totalCount={products.length}
          countFor={(name) => products.filter((p) => p.category === name).length}
          onDeleteCategory={deleteCategory}
        />

        {/* Medicine Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const expiry = expiryStatus(p.expiry_date);
            return (
              <Card key={p.id} className="overflow-hidden hover:ring-emerald-300/50 transition-all flex flex-col group">
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <h3 className="font-bold text-slate-800 text-lg leading-tight">{p.name}</h3>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold backdrop-blur-sm ${
                      p.is_available ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20' : 'bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/20'
                    }`}>
                      {p.is_available ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>
                  {(p.brand || p.generic_name) && (
                    <p className="text-xs text-slate-500 mb-2">
                      {p.brand}{p.brand && p.generic_name ? ' • ' : ''}{p.generic_name}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                      p.prescription_required ? 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20' : 'bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/20'
                    }`}>
                      <ShieldAlert className="w-3 h-3" /> {p.prescription_required ? 'Rx Required' : 'OTC'}
                    </span>
                    {expiry && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${expiry.tone}`}>
                        <CalendarClock className="w-3 h-3" /> {expiry.label}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 py-3 my-1 border-y border-white/40">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Price</p>
                      <p className="font-bold text-emerald-600 text-sm">
                        ₹{Number(p.selling_price).toFixed(2)}{p.unit ? <span className="text-slate-400 font-medium"> / {p.unit}</span> : null}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Stock</p>
                      <p className="font-semibold text-slate-700 text-sm">{p.stock_quantity} units</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Batch</p>
                      <p className="font-medium text-slate-600 text-sm truncate">{p.batch_number || '—'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Category</p>
                      <p className="font-medium text-slate-600 text-sm truncate flex items-center gap-1">
                        {p.category ? <><Tag className="w-3 h-3 shrink-0" /> {p.category}</> : '—'}
                      </p>
                    </div>
                  </div>
                  {p.description && (
                    <p className="text-sm text-slate-500 mb-2 flex-1 line-clamp-2">{p.description}</p>
                  )}
                  <div className="mt-auto pt-2">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs font-semibold" onClick={() => openEdit(p)}>
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10" onClick={() => deleteItem(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredProducts.length === 0 && !loading && (
            <div className="col-span-full py-12 text-center text-slate-400">
              No medicines found.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
