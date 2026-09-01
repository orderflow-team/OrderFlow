'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { ClearModuleButton } from '@/components/clear-module-button';
import { CategoryFilterPills } from '@/components/category-filter-pills';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import apiClient from '@/lib/api-client';
import { getCachedBusinessCategory, getCachedInventoryEnabled, setCachedInventoryEnabled } from '@/lib/auth';
import { getOptionalModulesForCategory, getDefaultItemCategories } from '@/lib/business-modules';
import { useBusiness } from '@/lib/use-business';
import { canonicalUnitKey } from '@/lib/parse-quantity-unit';
import { ManualOrScanToggle } from '@/components/manual-or-scan-toggle';
import { CameraScannerView } from '@/components/camera-scanner-view';
import { Plus, Trash2, Package, Search, ChevronRight, Tag, FolderPlus, Upload } from 'lucide-react';
import { MenuGrid } from './menu-grid';
import { PharmacyGrid } from './pharmacy-grid';
import { WholesaleGrid } from './wholesale-grid';
import { BulkUploadDialog, type BulkField } from './bulk-upload-dialog';
import { useSubscription } from '@/lib/use-subscription';
import { LockedFeatureModal } from '@/components/locked-feature-badge';
import { Lock } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  selling_price: string | number;
  purchase_price: string | number | null;
  tax_percentage: string | number;
  stock_quantity: number;
  reorder_point: number | null;
  is_draft?: boolean;
  description: string | null;
  is_available: boolean;
  category: string | null;
  unit_prices?: Record<string, number> | null;
}

interface Category {
  id: string;
  name: string;
}

const emptyForm = { name: '', sku: '', unit: '', sellingPrice: '', purchasePrice: '', taxPercentage: '', stockQuantity: '', reorderPoint: '', description: '', isAvailable: true, category: '', unitPrices: [] as { unit: string; price: string }[] };

// A business's catalog grows unbounded over time — fetching and rendering
// all of it up front doesn't scale. Load a page at a time instead, same
// pattern as Orders (generic-orders.tsx) and Customers.
const PRODUCTS_PAGE_SIZE = 20;

