'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Plus, FolderPlus, Tag, Package, Layers, ShieldCheck, TrendingDown, Box, Layers3, Sparkles, Upload } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { fetchBarcodeSuggestion } from '@/lib/barcode-suggestion';
import { AppShell } from '@/components/app-shell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CategoryFilterPills } from '@/components/category-filter-pills';
import { getDefaultItemCategories } from '@/lib/business-modules';
import { getCachedInventoryEnabled, setCachedInventoryEnabled } from '@/lib/auth';
import { ClearModuleButton } from '@/components/clear-module-button';
import { ManualOrScanToggle } from '@/components/manual-or-scan-toggle';
import { CameraScannerView } from '@/components/camera-scanner-view';
import { BulkUploadDialog, type BulkField } from './bulk-upload-dialog';

interface VolumeTier {
  minQty: number;
  price: number;
}

interface Product {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  unit: string;
  selling_price: string | number;
  mrp: string | number | null;
  purchase_price: string | number | null;
  tax_percentage: string | number;
  hsn_code: string | null;
  stock_quantity: number;
  reorder_point: number | null;
  batch_number: string | null;
  expiry_date: string | null;
  description: string | null;
  is_available: boolean;
  is_draft?: boolean;
  moq?: number;
  volume_tiers?: VolumeTier[] | null;
  custom_fields?: Record<string, any> | null;
}

interface Category {
  id: string;
  name: string;
}

interface ProductStats {
  total: number;
  categories: { name: string; count: number }[];
}

// Same pattern as the generic Products list / MenuGrid / PharmacyGrid /
// Orders / Customers pages — load a page at a time instead of the whole
// catalog.
const WHOLESALE_PAGE_SIZE = 20;

const emptyForm = {
  name: '',
  brand: '',
  sku: '',
  barcode: '',
  category: '',
  unit: 'box',
  sellingPrice: '',
  mrp: '',
  purchasePrice: '',
  taxPercentage: '18',
  hsnCode: '',
  stockQuantity: '100',
  reorderPoint: '',
  batchNumber: '',
  expiryDate: '',
  description: '',
  moq: '10',
  volumeTiers: [] as { minQty: string; price: string }[],
};

