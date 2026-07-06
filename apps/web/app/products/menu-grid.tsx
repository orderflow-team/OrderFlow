import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Plus, FolderPlus, Tag } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { AppShell } from '@/components/app-shell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CategoryFilterPills } from '@/components/category-filter-pills';
import { getCachedBusinessCategory } from '@/lib/auth';
import { getDefaultItemCategories } from '@/lib/business-modules';

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

interface Category {
  id: string;
  name: string;
}

export function MenuGrid({ businessId }: { businessId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const isSeeding = useRef(false);

  const categoryStr = getCachedBusinessCategory(businessId);
  const isRestaurant = categoryStr === 'restaurant';

  // Form states
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');

  // Item form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    sellingPrice: '',
    category: '',
    isAvailable: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiClient.get<Product[]>('/api/products', { params: { businessId, search } }),
        apiClient.get<Category[]>('/api/categories', { params: { businessId } }),
      ]);
      setProducts(prodRes.data.filter(p => p.name !== 'Table Session Started'));
      const uniqueCategories = (data: Category[]) => {
        const seen = new Set();
        return data.filter(c => {
          if (seen.has(c.name)) return false;
          seen.add(c.name);
          return true;
        });
      };

      if (catRes.data.length === 0 && !isSeeding.current) {
        isSeeding.current = true;
        // Seed default categories
        const defaults = getDefaultItemCategories(categoryStr);
        if (defaults.length > 0) {
          await Promise.all(
            defaults.map(name => apiClient.post('/api/categories', { businessId, name }).catch(() => null))
          );
        }
        const newCatRes = await apiClient.get<Category[]>('/api/categories', { params: { businessId } });
        setCategories(uniqueCategories(newCatRes.data));
      } else {
        setCategories(uniqueCategories(catRes.data));
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
      description: form.description || undefined,
      sellingPrice: Number(form.sellingPrice),
      category: form.category || undefined,
      isAvailable: form.isAvailable,
      unit: 'piece',
      taxPercentage: 0,
      stockQuantity: 0,
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
      description: p.description || '',
      sellingPrice: String(p.selling_price),
      category: p.category || '',
      isAvailable: p.is_available,
    });
    setShowItemForm(true);
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm({ name: '', description: '', sellingPrice: '', category: '', isAvailable: true });
    setShowItemForm(true);
  };

  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category === selectedCategory)
    : products;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">{isRestaurant ? 'Menu' : 'Products'}</h1>
          <p className="text-slate-500 font-medium mt-1">{isRestaurant ? 'Manage your menu items and categories' : 'Manage your products and categories'}</p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <Input 
              className="pl-9 h-11" 
              placeholder={isRestaurant ? "Search menu items..." : "Search products..."} 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select 
              className="h-11 rounded-full bg-white/40 backdrop-blur-md ring-1 ring-white/50 px-3 text-sm min-w-[140px]"
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
            >
              <option value="">All categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <Button variant="outline" className="h-11 gap-1.5" onClick={() => setShowCategoryForm(!showCategoryForm)}>
              <FolderPlus className="h-4 w-4" /> Category
            </Button>
            <Button className="h-11 gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Item
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
                <Input className="h-11" value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="e.g. Starters" required />
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/40">
                <Button type="button" variant="ghost" onClick={() => setShowCategoryForm(false)}>Cancel</Button>
                <Button type="submit" className="">Save Category</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Item Form Dialog */}
        <Dialog open={showItemForm} onOpenChange={setShowItemForm}>
          <DialogContent className="sm:max-w-[500px] p-6">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-xl">{editingItem ? (isRestaurant ? 'Edit Menu Item' : 'Edit Product') : (isRestaurant ? 'Add Menu Item' : 'Add Product')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleItemSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Name</label>
                <Input className="h-11" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Price (₹)</label>
                <Input className="h-11" type="number" value={form.sellingPrice} onChange={e => setForm({...form, sellingPrice: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Category</label>
                <select 
                  className="w-full h-11 rounded-full bg-white/40 backdrop-blur-md ring-1 ring-white/50 px-3 text-sm"
                  value={form.category}
                  onChange={(e) => setForm({...form, category: e.target.value})}
                >
                  <option value="">None</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <Input className="h-11" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="e.g. Aromatic lamb curry with Kashmiri spices" />
              </div>
              <div className="md:col-span-2 flex items-center gap-2 mt-2 bg-white/30 backdrop-blur-sm p-3 rounded-xl ring-1 ring-white/40">
                <input 
                  type="checkbox" 
                  id="avail" 
                  checked={form.isAvailable} 
                  onChange={e => setForm({...form, isAvailable: e.target.checked})} 
                  className="h-4 w-4 text-emerald-600 rounded border-slate-300"
                />
                <label htmlFor="avail" className="text-sm font-medium text-slate-700">Item is available for ordering</label>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-white/40">
                <Button type="button" variant="ghost" onClick={() => setShowItemForm(false)}>Cancel</Button>
                <Button type="submit" className="px-6">
                  {editingItem ? 'Update Item' : 'Save Item'}
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

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(p => (
            <Card key={p.id} className="overflow-hidden hover:ring-emerald-300/50 transition-all flex flex-col group">
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-800 text-lg leading-tight">{p.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold backdrop-blur-sm ${
                    p.is_available ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20' : 'bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/20'
                  }`}>
                    {p.is_available ? 'Available' : 'Sold Out'}
                  </span>
                </div>
                <div className="text-2xl font-extrabold text-emerald-600 mb-2">
                  ₹{Number(p.selling_price).toFixed(2)}
                </div>
                {p.description && (
                  <p className="text-sm text-slate-500 mb-4 flex-1 line-clamp-2">{p.description}</p>
                )}
                <div className="mt-auto pt-4 border-t border-white/40">
                  <div className="flex items-center justify-between mb-4">
                    {p.category && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-white/40 backdrop-blur-sm ring-1 ring-white/50 px-2 py-1 rounded-full">
                        <Tag className="w-3 h-3" /> {p.category}
                      </span>
                    )}
                  </div>
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
          ))}
          {filteredProducts.length === 0 && !loading && (
            <div className="col-span-full py-12 text-center text-slate-400">
              No menu items found.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