interface ProductStats {
  total: number;
  categories: { name: string; count: number }[];
}

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const { businessId, ready } = useBusiness();
  const [products, setProducts] = useState<Product[]>([]);
  // The real count matching the current search (from X-Total-Count),
  // distinct from products.length once pagination means products only
  // holds however much has been loaded so far.
  const [totalProducts, setTotalProducts] = useState<number | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const isSeedingCategories = useRef(false);

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showBulkLockedModal, setShowBulkLockedModal] = useState(false);
  const { isStarter, isTrial } = useSubscription();
  const isFeatureLocked = isStarter && !isTrial;

  const category = businessId ? getCachedBusinessCategory(businessId) : null;
  const isRestaurant = getOptionalModulesForCategory(category).includes('restaurant');
  const isPharmacy = category === 'pharmacy';
  const isWholesale = category === 'wholesale';
  const [inventoryEnabled, setInventoryEnabled] = useState(true);
  const [customFieldSchema, setCustomFieldSchema] = useState<{ name: string; type: string }[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!ready || !businessId) return;
    const cached = getCachedInventoryEnabled(businessId);
    if (cached !== null) {
      setInventoryEnabled(cached);
    }
    apiClient
      .get<{ category: string | null; inventory_enabled: boolean; customSettings?: any }>(`/api/businesses/${businessId}`)
      .then((res) => {
        setInventoryEnabled(res.data.inventory_enabled);
        setCachedInventoryEnabled(businessId, res.data.inventory_enabled);
        const settings = res.data.customSettings;
        const schema = settings?.productCustomFields || settings?.customFields || [];
        setCustomFieldSchema(schema);
      })
      .catch(() => {});
  }, [ready, businessId]);

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowForm(true);
  }, [searchParams]);

  useEffect(() => {
    const handleOpen = () => {
      setEditingId(null);
      setForm(emptyForm);
      setShowForm(true);
    };
    window.addEventListener('open-new-form', handleOpen);
    return () => window.removeEventListener('open-new-form', handleOpen);
  }, []);

  const entityName = 'Product';
  const entityNamePlural = 'Products';

  const load = async (bizId: string, q?: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        apiClient.get<Product[]>('/api/products', {
          params: {
            businessId: bizId,
            search: q,
            isDraft: 'all',
            category: selectedCategory || undefined,
            limit: PRODUCTS_PAGE_SIZE,
            offset: 0,
          },
        }),
        // Deliberately NOT scoped to selectedCategory — the category tabs
        // need every category's count for the CURRENT search, regardless of
        // which one happens to be selected right now, so switching tabs
        // shows accurate counts for the others too.
        apiClient.get<ProductStats>('/api/products/stats', { params: { businessId: bizId, search: q, isDraft: 'all' } }),
      ]);
      setProducts(res.data);
      const totalHeader = res.headers['x-total-count'];
      setTotalProducts(totalHeader ? Number(totalHeader) : res.data.length);
      setLoadedCount(res.data.length);
      setStats(statsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to load ${entityNamePlural.toLowerCase()}`);
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
          limit: PRODUCTS_PAGE_SIZE,
          offset: loadedCount,
        },
      });
      setProducts((prev) => [...prev, ...res.data]);
      setLoadedCount((prev) => prev + res.data.length);
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to load more ${entityNamePlural.toLowerCase()}`);
    } finally {
      setLoadingMore(false);
    }
  };

  // One debounced effect covers the initial load, every search keystroke,
  // AND every category tab click — category filtering used to be a
  // client-side .filter() over the full loaded array (see the old
  // filteredProducts below), which silently missed matches once the list
  // itself is paginated instead of loading everything. Silent once
  // there's already a loaded list (totalProducts !== null) — otherwise
  // every keystroke/tab click would blank the whole list to "Loading..."
  // and pop it back a moment later, which reads as a glitch, not a filter.
  useEffect(() => {
    if (isRestaurant || isPharmacy || !ready || !businessId) return;
    const t = setTimeout(() => load(businessId, search, totalProducts !== null), 250);
    return () => clearTimeout(t);
  }, [search, selectedCategory, ready, businessId, isRestaurant, isPharmacy]);

  const loadCategories = async (bizId: string, currentProducts: Product[]) => {
    try {
      const catRes = await apiClient.get<Category[]>('/api/categories', { params: { businessId: bizId } });
      const extractCategories = (apiCats: Category[], prods: Product[]) => {
        const seen = new Set<string>();
        const result: Category[] = [];
        for (const c of apiCats) {
          if (!seen.has(c.name)) {
            seen.add(c.name);
            result.push(c);
          }
        }
        for (const p of prods) {
          if (p.category && !seen.has(p.category)) {
            seen.add(p.category);
            result.push({ id: `cat-${p.category}`, name: p.category });
          }
        }
        return result;
      };

      const unique = extractCategories(catRes.data, currentProducts);
      
      if (catRes.data.length === 0 && !isSeedingCategories.current) {
        isSeedingCategories.current = true;
        const defaults = getDefaultItemCategories(getCachedBusinessCategory(bizId));
        if (defaults.length > 0) {
          await Promise.all(defaults.map((name) => apiClient.post('/api/categories', { businessId: bizId, name }).catch(() => null)));
          const seeded = await apiClient.get<Category[]>('/api/categories', { params: { businessId: bizId } });
          setCategories(extractCategories(seeded.data, currentProducts));
          return;
        }
      }
      setCategories(unique);
    } catch {
      // categories are optional for non-restaurant business types; ignore failures
    }
  };

  useEffect(() => {
    if (isRestaurant || isPharmacy || !ready || !businessId) return;
    loadCategories(businessId, products);
  }, [ready, businessId, isRestaurant, isPharmacy, products]);

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    try {
      await apiClient.post('/api/categories', { businessId, name: categoryName });
      setCategoryName('');
      setShowCategoryForm(false);
      loadCategories(businessId, products);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!businessId) return;
    if (!confirm('Delete this category? Products in it will keep their other data, just lose this category tag.')) return;
    try {
      await apiClient.delete(`/api/categories/${id}`, { params: { businessId } });
      loadCategories(businessId, products);
    } catch (err) {
      console.error(err);
    }
  };

  const renameCategory = async (id: string, name: string) => {
    if (!businessId) return;
    try {
      await apiClient.patch(`/api/categories/${id}`, { name }, { params: { businessId } });
      loadCategories(businessId, products);
    } catch (err) {
      console.error(err);
    }
  };

  if (isRestaurant && businessId) {
    return <MenuGrid businessId={businessId} />;
  }

  if (isPharmacy && businessId) {
    return <PharmacyGrid businessId={businessId} />;
  }

  if (isWholesale && businessId) {
    return <WholesaleGrid businessId={businessId} />;
  }

  const openCreateForm = () => {
    setScanMode(false);
    setEditingId(null);
    setForm(emptyForm);
    setCustomFieldValues({});
    setShowForm(true);
  };

  const openEditForm = (p: Product & { custom_fields?: Record<string, any> }) => {
    setScanMode(false);
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku || '',
      unit: p.unit,
      sellingPrice: String(p.selling_price ?? ''),
      purchasePrice: p.purchase_price != null ? String(p.purchase_price) : '',
      taxPercentage: String(p.tax_percentage ?? ''),
      stockQuantity: String(p.stock_quantity ?? ''),
      reorderPoint: p.reorder_point != null ? String(p.reorder_point) : '',
      description: p.description || '',
      isAvailable: p.is_available ?? true,
      category: p.category || '',
      unitPrices: p.unit_prices
        ? Object.entries(p.unit_prices).map(([unit, price]) => ({ unit, price: String(price) }))
        : [],
    });
    setCustomFieldValues(p.custom_fields || {});
    setShowForm(true);
  };

  // A match opens that product for editing right there instead of just
  // filling the SKU field into what might be a different, half-filled item.
  // products here can be scoped by the on-screen search box, so look up
  // fresh against the scanned code rather than trusting local state.
  const handleBarcodeScan = (code: string) => {
    apiClient
      .get<Product[]>('/api/products', { params: { businessId, search: code, isDraft: 'all' } })
      .then((res) => {
        const match = res.data.find((p) => p.sku === code);
        if (match) {
          openEditForm(match);
        } else {
          setForm((f) => ({ ...f, sku: code }));
          setScanMode(false);
        }
      })
      .catch(() => {
        setForm((f) => ({ ...f, sku: code }));
        setScanMode(false);
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError('');
    const unitPrices: Record<string, number> = {};
    for (const row of form.unitPrices) {
      if (row.unit.trim() && row.price !== '') {
        unitPrices[canonicalUnitKey(row.unit.trim())] = Number(row.price);
      }
    }
    const payload = {
      name: form.name,
      sku: form.sku || undefined,
      unit: form.unit || undefined,
      sellingPrice: Number(form.sellingPrice),
      purchasePrice: inventoryEnabled && form.purchasePrice ? Number(form.purchasePrice) : undefined,
      taxPercentage: form.taxPercentage ? Number(form.taxPercentage) : undefined,
      stockQuantity: inventoryEnabled && form.stockQuantity ? Number(form.stockQuantity) : undefined,
      reorderPoint: inventoryEnabled && form.reorderPoint ? Number(form.reorderPoint) : undefined,
      description: form.description || undefined,
      isAvailable: form.isAvailable,
      category: form.category || undefined,
      unitPrices: Object.keys(unitPrices).length > 0 ? unitPrices : undefined,
      customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
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
      load(businessId, search);
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to save ${entityName.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!businessId) return;
    if (!confirm(`Delete this ${entityName.toLowerCase()}? This can't be undone.`)) return;
    await apiClient.delete(`/api/products/${id}`, { params: { businessId } });
    load(businessId, search);
  };

  if (!ready) return null;

  const commonUnits = ['kg', 'gram', 'litre', 'ml', 'piece', 'packet', 'box', 'dozen', 'carton', 'pallet', 'strip', 'bottle', 'vial', 'tube', 'roll', 'bundle', 'pair', 'set', 'meter', 'inch'];
  const existingUnits = products.map((p) => p.unit).filter(Boolean);
  const availableUnits = Array.from(new Set([...commonUnits, ...existingUnits]));
  // products is already server-filtered by search AND category (see
  // load/loadMore) — no client-side re-filtering, and importantly none
  // SHOULD happen, since products only holds however much has been
  // paginated in so far.

  const bulkFields: BulkField[] = [
    { key: 'name', label: 'Name', aliases: ['productname', 'itemname'], required: true, width: 'w-28', example: 'Fresh Toned Milk 1L' },
    { key: 'sku', label: 'SKU', aliases: ['barcode'], width: 'w-20', example: 'MILK-1L' },
    { key: 'unit', label: 'Unit', suggestions: availableUnits, width: 'w-16', example: 'litre' },
    { key: 'category', label: 'Category', suggestions: categories.map((c) => c.name), width: 'w-24', example: 'Dairy & Bakery' },
    { key: 'sellingPrice', label: 'Price', aliases: ['price', 'mrp', 'rate'], type: 'number', required: true, width: 'w-16', example: '60' },
    { key: 'purchasePrice', label: 'Cost', aliases: ['cost', 'costprice'], type: 'number', width: 'w-16', example: '50' },
    { key: 'taxPercentage', label: 'Tax %', aliases: ['tax', 'gst'], type: 'number', width: 'w-14', example: '5' },
    { key: 'stockQuantity', label: 'Stock', aliases: ['stock', 'quantity', 'openingstock'], type: 'number', width: 'w-14', example: '100' },
    { key: 'description', label: 'Description', width: 'w-32', example: 'Farm fresh toned milk' },
  ];

  return (
    <AppShell>
      <div className="p-4 md:p-10 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">{entityNamePlural}</h1>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 relative"
              onClick={() => {
                if (isFeatureLocked) {
                  setShowBulkLockedModal(true);
                } else {
                  setShowBulkUpload(true);
                }
              }}
            >
              <Upload className="w-4 h-4" />
              <span>Bulk Upload</span>
              {isFeatureLocked && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ml-0.5 border border-amber-300">
                  <Lock className="w-2.5 h-2.5" /> PRO
                </span>
              )}
            </Button>
            <Button onClick={openCreateForm} className="gap-1.5 bg-tile-lavender-fg hover:brightness-95 text-white">
              <Plus className="w-4 h-4" /> Add {entityName}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                category === 'restaurant'
                  ? 'Search starters, main course, dishes or drinks...'
                  : category === 'grocery'
                  ? 'Search fruits, vegetables, dairy or items...'
                  : category === 'pharmacy'
                  ? 'Search medicines, tablets, syrups or healthcare...'
                  : category === 'retail'
                  ? 'Search clothing, accessories, items or SKU...'
                  : category === 'wholesale'
                  ? 'Search bulk goods, sacks, or batch code...'
                  : 'Search products, items, SKU, or categories...'
              }
              className="w-full h-11 pl-10 pr-4 rounded-full bg-white/40 backdrop-blur-md ring-1 ring-white/50 glass-sheen-sm text-sm placeholder:text-slate-400 outline-none focus:ring-tile-lavender-fg/40"
            />
          </div>
          <Button type="button" variant="outline" className="h-11 gap-1.5 shrink-0" onClick={() => setShowCategoryForm(true)}>
            <FolderPlus className="h-4 w-4" /> Category
          </Button>
          {businessId && <ClearModuleButton module="products" businessId={businessId} onCleared={() => load(businessId, search)} />}
        </div>

        <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
          <DialogContent className="sm:max-w-[400px] p-6">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-xl">Add New Category</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Category Name</label>
                <Input className="h-11" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="e.g. Dairy & Bakery" required />
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/40">
                <Button type="button" variant="ghost" onClick={() => setShowCategoryForm(false)}>Cancel</Button>
                <Button type="submit">Save Category</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <BulkUploadDialog
          open={showBulkUpload}
          onOpenChange={setShowBulkUpload}
          businessId={businessId || ''}
          entityLabelPlural={entityNamePlural}
          fields={bulkFields}
          onUploaded={() => { load(businessId!, search); loadCategories(businessId!, products); }}
        />

        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          {`Total: ${stats?.total ?? totalProducts ?? 0} • Recent`}
        </p>

        <Dialog
          open={showForm}
          onOpenChange={(open) => {
            setShowForm(open);
            setScanMode(false);
            if (!open) {
              setEditingId(null);
              setForm(emptyForm);
            }
          }}
        >
          <DialogContent className={`sm:max-w-[650px] max-h-[85vh] overflow-y-auto p-6 ${scanMode ? 'barcode-scanner-modal bg-transparent' : ''}`}>
            <DialogHeader>
              <DialogTitle className="text-xl">{editingId ? `Edit ${entityName}` : `New ${entityName}`}</DialogTitle>
            </DialogHeader>
            <ManualOrScanToggle scanMode={scanMode} onChange={setScanMode} />
            {scanMode ? (
              <CameraScannerView active={showForm && scanMode} onScan={handleBarcodeScan} />
            ) : (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <Input
                  placeholder={
                    category === 'restaurant'
                      ? 'Dish Name (e.g. Paneer Butter Masala)'
                      : category === 'grocery'
                      ? 'Item Name (e.g. Fresh Toned Milk 1L)'
                      : category === 'pharmacy'
                      ? 'Medicine Name (e.g. Paracetamol 500mg)'
                      : category === 'retail'
                      ? 'Product Name (e.g. Cotton Formal Shirt)'
                      : category === 'wholesale'
                      ? 'Bulk Item Name (e.g. Grade A Sugar 50kg Sack)'
                      : 'Item / Service / Product Name'
                  }
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="sm:col-span-2"
                />
                <Input placeholder="SKU / Barcode Code" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                <input 
                  placeholder={category === 'restaurant' ? 'Unit (e.g. plate, bowl)' : 'Unit (e.g. kg, pcs, pack)'} 
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
                {inventoryEnabled && (
                  <Input
                    placeholder="Purchase price"
                    type="number"
                    value={form.purchasePrice}
                    onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                  />
                )}
                <Input
                  placeholder="GST tax %"
                  type="number"
                  value={form.taxPercentage}
                  onChange={(e) => setForm({ ...form, taxPercentage: e.target.value })}
                />
                {inventoryEnabled && (
                  <Input
                    placeholder="Opening stock"
                    type="number"
                    value={form.stockQuantity}
                    onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                  />
                )}
                {inventoryEnabled && (
                  <Input
                    placeholder="Reorder point (default 10)"
                    type="number"
                    value={form.reorderPoint}
                    onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })}
                  />
                )}
                <select
                  className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>

                <div className="sm:col-span-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500">
                    Saved prices for other units (optional) — e.g. a fixed price for 1kg instead of auto-converting from {form.unit || 'the base unit'}
                  </p>
                  {form.unitPrices.map((row, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        placeholder="Unit (e.g. 1kg)"
                        value={row.unit}
                        list="unit-options"
                        onChange={(e) => {
                          const next = [...form.unitPrices];
                          next[i] = { ...next[i], unit: e.target.value };
                          setForm({ ...form, unitPrices: next });
                        }}
                        className="h-8 flex-1 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      />
                      <Input
                        placeholder="Price"
                        type="number"
                        value={row.price}
                        onChange={(e) => {
                          const next = [...form.unitPrices];
                          next[i] = { ...next[i], price: e.target.value };
                          setForm({ ...form, unitPrices: next });
                        }}
                        className="h-8 w-28"
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, unitPrices: form.unitPrices.filter((_, idx) => idx !== i) })}
                        className="p-1.5 text-slate-300 hover:text-rose-600 shrink-0"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, unitPrices: [...form.unitPrices, { unit: '', price: '' }] })}
                    className="text-xs font-medium text-tile-lavender-fg hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add price for another unit
                  </button>
                </div>

                {customFieldSchema.length > 0 && (
                  <div className="sm:col-span-3 space-y-2.5 pt-2 border-t border-slate-200/60">
                    <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-600" /> Custom Product Attributes
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {customFieldSchema.map((field) => (
                        <div key={field.name} className="space-y-1">
                          <label className="text-xs font-medium text-slate-600">{field.name}</label>
                          {field.type === 'boolean' ? (
                            <select
                              value={customFieldValues[field.name] ? 'true' : 'false'}
                              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.name]: e.target.value === 'true' })}
                              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-xs outline-none"
                            >
                              <option value="false">No</option>
                              <option value="true">Yes</option>
                            </select>
                          ) : (
                            <Input
                              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                              placeholder={`Enter ${field.name}...`}
                              value={customFieldValues[field.name] || ''}
                              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.name]: e.target.value })}
                              className="h-9 text-xs"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
            )}
          </DialogContent>
        </Dialog>

        {loading ? (
          <p className="p-10 text-center text-slate-400 text-sm">Loading...</p>
        ) : products.length === 0 && !search.trim() && !selectedCategory ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm">
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
            <CategoryFilterPills
              categories={categories}
              selectedCategory={selectedCategory}
              onSelect={setSelectedCategory}
              totalCount={stats?.total ?? 0}
              countFor={(name) => stats?.categories.find((c) => c.name === name)?.count ?? 0}
              onDeleteCategory={deleteCategory}
              onRenameCategory={renameCategory}
            />
            {products.map((p) => {
              const stockTone =
                p.stock_quantity === 0 ? 'bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20' : p.stock_quantity <= (p.reorder_point ?? 10) ? 'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20' : 'bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/20';
              return (
                // No backdrop-blur here — renders once per product (up to 50), and
                // stacking many backdrop-filter blurs in a scrolling list is a
                // well-known cause of scroll jank, especially on Android WebViews.
                // bg-white/70 (higher opacity, no blur) keeps a similar frosted
                // look without the per-frame cost.
                <div key={p.id} className="flex items-center gap-3 bg-white/70 rounded-2xl ring-1 ring-white/50 glass-sheen-sm shadow-sm p-3.5">
                  <button onClick={() => openEditForm(p)} className="flex-1 flex items-center gap-3 min-w-0 text-left">
                    <div className="w-11 h-11 rounded-xl bg-tile-lavender-fg text-white flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 text-sm truncate">
                        {p.name}
                        {p.unit ? ` (${p.unit})` : ''}
                        {p.is_draft && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 align-middle">Draft</span>
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
            {products.length === 0 && (
              <p className="py-12 text-center text-slate-400 text-sm">No {entityNamePlural.toLowerCase()} match this search/category.</p>
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
        )}
      </div>

      <LockedFeatureModal
        isOpen={showBulkLockedModal}
        onClose={() => setShowBulkLockedModal(false)}
        featureName="Bulk Excel Product Upload"
        requiredPlan="Pro"
        description="Bulk Excel import is available exclusively on the Pro Plan (₹399/mo). Upgrade today to import thousands of products instantly with automated column mapping."
      />
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