export function WholesaleGrid({ businessId }: { businessId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState<number | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [inventoryEnabled, setInventoryEnabled] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  // Name of the cross-business barcode suggestion currently applied, so the
  // hint below Name only shows while the user hasn't edited it away.
  const [suggestedName, setSuggestedName] = useState('');

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const isSeeding = useRef(false);

  useEffect(() => {
    if (!businessId) return;
    const cached = getCachedInventoryEnabled(businessId);
    if (cached !== null) setInventoryEnabled(cached);
    apiClient
      .get<{ category: string | null; inventory_enabled: boolean }>(`/api/businesses/${businessId}`)
      .then((res) => {
        setInventoryEnabled(res.data.inventory_enabled);
        setCachedInventoryEnabled(businessId, res.data.inventory_enabled);
      })
      .catch(() => {});
  }, [businessId]);

  const loadData = async (silent = false) => {
    if (!businessId) return;
    if (!silent) setLoading(true);
    try {
      const [prodRes, catRes, statsRes] = await Promise.all([
        apiClient.get<Product[]>('/api/products', {
          params: {
            businessId,
            search: search || undefined,
            isDraft: 'all',
            category: selectedCategory || undefined,
            limit: WHOLESALE_PAGE_SIZE,
            offset: 0,
          },
        }),
        apiClient.get<Category[]>('/api/categories', { params: { businessId } }),
        // Deliberately NOT scoped to selectedCategory — see the generic
        // Products page's identical comment for why.
        apiClient.get<ProductStats>('/api/products/stats', { params: { businessId, search: search || undefined, isDraft: 'all' } }),
      ]);

      setProducts(prodRes.data);
      const totalHeader = prodRes.headers['x-total-count'];
      setTotalProducts(totalHeader ? Number(totalHeader) : prodRes.data.length);
      setLoadedCount(prodRes.data.length);
      setStats(statsRes.data);

      let cats = catRes.data;
      if (cats.length === 0 && !isSeeding.current) {
        isSeeding.current = true;
        const defaults = getDefaultItemCategories('wholesale');
        await Promise.all(
          defaults.map((name) => apiClient.post('/api/categories', { businessId, name }).catch(() => null))
        );
        const freshCatRes = await apiClient.get<Category[]>('/api/categories', { params: { businessId } });
        cats = freshCatRes.data;
      }
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load wholesale products', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!businessId || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await apiClient.get<Product[]>('/api/products', {
        params: {
          businessId,
          search: search || undefined,
          isDraft: 'all',
          category: selectedCategory || undefined,
          limit: WHOLESALE_PAGE_SIZE,
          offset: loadedCount,
        },
      });
      setProducts((prev) => [...prev, ...res.data]);
      setLoadedCount((prev) => prev + res.data.length);
    } catch (err) {
      console.error('Failed to load more wholesale products', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Debounced — search now hits the server (previously 100% client-side
  // over the full loaded array, which would have stopped finding anything
  // outside whatever page happened to be loaded once this list paginates).
  // Category selection shares the same debounced effect. Silent once
  // there's already a loaded list (totalProducts !== null) — otherwise
  // every keystroke/tab click would blank the whole grid to "Loading..."
  // and pop it back a moment later, which reads as a glitch, not a filter.
  useEffect(() => {
    const t = setTimeout(() => loadData(totalProducts !== null), 250);
    return () => clearTimeout(t);
  }, [businessId, search, selectedCategory]);

  const openCreateForm = () => {
    setScanMode(false);
    setSuggestedName('');
    setEditingId(null);
    setForm({ ...emptyForm, category: categories[0]?.name || '' });
    setShowForm(true);
  };

  const openEditForm = (p: Product) => {
    setScanMode(false);
    setSuggestedName('');
    setEditingId(p.id);
    setForm({
      name: p.name,
      brand: p.brand || '',
      sku: p.sku || '',
      barcode: p.barcode || '',
      category: p.category || '',
      unit: p.unit || 'box',
      sellingPrice: String(p.selling_price ?? ''),
      mrp: p.mrp != null ? String(p.mrp) : '',
      purchasePrice: p.purchase_price != null ? String(p.purchase_price) : '',
      taxPercentage: String(p.tax_percentage ?? '18'),
      hsnCode: p.hsn_code || '',
      stockQuantity: String(p.stock_quantity ?? '0'),
      reorderPoint: p.reorder_point != null ? String(p.reorder_point) : '',
      batchNumber: p.batch_number || '',
      expiryDate: p.expiry_date ? p.expiry_date.split('T')[0] : '',
      description: p.description || '',
      moq: String(p.moq ?? '10'),
      volumeTiers: Array.isArray(p.volume_tiers)
        ? p.volume_tiers.map((t) => ({ minQty: String(t.minQty), price: String(t.price) }))
        : [],
    });
    setShowForm(true);
  };

  // A match opens that product for editing right there instead of just
  // filling the barcode field into what might be a different, half-filled
  // item. products is the full unfiltered catalog here (loadData doesn't
  // scope it by the on-screen search box), so a local lookup is reliable.
  const handleBarcodeScan = (code: string) => {
    const match = products.find((p) => p.barcode === code);
    if (match) {
      openEditForm(match);
    } else {
      setForm((f) => ({ ...f, barcode: code }));
      setScanMode(false);
      applyBarcodeSuggestion(code);
    }
  };

  // Barcode unrecognized in this business's own catalog — check whether any
  // other business has already named a product for it (shared_barcode_catalog)
  // and prefill name/price from that, still fully editable.
  const applyBarcodeSuggestion = (code: string) => {
    setSuggestedName('');
    fetchBarcodeSuggestion(code).then((suggestion) => {
      if (!suggestion) return;
      setForm((f) => {
        if (f.barcode !== code || f.name) return f;
        return {
          ...f,
          name: suggestion.name,
          sellingPrice: suggestion.suggestedPrice != null ? String(suggestion.suggestedPrice) : f.sellingPrice,
        };
      });
      setSuggestedName(suggestion.name);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError('');

    const volumeTiers = form.volumeTiers
      .filter((t) => t.minQty.trim() && t.price.trim())
      .map((t) => ({ minQty: Number(t.minQty), price: Number(t.price) }));

    const payload = {
      name: form.name,
      brand: form.brand || undefined,
      sku: form.sku || undefined,
      barcode: form.barcode || undefined,
      category: form.category || undefined,
      unit: form.unit || 'box',
      sellingPrice: Number(form.sellingPrice),
      mrp: form.mrp ? Number(form.mrp) : undefined,
      purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
      taxPercentage: form.taxPercentage ? Number(form.taxPercentage) : 0,
      hsnCode: form.hsnCode || undefined,
      stockQuantity: inventoryEnabled && form.stockQuantity ? Number(form.stockQuantity) : 0,
      reorderPoint: inventoryEnabled && form.reorderPoint ? Number(form.reorderPoint) : undefined,
      batchNumber: form.batchNumber || undefined,
      expiryDate: form.expiryDate || undefined,
      description: form.description || undefined,
      moq: form.moq ? Number(form.moq) : 1,
      volumeTiers: volumeTiers.length > 0 ? volumeTiers : undefined,
    };

    try {
      if (editingId) {
        await apiClient.patch(`/api/products/${editingId}`, payload, { params: { businessId } });
      } else {
        await apiClient.post('/api/products', { businessId, ...payload });
      }
      setShowForm(false);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!businessId) return;
    if (!confirm('Are you sure you want to delete this wholesale item?')) return;
    try {
      await apiClient.delete(`/api/products/${id}`, { params: { businessId } });
      loadData();
    } catch (err) {
      console.error('Failed to delete item', err);
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

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !categoryName.trim()) return;
    try {
      await apiClient.post('/api/categories', { businessId, name: categoryName.trim() });
      setCategoryName('');
      setShowCategoryForm(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create category');
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

  // products is already server-filtered by search AND category (see
  // loadData/loadMore) — no client-side re-filtering, since products only
  // holds however much has been paginated in so far.

  const bulkFields: BulkField[] = [
    { key: 'name', label: 'Product Name', aliases: ['itemname', 'productname'], required: true, width: 'w-32', example: 'Grade A White Sugar (50kg Sack)' },
    { key: 'brand', label: 'Brand', aliases: ['manufacturer'], width: 'w-20', example: 'Fortune' },
    { key: 'category', label: 'Category', suggestions: categories.map((c) => c.name), width: 'w-24', example: 'Grains & Pulses' },
    { key: 'sku', label: 'SKU / Batch Code', aliases: ['batchcode'], width: 'w-24', example: 'WLS-SUG-50K' },
    { key: 'unit', label: 'Packaging Unit', aliases: ['packagingunit'], required: true, width: 'w-20', example: 'sack' },
    { key: 'sellingPrice', label: 'Wholesale Rate', aliases: ['price', 'rate'], type: 'number', required: true, width: 'w-16', example: '1850' },
    { key: 'mrp', label: 'MRP', aliases: ['maxretailprice'], type: 'number', width: 'w-16', example: '2100' },
    { key: 'purchasePrice', label: 'Cost', aliases: ['cost', 'costprice'], type: 'number', width: 'w-16', example: '1620' },
    { key: 'taxPercentage', label: 'GST %', aliases: ['tax', 'gst'], type: 'number', width: 'w-14', example: '5' },
    { key: 'hsnCode', label: 'HSN Code', aliases: ['hsn'], width: 'w-20', example: '1701' },
    { key: 'stockQuantity', label: 'Stock', aliases: ['stock', 'quantity'], type: 'number', width: 'w-16', example: '500' },
    { key: 'moq', label: 'MOQ', aliases: ['minimumorderquantity'], type: 'number', width: 'w-14', example: '10' },
    { key: 'batchNumber', label: 'Batch / Lot #', aliases: ['batch', 'lot'], width: 'w-24', example: 'BATCH-2026-X9' },
  ];

  return (
    <AppShell>
      <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
              <Box className="w-6 h-6 text-amber-600" /> Wholesale & B2B Inventory Matrix
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage bulk stocks, minimum order quantities (MOQ), volume tier pricing, and distributor packaging.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBulkUpload(true)} className="gap-1.5">
              <Upload className="w-4 h-4" /> Bulk Upload
            </Button>
            <Button onClick={openCreateForm} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-md">
              <Plus className="w-4 h-4" /> Add Bulk Product
            </Button>
          </div>
        </div>

        <BulkUploadDialog
          open={showBulkUpload}
          onOpenChange={setShowBulkUpload}
          businessId={businessId}
          entityLabelPlural="Wholesale Products"
          fields={bulkFields}
          onUploaded={loadData}
        />

        {/* Search & Category Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bulk items, brand, SKU code or batch #"
              className="h-11 pl-4 rounded-xl bg-white/70 backdrop-blur-md text-sm ring-1 ring-slate-200"
            />
          </div>
          <Button type="button" variant="outline" className="h-11 gap-1.5 shrink-0" onClick={() => setShowCategoryForm(true)}>
            <FolderPlus className="h-4 w-4" /> Add Category
          </Button>
          {businessId && <ClearModuleButton module="products" businessId={businessId} onCleared={loadData} />}
        </div>

        {/* Category Pills */}
        <CategoryFilterPills
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          totalCount={stats?.total ?? 0}
          countFor={(catName) => stats?.categories.find((c) => c.name === catName)?.count ?? 0}
          onDeleteCategory={deleteCategory}
          onRenameCategory={renameCategory}
        />

        {/* New / Edit Dialog */}
        <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setScanMode(false); }}>
          <DialogContent className={`sm:max-w-[650px] p-6 max-h-[90vh] overflow-y-auto ${scanMode ? 'barcode-scanner-modal bg-transparent' : ''}`}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Box className="w-5 h-5 text-amber-600" /> {editingId ? 'Edit Wholesale Product' : 'New Bulk Product'}
              </DialogTitle>
            </DialogHeader>
            <ManualOrScanToggle scanMode={scanMode} onChange={setScanMode} />
            {scanMode ? (
              <CameraScannerView active={showForm && scanMode} onScan={handleBarcodeScan} />
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Product Name *</label>
                  <Input
                    placeholder="e.g. Grade A White Sugar (50kg Sack) or Sunflower Oil 15L Tin"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                  {suggestedName && form.name === suggestedName && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                      <Sparkles className="w-3.5 h-3.5" /> Suggested from another business — edit if needed
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Brand / Manufacturer</label>
                  <Input placeholder="e.g. Fortune, Tata, Pioneer" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Category</label>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">SKU / Batch Code</label>
                  <Input placeholder="e.g. WLS-SUG-50K" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Barcode</label>
                  <Input placeholder="Tap Scan above, or type the number" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Packaging Unit</label>
                  <Input placeholder="e.g. sack, carton, tin, box, bag, quintal" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">MRP (₹)</label>
                  <Input type="number" placeholder="e.g. 2100" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Standard Wholesale Rate (₹) *</label>
                  <Input type="number" placeholder="e.g. 1850" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Cost / Purchase Price (₹)</label>
                  <Input type="number" placeholder="e.g. 1620" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">GST Tax %</label>
                  <Input type="number" placeholder="e.g. 5, 12, 18" value={form.taxPercentage} onChange={(e) => setForm({ ...form, taxPercentage: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">HSN Code</label>
                  <Input placeholder="e.g. 1701" value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} />
                </div>
                {inventoryEnabled && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Bulk Stock Quantity ({form.unit || 'units'})</label>
                    <Input type="number" placeholder="e.g. 500" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} />
                  </div>
                )}
                {inventoryEnabled && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Reorder Point</label>
                    <Input type="number" placeholder="Default: 10" value={form.reorderPoint} onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })} />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Minimum Order Quantity (MOQ)</label>
                  <Input type="number" placeholder="e.g. 10" value={form.moq} onChange={(e) => setForm({ ...form, moq: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Batch / Lot #</label>
                  <Input placeholder="e.g. BATCH-2026-X9" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
                </div>
              </div>

              {/* Volume Pricing Tiers */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-amber-600" /> Quantity Volume Tier Rates (Optional)
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, volumeTiers: [...form.volumeTiers, { minQty: '', price: '' }] })}
                    className="text-xs font-semibold text-amber-700 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Tier
                  </button>
                </div>
                {form.volumeTiers.map((tier, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min Qty (e.g. 50)"
                      value={tier.minQty}
                      onChange={(e) => {
                        const next = [...form.volumeTiers];
                        next[idx].minQty = e.target.value;
                        setForm({ ...form, volumeTiers: next });
                      }}
                      className="h-9 text-xs flex-1 bg-white"
                    />
                    <Input
                      type="number"
                      placeholder="Special Rate ₹ (e.g. 1750)"
                      value={tier.price}
                      onChange={(e) => {
                        const next = [...form.volumeTiers];
                        next[idx].price = e.target.value;
                        setForm({ ...form, volumeTiers: next });
                      }}
                      className="h-9 text-xs flex-1 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, volumeTiers: form.volumeTiers.filter((_, i) => i !== idx) })}
                      className="p-2 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
                  {saving ? 'Saving...' : 'Save Wholesale Item'}
                </Button>
              </div>
            </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Category Add Modal */}
        <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
          <DialogContent className="sm:max-w-[400px] p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Add Wholesale Category</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCategorySubmit} className="space-y-4 pt-2">
              <Input placeholder="Category Name (e.g. Grains & Pulses, Oils, Spices)" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowCategoryForm(false)}>Cancel</Button>
                <Button type="submit">Save Category</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Products Grid */}
        {loading ? (
          <p className="p-10 text-center text-slate-400 text-sm">Loading wholesale catalog...</p>
        ) : products.length === 0 && !search.trim() && !selectedCategory ? (
          <Card className="p-12 text-center bg-white/60 backdrop-blur-md border-dashed border-amber-300">
            <Box className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">No Wholesale Products Found</h3>
            <p className="text-xs text-slate-500 mb-4">Start by adding your first bulk commodity or wholesale product.</p>
            <Button onClick={openCreateForm} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 mx-auto shadow-md">
              <Plus className="w-4 h-4" /> Add Bulk Product
            </Button>
          </Card>
        ) : products.length === 0 ? (
          <p className="p-10 text-center text-slate-400 text-sm">No products match this search/category.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {products.map((p) => (
              // No backdrop-blur — this renders once per product (up to 50+ in a
              // large catalog), and stacking that many backdrop-filter blurs in a
              // scrolling grid is a well-known cause of scroll jank, especially on
              // Android WebViews. The bg opacity here (80%/70%) already keeps a
              // frosted-enough look without it.
              <Card
                key={p.id}
                className={`relative overflow-hidden ring-1 hover:shadow-lg transition-all border-l-4 backdrop-blur-none ${
                  p.is_available
                    ? 'ring-slate-200/80 bg-white/80 border-l-amber-500'
                    : 'ring-slate-200/60 bg-slate-50/70 border-l-slate-300 grayscale-[0.4] opacity-70'
                }`}
              >
                <CardContent className="p-3 md:p-5 space-y-2.5 md:space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base leading-tight">
                        {p.name}
                        {p.is_draft && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 align-middle">Draft</span>
                        )}
                      </h3>
                      {p.brand && <p className="text-xs font-semibold text-amber-700 mt-0.5">{p.brand}</p>}
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                      {p.category || 'General'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Base Rate</span>
                      <span className="font-bold text-slate-800 text-sm">
                        ₹{Number(p.selling_price).toFixed(2)} <span className="text-xs text-slate-500 font-normal">/ {p.unit}</span>
                      </span>
                      {p.mrp != null && (
                        <span className="block text-[11px] text-slate-400">
                          MRP <span className="line-through">₹{Number(p.mrp).toFixed(2)}</span>
                        </span>
                      )}
                    </div>
                    {p.purchase_price != null && (
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px] uppercase">Purchase Price</span>
                        <span className="font-bold text-slate-700 text-sm">₹{Number(p.purchase_price).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  {inventoryEnabled && (
                    <div className="flex items-center justify-end text-xs">
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px] uppercase">Stock</span>
                        <span className={`font-bold text-sm ${p.stock_quantity <= (p.reorder_point ?? 10) ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {p.stock_quantity} {p.unit}s
                        </span>
                      </div>
                    </div>
                  )}

                  {/* MOQ & Batch Badges */}
                  <div className="flex items-center gap-2 text-[11px] flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> MOQ: {p.moq || 1} {p.unit}s
                    </span>
                    {p.sku && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        SKU: {p.sku}
                      </span>
                    )}
                    {Number(p.tax_percentage) > 0 && (
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        GST {p.tax_percentage}%
                      </span>
                    )}
                  </div>

                  {/* Volume Tiers Table */}
                  {Array.isArray(p.volume_tiers) && p.volume_tiers.length > 0 && (
                    <div className="p-2 rounded-lg bg-amber-50/60 border border-amber-200/50 text-[11px] space-y-1">
                      <span className="font-bold text-amber-900 block text-[10px] uppercase">Volume Discounts:</span>
                      <div className="grid grid-cols-2 gap-1 text-amber-950 font-medium">
                        {p.volume_tiers.map((t, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{t.minQty}+ {p.unit}s:</span>
                            <span className="font-bold text-amber-700">₹{Number(t.price).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => toggleAvailability(p)}
                      disabled={togglingId === p.id}
                      className="flex items-center gap-1.5 disabled:opacity-50"
                      title={p.is_available ? 'Active — click to mark inactive/discontinued' : 'Inactive — click to reactivate'}
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
                    <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditForm(p)} className="h-8 px-2 text-xs gap-1 text-slate-600 hover:text-slate-800">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="h-8 px-2 text-xs gap-1 text-rose-600 hover:bg-rose-50">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {totalProducts !== null && loadedCount < totalProducts && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full h-11 rounded-2xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 text-sm font-semibold text-slate-600 hover:bg-white/55 disabled:opacity-60 transition-colors"
          >
            {loadingMore ? 'Loading…' : `Load more (${totalProducts - loadedCount} older)`}
          </button>
        )}
      </div>
    </AppShell>
  );
}
