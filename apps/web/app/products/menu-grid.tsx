import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Plus, FolderPlus, Tag, Coffee, Upload } from 'lucide-react';
import apiClient, { toAbsoluteFileUrl } from '@/lib/api-client';
import { AppShell } from '@/components/app-shell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CategoryFilterPills } from '@/components/category-filter-pills';
import { getCachedBusinessCategory } from '@/lib/auth';
import { getDefaultItemCategories } from '@/lib/business-modules';
import { ScanBarcodeButton } from '@/components/scan-barcode-button';
import { BulkUploadDialog, type BulkField } from './bulk-upload-dialog';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  selling_price: string | number;
  purchase_price: string | number | null;
  tax_percentage: string | number;
  stock_quantity: number;
  description: string | null;
  is_available: boolean;
  category: string | null;
  image_url?: string | null;
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
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const isSeeding = useRef(false);

  const categoryStr = getCachedBusinessCategory(businessId);
  const isRestaurant = categoryStr === 'restaurant';

  // Form states
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  // Item form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    sellingPrice: '',
    category: '',
    imageUrl: '',
    isAvailable: true,
    barcode: '',
  });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post<{ url: string }>('/api/products/upload', formData, {
        params: { businessId },
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setForm(prev => ({ ...prev, imageUrl: res.data.url }));
    } catch (err: any) {
      console.error(err);
      setUploadError(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiClient.get<Product[]>('/api/products', { params: { businessId, search } }),
        apiClient.get<Category[]>('/api/categories', { params: { businessId } }),
      ]);
      const fetchedProducts = prodRes.data.filter(p => p.name !== 'Table Session Started');
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
        // Seed default categories
        const defaults = getDefaultItemCategories(categoryStr);
        if (defaults.length > 0) {
          await Promise.all(
            defaults.map(name => apiClient.post('/api/categories', { businessId, name }).catch(() => null))
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

  const renameCategory = async (id: string, name: string) => {
    try {
      await apiClient.patch(`/api/categories/${id}`, { name }, { params: { businessId } });
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
      imageUrl: form.imageUrl || undefined,
      sellingPrice: Number(form.sellingPrice),
      category: form.category || undefined,
      isAvailable: form.isAvailable,
      barcode: form.barcode || undefined,
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

  const toggleAvailability = async (p: Product) => {
    if (!businessId || togglingId) return;
    const next = !p.is_available;
    setTogglingId(p.id);
    setProducts((prev) => prev.map((item) => (item.id === p.id ? { ...item, is_available: next } : item)));
    try {
      await apiClient.patch(`/api/products/${p.id}`, { isAvailable: next }, { params: { businessId } });
    } catch (err) {
      console.error('Failed to update availability', err);
      setProducts((prev) => prev.map((item) => (item.id === p.id ? { ...item, is_available: !next } : item)));
    } finally {
      setTogglingId(null);
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
      imageUrl: p.image_url || '',
      isAvailable: p.is_available,
      barcode: p.barcode || '',
    });
    setUploading(false);
    setUploadError('');
    setShowItemForm(true);
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm({ name: '', description: '', sellingPrice: '', category: '', imageUrl: '', isAvailable: true, barcode: '' });
    setUploading(false);
    setUploadError('');
    setShowItemForm(true);
  };

  // Camera scan: an existing barcode opens that item for editing, an unknown
  // one opens a blank form with the barcode already filled in.
  const handleBarcodeScan = (code: string) => {
    const match = products.find((p) => p.barcode === code);
    if (match) {
      openEdit(match);
    } else {
      setEditingItem(null);
      setForm({ name: '', description: '', sellingPrice: '', category: '', imageUrl: '', isAvailable: true, barcode: code });
      setUploading(false);
      setUploadError('');
      setShowItemForm(true);
    }
  };

  useEffect(() => {
    const handleOpen = () => {
      openCreate();
    };
    window.addEventListener('open-new-form', handleOpen);
    return () => window.removeEventListener('open-new-form', handleOpen);
  }, []);

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category === selectedCategory)
    : products;

  const bulkFields: BulkField[] = [
    { key: 'name', label: 'Name', aliases: ['itemname', 'dishname', 'productname'], required: true, width: 'w-32', example: 'Paneer Butter Masala' },
    { key: 'sellingPrice', label: 'Price', aliases: ['price', 'mrp', 'rate'], type: 'number', required: true, width: 'w-16', example: '250' },
    { key: 'category', label: 'Category', suggestions: categories.map(c => c.name), width: 'w-28', example: 'Main Course' },
    { key: 'description', label: 'Description', width: 'w-40', example: 'Aromatic paneer curry with Kashmiri spices' },
    { key: 'isAvailable', label: 'Available', aliases: ['available'], type: 'boolean', width: 'w-20' },
  ];

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">{isRestaurant ? 'Menu' : 'Products'}</h1>
          <p className="text-slate-500 font-medium mt-1">{isRestaurant ? 'Manage your menu items and categories' : 'Manage your products and categories'}</p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <Input
              className="pl-9 h-11 w-full"
              placeholder={isRestaurant ? "Search menu items..." : "Search products..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11 gap-1.5" onClick={() => setShowCategoryForm(!showCategoryForm)}>
              <FolderPlus className="h-4 w-4" /> Category
            </Button>
            <Button variant="outline" className="h-11 gap-1.5" onClick={() => setShowBulkUpload(true)}>
              <Upload className="h-4 w-4" /> Bulk Upload
            </Button>
            <ScanBarcodeButton onScan={handleBarcodeScan} />
            <Button className="h-11 gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>
        </div>

        <BulkUploadDialog
          open={showBulkUpload}
          onOpenChange={setShowBulkUpload}
          businessId={businessId}
          entityLabelPlural={isRestaurant ? 'Menu Items' : 'Products'}
          fields={bulkFields}
          staticPayload={{ unit: 'piece', taxPercentage: 0, stockQuantity: 0 }}
          onUploaded={loadData}
        />

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
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Barcode</label>
                <Input className="h-11" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} placeholder="Scan with Scan Barcode, or type the number" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <Input
                  className="h-11"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={
                    categoryStr === 'restaurant'
                      ? 'e.g. Aromatic lamb curry with Kashmiri spices'
                      : categoryStr === 'grocery'
                      ? 'e.g. Fresh organic farm apples, 1 kg pack'
                      : categoryStr === 'pharmacy'
                      ? 'e.g. Paracetamol 500mg tablets, strip of 10'
                      : categoryStr === 'retail'
                      ? 'e.g. Premium 100% cotton slim fit formal shirt'
                      : categoryStr === 'wholesale'
                      ? 'e.g. Bulk 50kg grain sack, Grade A quality'
                      : 'e.g. Premium quality item details, specifications & warranty'
                  }
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Product Image</label>
                <div className="flex flex-col gap-2">
                  {form.imageUrl ? (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden border bg-slate-50 group/preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={toAbsoluteFileUrl(form.imageUrl) ?? undefined}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, imageUrl: '' }))}
                        className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1.5 shadow-md transition-colors"
                        title="Remove Image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-colors relative">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload}
                        disabled={uploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400 mb-2 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span className="text-xs font-semibold text-slate-600">
                        {uploading ? 'Uploading...' : 'Upload from Device'}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">PNG, JPG, WEBP up to 5MB</span>
                    </div>
                  )}
                  {uploadError && <p className="text-xs text-rose-600 font-medium">{uploadError}</p>}
                </div>
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
          onRenameCategory={renameCategory}
        />

        {/* Product Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filteredProducts.map(p => (
            <Card key={p.id} className="relative overflow-hidden group flex flex-col justify-end p-0 py-0 gap-0 rounded-3xl min-h-[340px] ring-1 ring-white/40 hover:ring-emerald-300/60 shadow-md hover:shadow-xl transition-all duration-300">
              {/* Full-bleed photo background */}
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toAbsoluteFileUrl(p.image_url) ?? undefined}
                  alt={p.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 via-teal-50 to-slate-100 flex items-center justify-center">
                  <Coffee className="w-14 h-14 text-emerald-300/60 stroke-[1.5]" />
                </div>
              )}

              {/* Scrim so badges & glass panel always stay readable */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent pointer-events-none" />

              {/* Top badges */}
              <div className="absolute top-2 inset-x-2 md:top-3 md:inset-x-3 flex items-start justify-between gap-1 z-10">
                {p.category ? (
                  <span className="inline-flex items-center gap-1 min-w-0 text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white bg-black/30 backdrop-blur-md ring-1 ring-white/30 px-2 md:px-2.5 py-1 rounded-full shadow-sm">
                    <Tag className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{p.category}</span>
                  </span>
                ) : <span />}
                <span className={`px-2 md:px-2.5 py-1 rounded-full text-[9px] md:text-[10px] font-bold tracking-wide whitespace-nowrap shrink-0 backdrop-blur-md ring-1 ring-white/30 shadow-sm ${
                  p.is_available ? 'bg-emerald-500/80 text-white' : 'bg-slate-700/80 text-white'
                }`}>
                  {p.is_available ? 'Available' : 'Sold Out'}
                </span>
              </div>

              {/* Frosted glass info panel */}
              <div className="relative z-10 m-2 md:m-3 rounded-2xl bg-white/70 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/60 shadow-lg p-3 md:p-4 space-y-1.5 md:space-y-2">
                <div className="flex flex-col gap-0.5 md:flex-row md:items-start md:justify-between md:gap-2">
                  <h3 className="font-extrabold text-slate-900 text-sm md:text-base leading-tight truncate">{p.name}</h3>
                  <div className="text-base md:text-lg font-black text-emerald-700 whitespace-nowrap shrink-0">
                    ₹{Number(p.selling_price).toFixed(2)}
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-normal line-clamp-2 min-h-[2.25rem]">
                  {p.description || <span className="text-slate-400 italic">No description provided.</span>}
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => toggleAvailability(p)}
                    disabled={togglingId === p.id}
                    className="flex items-center gap-1.5 disabled:opacity-50 self-start"
                    title={p.is_available ? 'Active — click to mark sold out' : 'Sold out — click to reactivate'}
                  >
                    <span
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        p.is_available ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                          p.is_available ? 'translate-x-[18px]' : 'translate-x-1'
                        }`}
                      />
                    </span>
                    <span className={`text-[11px] font-semibold ${p.is_available ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {p.is_available ? 'Active' : 'Inactive'}
                    </span>
                  </button>
                  <div className="flex gap-1.5 md:gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1 md:gap-1.5 h-8 px-1 md:px-2 text-[11px] md:text-xs font-semibold bg-white/60 hover:bg-white/90" onClick={() => openEdit(p)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-1 md:gap-1.5 h-8 px-1 md:px-2 text-[11px] md:text-xs font-semibold bg-white/60 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10" onClick={() => deleteItem(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              </div>
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
