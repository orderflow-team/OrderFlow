import { useState, useEffect, useRef, Fragment } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Plus, FolderPlus, Tag, ShieldAlert, CalendarClock, ScanBarcode, Truck, Upload, Sparkles, ChevronDown, ChevronRight, PackageMinus, Search } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { fetchBarcodeSuggestion } from '@/lib/barcode-suggestion';
import { AppShell } from '@/components/app-shell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CategoryFilterPills } from '@/components/category-filter-pills';
import { getDefaultItemCategories } from '@/lib/business-modules';
import { getCachedInventoryEnabled, setCachedInventoryEnabled } from '@/lib/auth';
import { useBarcodeScanner } from '@/lib/use-barcode-scanner';
import { vibrateScanSuccess } from '@/lib/haptics';
import { ManualOrScanToggle } from '@/components/manual-or-scan-toggle';
import { CameraScannerView } from '@/components/camera-scanner-view';
import { expiryStatus } from '@/lib/expiry-status';
import { BulkUploadDialog, type BulkField } from './bulk-upload-dialog';

interface Product {
  id: string;
  name: string;
  brand: string | null;
  generic_name: string | null;
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
  prescription_required: boolean;
  is_schedule_h1: boolean;
  category: string | null;
  barcode: string | null;
  last_supplier?: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

interface Batch {
  id: string;
  batch_number: string | null;
  expiry_date: string | null;
  quantity: string | number;
  initial_quantity: string | number;
  received_at: string;
}

interface TraceOrder {
  order_id: string;
  order_number: string;
  order_date: string;
  order_status: string;
  customer_name: string;
  customer_phone: string | null;
  custom_product_name: string | null;
  quantity_from_batch: string | number;
}

interface ProductStats {
  total: number;
  categories: { name: string; count: number }[];
}

// Same pattern as the generic Products list / MenuGrid / Orders /
// Customers pages — load a page at a time instead of the whole catalog.
const PHARMACY_PAGE_SIZE = 50;

export function PharmacyGrid({ businessId }: { businessId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState<number | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState<ProductStats | null>(null);
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
  const [scanMode, setScanMode] = useState(false);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Per-product batch cache (lazy-loaded on expand or on opening Edit), plus
  // which card currently has its batch list expanded.
  const [batchesByProduct, setBatchesByProduct] = useState<Record<string, Batch[]>>({});
  const [loadingBatchesFor, setLoadingBatchesFor] = useState<string | null>(null);
  const [expandedBatchesFor, setExpandedBatchesFor] = useState<string | null>(null);
  const [editingBatches, setEditingBatches] = useState<Batch[]>([]);
  const [writeOffFor, setWriteOffFor] = useState<string | null>(null);
  const [writeOffQty, setWriteOffQty] = useState('');
  const [writeOffReason, setWriteOffReason] = useState<'expired' | 'damaged' | 'other'>('expired');
  const [returnFor, setReturnFor] = useState<string | null>(null);
  const [returnQty, setReturnQty] = useState('');
  const [returnReason, setReturnReason] = useState<'expired' | 'damaged' | 'wrong_item' | 'other'>('expired');
  const [returnUnitPrice, setReturnUnitPrice] = useState('');
  const [returnError, setReturnError] = useState('');

  // Recall lookup: which orders/customers received a given batch.
  const [traceFor, setTraceFor] = useState<string | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceOrders, setTraceOrders] = useState<TraceOrder[]>([]);

  const loadBatches = async (productId: string): Promise<Batch[]> => {
    if (batchesByProduct[productId]) return batchesByProduct[productId];
    setLoadingBatchesFor(productId);
    try {
      const res = await apiClient.get<Batch[]>(`/api/inventory/products/${productId}/batches`, { params: { businessId } });
      setBatchesByProduct((prev) => ({ ...prev, [productId]: res.data }));
      return res.data;
    } catch (err) {
      console.error('Failed to load batches', err);
      return [];
    } finally {
      setLoadingBatchesFor(null);
    }
  };

  const toggleBatches = async (productId: string) => {
    if (expandedBatchesFor === productId) {
      setExpandedBatchesFor(null);
      return;
    }
    setExpandedBatchesFor(productId);
    await loadBatches(productId);
  };

  const submitWriteOff = async (productId: string, batchId: string) => {
    const qty = Number(writeOffQty);
    if (!qty || qty <= 0) return;
    try {
      await apiClient.post('/api/inventory/adjust', {
        businessId,
        productId,
        batchId,
        type: 'OUT',
        quantity: qty,
        reason: writeOffReason,
        notes: 'Batch write-off',
      });
      setWriteOffFor(null);
      setWriteOffQty('');
      setBatchesByProduct((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      await loadBatches(productId);
      loadData();
    } catch (err) {
      console.error('Failed to write off batch', err);
    }
  };

  const submitReturnToSupplier = async (product: Product, batchId: string) => {
    const qty = Number(returnQty);
    if (!qty || qty <= 0) return;
    if (!product.last_supplier) {
      setReturnError('No supplier on record for this medicine — receive a Purchase Order from a supplier first.');
      return;
    }
    setReturnError('');
    try {
      await apiClient.post('/api/inventory/supplier-returns', {
        businessId,
        supplierId: product.last_supplier.id,
        productId: product.id,
        batchId,
        quantity: qty,
        unitPrice: returnUnitPrice ? Number(returnUnitPrice) : Number(product.purchase_price ?? 0),
        reason: returnReason,
      });
      setReturnFor(null);
      setReturnQty('');
      setReturnUnitPrice('');
      setBatchesByProduct((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      await loadBatches(product.id);
      loadData();
    } catch (err: any) {
      setReturnError(err.response?.data?.message || 'Failed to record supplier return');
    }
  };

  const toggleTrace = async (batchId: string) => {
    if (traceFor === batchId) {
      setTraceFor(null);
      return;
    }
    setTraceFor(batchId);
    setTraceLoading(true);
    try {
      const res = await apiClient.get<{ orders: TraceOrder[] }>(`/api/inventory/batches/${batchId}/orders`, { params: { businessId } });
      setTraceOrders(res.data.orders);
    } catch (err) {
      console.error('Failed to trace batch', err);
      setTraceOrders([]);
    } finally {
      setTraceLoading(false);
    }
  };

  const emptyForm = {
    name: '',
    brand: '',
    genericName: '',
    category: '',
    unit: '',
    sellingPrice: '',
    mrp: '',
    purchasePrice: '',
    taxPercentage: '12',
    hsnCode: '',
    stockQuantity: '',
    reorderPoint: '',
    batchNumber: '',
    expiryDate: '',
    barcode: '',
    prescriptionRequired: false,
    isScheduleH1: false,
    description: '',
  };
  const [form, setForm] = useState(emptyForm);
  // Name of the cross-business suggestion currently applied to the form (if
  // any), so the hint below the Medicine Name field only shows while the
  // user hasn't edited it away.
  const [suggestedName, setSuggestedName] = useState('');

  // Transient feedback for barcode scans; fixed-position so it never shifts layout.
  const [scanToast, setScanToast] = useState<{ text: string; tone: 'ok' | 'new' } | null>(null);
  const scanToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showScanToast = (text: string, tone: 'ok' | 'new') => {
    if (scanToastTimer.current) clearTimeout(scanToastTimer.current);
    setScanToast({ text, tone });
    scanToastTimer.current = setTimeout(() => setScanToast(null), 3500);
  };
  useEffect(() => () => { if (scanToastTimer.current) clearTimeout(scanToastTimer.current); }, []);

  // Shared by both scan input methods: a USB/Bluetooth scanner-gun (works on
  // web and native, via useBarcodeScanner below) and the device camera (native
  // only, via the Manual/Scan toggle inside the item dialog below).
  const handleBarcodeScan = (code: string) => {
    vibrateScanSuccess();
    // With the medicine form already open (the in-dialog Scan tab), a match
    // opens that medicine for editing right there instead of just filling
    // the barcode field into what might be a different, half-filled item.
    if (showItemForm) {
      apiClient
        .get<Product[]>('/api/products', { params: { businessId, search: code } })
        .then((res) => {
          const match = res.data.find((p) => p.barcode === code);
          if (match) {
            openEdit(match);
            showScanToast(`Found: ${match.name}`, 'ok');
          } else {
            setForm((f) => ({ ...f, barcode: code }));
            setScanMode(false);
            showScanToast(`Barcode captured: ${code}`, 'ok');
            applyBarcodeSuggestion(code);
          }
        })
        .catch(() => {
          setForm((f) => ({ ...f, barcode: code }));
          setScanMode(false);
          showScanToast('Scan lookup failed — barcode filled in anyway', 'new');
        });
      return;
    }
    // Otherwise: look the code up — show the match, or start a new medicine with it.
    apiClient
      .get<Product[]>('/api/products', { params: { businessId, search: code } })
      .then((res) => {
        const match = res.data.find((p) => p.barcode === code) || res.data[0];
        if (match) {
          setSelectedCategory(null);
          setSearch(code);
          showScanToast(`Found: ${match.name}`, 'ok');
        } else {
          setEditingItem(null);
          setForm({ ...emptyForm, barcode: code });
          setShowItemForm(true);
          showScanToast(`New barcode ${code} — add this medicine`, 'new');
          applyBarcodeSuggestion(code);
        }
      })
      .catch(() => showScanToast('Scan lookup failed', 'new'));
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
      showScanToast(`Suggested: ${suggestion.name} (from another business)`, 'new');
    });
  };

  useBarcodeScanner(handleBarcodeScan);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [prodRes, catRes, statsRes] = await Promise.all([
        apiClient.get<Product[]>('/api/products', {
          params: {
            businessId,
            search,
            isDraft: 'all',
            category: selectedCategory || undefined,
            limit: PHARMACY_PAGE_SIZE,
            offset: 0,
          },
        }),
        apiClient.get<Category[]>('/api/categories', { params: { businessId } }),
        // Deliberately NOT scoped to selectedCategory — see the generic
        // Products page's identical comment for why.
        apiClient.get<ProductStats>('/api/products/stats', { params: { businessId, search, isDraft: 'all' } }),
      ]);
      const fetchedProducts = prodRes.data;
      setProducts(fetchedProducts);
      const totalHeader = prodRes.headers['x-total-count'];
      setTotalProducts(totalHeader ? Number(totalHeader) : fetchedProducts.length);
      setLoadedCount(fetchedProducts.length);
      setStats(statsRes.data);
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
      if (!silent) setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await apiClient.get<Product[]>('/api/products', {
        params: {
          businessId,
          search,
          isDraft: 'all',
          category: selectedCategory || undefined,
          limit: PHARMACY_PAGE_SIZE,
          offset: loadedCount,
        },
      });
      setProducts((prev) => [...prev, ...res.data]);
      setLoadedCount((prev) => prev + res.data.length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Silent once there's already a loaded list (totalProducts !== null) —
  // otherwise every keystroke/tab click would blank the whole grid to
  // "Loading..." and pop it back a moment later, which reads as a glitch,
  // not a filter. Only the genuine first load shows the full loading state.
  useEffect(() => {
    if (businessId) loadData(totalProducts !== null);
  }, [businessId, search, selectedCategory]);

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
      brand: form.brand || undefined,
      genericName: form.genericName || undefined,
      category: form.category || undefined,
      unit: form.unit || undefined,
      sellingPrice: Number(form.sellingPrice),
      mrp: form.mrp ? Number(form.mrp) : undefined,
      purchasePrice: inventoryEnabled && form.purchasePrice ? Number(form.purchasePrice) : undefined,
      stockQuantity: inventoryEnabled && form.stockQuantity ? Number(form.stockQuantity) : 0,
      reorderPoint: inventoryEnabled && form.reorderPoint ? Number(form.reorderPoint) : undefined,
      batchNumber: form.batchNumber || undefined,
      expiryDate: form.expiryDate || undefined,
      barcode: form.barcode || undefined,
      prescriptionRequired: form.prescriptionRequired,
      isScheduleH1: form.isScheduleH1,
      description: form.description || undefined,
      taxPercentage: form.taxPercentage ? Number(form.taxPercentage) : 0,
      hsnCode: form.hsnCode || undefined,
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
    if (!confirm("Delete this medicine? This can't be undone.")) return;
    try {
      await apiClient.delete(`/api/products/${id}`, { params: { businessId } });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleAvailability = async (p: Product) => {
    if (togglingId) return;
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

  const openEdit = async (p: Product) => {
    setScanMode(false);
    setSuggestedName('');
    setEditingItem(p);
    setEditingBatches([]);
    setForm({
      name: p.name,
      brand: p.brand || '',
      genericName: p.generic_name || '',
      category: p.category || '',
      unit: p.unit || '',
      sellingPrice: String(p.selling_price),
      mrp: p.mrp != null ? String(p.mrp) : '',
      purchasePrice: p.purchase_price != null ? String(p.purchase_price) : '',
      taxPercentage: String(p.tax_percentage ?? '12'),
      hsnCode: p.hsn_code || '',
      stockQuantity: String(p.stock_quantity ?? ''),
      reorderPoint: p.reorder_point != null ? String(p.reorder_point) : '',
      batchNumber: p.batch_number || '',
      expiryDate: p.expiry_date ? p.expiry_date.slice(0, 10) : '',
      barcode: p.barcode || '',
      prescriptionRequired: p.prescription_required,
      isScheduleH1: p.is_schedule_h1,
      description: p.description || '',
    });
    setShowItemForm(true);
    setEditingBatches(await loadBatches(p.id));
  };

  const openCreate = () => {
    setScanMode(false);
    setSuggestedName('');
    setEditingItem(null);
    setEditingBatches([]);
    setForm(emptyForm);
    setShowItemForm(true);
  };

  // products is already server-filtered by search AND category (see
  // loadData/loadMore) — no client-side re-filtering, since products only
  // holds however much has been paginated in so far.

  const bulkFields: BulkField[] = [
    { key: 'name', label: 'Medicine Name', aliases: ['medicinename', 'itemname', 'productname'], required: true, width: 'w-32', example: 'Crocin Advance' },
    { key: 'brand', label: 'Manufacturer', aliases: ['manufacturer'], width: 'w-24', example: 'GSK' },
    { key: 'genericName', label: 'Generic Name', aliases: ['generic', 'composition'], width: 'w-28', example: 'Paracetamol 500mg' },
    { key: 'category', label: 'Category', suggestions: categories.map((c) => c.name), width: 'w-24', example: 'Pain Relief' },
    { key: 'unit', label: 'Pack Size', aliases: ['packsize'], width: 'w-24', example: '10 tablets/strip' },
    { key: 'sellingPrice', label: 'Price', aliases: ['price', 'sellingprice', 'rate'], type: 'number', required: true, width: 'w-16', example: '35' },
    { key: 'mrp', label: 'MRP', aliases: ['mrp', 'maxretailprice'], type: 'number', width: 'w-16', example: '40' },
    { key: 'purchasePrice', label: 'Cost', aliases: ['cost', 'costprice'], type: 'number', width: 'w-16', example: '28' },
    { key: 'taxPercentage', label: 'GST %', aliases: ['tax', 'gst'], type: 'number', width: 'w-14', example: '12' },
    { key: 'hsnCode', label: 'HSN Code', aliases: ['hsn'], width: 'w-20', example: '3004' },
    { key: 'stockQuantity', label: 'Stock', aliases: ['stock', 'quantity'], type: 'number', width: 'w-16', example: '200' },
    { key: 'batchNumber', label: 'Batch #', aliases: ['batch'], width: 'w-20', example: 'CR2024A' },
    { key: 'expiryDate', label: 'Expiry', aliases: ['expiry', 'expirydate'], type: 'date', width: 'w-32' },
    { key: 'barcode', label: 'Barcode', aliases: ['sku', 'skucode', 'code'], width: 'w-24' },
    { key: 'prescriptionRequired', label: 'Rx Required', aliases: ['rx', 'prescription'], type: 'boolean', width: 'w-20' },
    { key: 'isScheduleH1', label: 'Schedule H1/X', aliases: ['schedule_h1', 'h1'], type: 'boolean', width: 'w-20' },
    { key: 'description', label: 'Usage / Dosage', aliases: ['dosage', 'usage'], width: 'w-40', example: 'Take 1 tablet twice daily after food' },
  ];

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">Medicines</h1>
          <p className="text-slate-500 font-medium mt-1">Manage your medicine inventory, batches & expiry</p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <Input
              className="pl-9 h-11 w-full"
              placeholder="Search medicines..."
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
            <Button className="h-11 gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Medicine
            </Button>
          </div>
        </div>

        <BulkUploadDialog
          open={showBulkUpload}
          onOpenChange={setShowBulkUpload}
          businessId={businessId}
          entityLabelPlural="Medicines"
          fields={bulkFields}
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
        <Dialog open={showItemForm} onOpenChange={(open) => { setShowItemForm(open); if (!open) setScanMode(false); }}>
          <DialogContent className={`sm:max-w-[560px] p-6 max-h-[85vh] overflow-y-auto ${scanMode ? 'barcode-scanner-modal bg-transparent' : ''}`}>
            <DialogHeader className="mb-2">
              <DialogTitle className="text-xl">{editingItem ? 'Edit Medicine' : 'Add Medicine'}</DialogTitle>
            </DialogHeader>
            <ManualOrScanToggle scanMode={scanMode} onChange={setScanMode} />
            {scanMode ? (
              <div className="flex flex-col gap-3">
                <CameraScannerView
                  active={showItemForm && scanMode}
                  onScan={(code) => {
                    handleBarcodeScan(code);
                    setScanMode(false);
                  }}
                />
              </div>
            ) : (
            <form onSubmit={handleItemSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Medicine Name</label>
                <Input className="h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Crocin Advance" required />
                {suggestedName && form.name === suggestedName && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <Sparkles className="w-3.5 h-3.5" /> Suggested from another business — edit if needed
                  </div>
                )}
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
                <label className="text-sm font-medium text-slate-700">Selling Price (₹)</label>
                <Input className="h-11" type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">MRP (₹)</label>
                <Input className="h-11" type="number" placeholder="Optional — the printed max retail price" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
                {form.mrp && form.sellingPrice && Number(form.sellingPrice) > Number(form.mrp) && (
                  <p className="text-xs text-rose-600">Selling price is above MRP — it'll be capped to ₹{form.mrp} on save.</p>
                )}
              </div>
              {inventoryEnabled && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Purchase Price (₹)</label>
                  <Input className="h-11" type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">GST %</label>
                <Input className="h-11" type="number" placeholder="e.g. 0, 5, 12, 18" value={form.taxPercentage} onChange={(e) => setForm({ ...form, taxPercentage: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">HSN Code</label>
                <Input className="h-11" placeholder="e.g. 3004" value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} />
              </div>
              {inventoryEnabled && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Stock Quantity</label>
                  <Input className="h-11" type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} />
                </div>
              )}
              {inventoryEnabled && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Reorder Point</label>
                  <Input className="h-11" type="number" placeholder="Default: 10" value={form.reorderPoint} onChange={(e) => setForm({ ...form, reorderPoint: e.target.value })} />
                </div>
              )}
              {!editingItem || editingBatches.length === 0 ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Batch Number</label>
                    <Input className="h-11" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} placeholder="e.g. CR2024A" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Expiry Date</label>
                    <Input className="h-11" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5 md:col-span-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3 ring-1 ring-slate-100">
                  Batch &amp; expiry are managed per-batch now — receive a Purchase Order or use the batch list on this
                  medicine's card to add stock, and the write-off action there to remove expired/damaged units.
                </div>
              )}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><ScanBarcode className="w-4 h-4 text-slate-400" /> Barcode</label>
                <Input className="h-11" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Scan with the scanner gun, or type the number" />
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
                  id="scheduleH1"
                  checked={form.isScheduleH1}
                  onChange={(e) => setForm({ ...form, isScheduleH1: e.target.checked })}
                  className="h-4 w-4 text-rose-600 rounded border-slate-300"
                />
                <label htmlFor="scheduleH1" className="text-sm font-medium text-slate-700">
                  Schedule H1/X drug — log patient &amp; prescribing doctor's registration no. per sale
                </label>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 mt-2 pt-4 border-t border-white/40">
                <Button type="button" variant="ghost" onClick={() => setShowItemForm(false)}>Cancel</Button>
                <Button type="submit" className="px-6">
                  {editingItem ? 'Update Medicine' : 'Save Medicine'}
                </Button>
              </div>
            </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Categories Tabs */}
        <CategoryFilterPills
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          totalCount={stats?.total ?? 0}
          countFor={(name) => stats?.categories.find((c) => c.name === name)?.count ?? 0}
          onDeleteCategory={deleteCategory}
          onRenameCategory={renameCategory}
        />

        {/* Medicine Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => {
            const expiry = expiryStatus(p.expiry_date);
            return (
              <Card
                key={p.id}
                className={`overflow-hidden transition-all flex flex-col group border-l-4 ${
                  p.is_available
                    ? 'hover:ring-emerald-300/50 border-l-emerald-500'
                    : 'border-l-slate-300 grayscale-[0.4] opacity-70'
                }`}
              >
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="mb-1">
                    <h3 className="font-bold text-slate-800 text-lg leading-tight">
                      {p.name}
                      {p.is_draft && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/10 ring-1 ring-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 align-middle">Draft</span>
                      )}
                    </h3>
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
                    {p.is_schedule_h1 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20">
                        <ShieldAlert className="w-3 h-3" /> Schedule H1/X
                      </span>
                    )}
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
                      {Number(p.tax_percentage) > 0 && (
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">GST {p.tax_percentage}%</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Stock</p>
                      <p className="font-semibold text-slate-700 text-sm">{p.stock_quantity} units</p>
                    </div>
                    <button type="button" className="text-left" onClick={() => toggleBatches(p.id)}>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold flex items-center gap-0.5">
                        Batch {expandedBatchesFor === p.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </p>
                      <p className="font-medium text-slate-600 text-sm truncate">{p.batch_number || '—'}</p>
                    </button>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Category</p>
                      <p className="font-medium text-slate-600 text-sm truncate flex items-center gap-1">
                        {p.category ? <><Tag className="w-3 h-3 shrink-0" /> {p.category}</> : '—'}
                      </p>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Last Supplier</p>
                      <p className="font-medium text-slate-600 text-sm truncate flex items-center gap-1">
                        {p.last_supplier ? <><Truck className="w-3 h-3 shrink-0" /> {p.last_supplier.name}</> : '—'}
                      </p>
                    </div>
                  </div>
                  {expandedBatchesFor === p.id && (
                    <div className="mb-2 rounded-xl ring-1 ring-white/50 bg-white/30 backdrop-blur-md overflow-hidden">
                      {loadingBatchesFor === p.id ? (
                        <p className="text-xs text-slate-400 p-3">Loading batches…</p>
                      ) : (batchesByProduct[p.id]?.length ?? 0) === 0 ? (
                        <p className="text-xs text-slate-400 p-3">No batches recorded yet — receive a Purchase Order to start tracking.</p>
                      ) : (
                        <table className="w-full text-xs text-left">
                          <thead className="text-[10px] text-slate-400 uppercase bg-white/30 border-b border-white/40">
                            <tr>
                              <th className="px-3 py-1.5">Batch</th>
                              <th className="px-3 py-1.5">Expiry</th>
                              <th className="px-3 py-1.5 text-right">Qty</th>
                              <th className="px-3 py-1.5"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {batchesByProduct[p.id]!.map((b) => (
                              <Fragment key={b.id}>
                                <tr>
                                  <td className="px-3 py-1.5 text-slate-600">{b.batch_number || '—'}</td>
                                  <td className="px-3 py-1.5 text-slate-500">
                                    {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-medium text-slate-700">{Number(b.quantity)}</td>
                                  <td className="px-3 py-1.5 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {Number(b.quantity) > 0 && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => { setReturnFor(returnFor === b.id ? null : b.id); setReturnQty(''); setReturnUnitPrice(''); setReturnError(''); }}
                                            className="text-amber-600 hover:text-amber-700"
                                            title="Return to supplier"
                                          >
                                            <Truck className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => { setWriteOffFor(writeOffFor === b.id ? null : b.id); setWriteOffQty(''); }}
                                            className="text-rose-500 hover:text-rose-700"
                                            title="Write off damaged/expired stock"
                                          >
                                            <PackageMinus className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      )}
                                      {/* Always available, even at 0 qty — a fully-dispensed batch is
                                          exactly when a recall lookup matters most. */}
                                      <button
                                        type="button"
                                        onClick={() => toggleTrace(b.id)}
                                        className="text-sky-600 hover:text-sky-700"
                                        title="Who received this batch (recall lookup)"
                                      >
                                        <Search className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {traceFor === b.id && (
                                  <tr className="bg-sky-50/40">
                                    <td colSpan={4} className="px-3 py-2">
                                      {traceLoading ? (
                                        <p className="text-[11px] text-slate-400">Looking up orders…</p>
                                      ) : traceOrders.length === 0 ? (
                                        <p className="text-[11px] text-slate-400">
                                          No orders on record for this batch — either nothing's been sold from it yet, or it was received before batch tracing was added.
                                        </p>
                                      ) : (
                                        <div className="space-y-1.5">
                                          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700">
                                            {traceOrders.length} order{traceOrders.length !== 1 ? 's' : ''} received this batch
                                          </p>
                                          {traceOrders.map((o) => (
                                            <div key={`${o.order_id}-${o.custom_product_name ?? ''}`} className="flex items-center justify-between gap-2 text-[11px] bg-white/70 rounded-lg px-2 py-1">
                                              <span className="text-slate-700 font-medium truncate">
                                                {o.order_number} · {o.customer_name}
                                                {o.customer_phone && <span className="text-slate-400"> ({o.customer_phone})</span>}
                                              </span>
                                              <span className="text-slate-500 shrink-0">
                                                {Number(o.quantity_from_batch)} units · {new Date(o.order_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                                {returnFor === b.id && (
                                  <tr className="bg-amber-50/40">
                                    <td colSpan={4} className="px-3 py-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Input
                                          type="number"
                                          placeholder="Qty"
                                          value={returnQty}
                                          onChange={(e) => setReturnQty(e.target.value)}
                                          className="h-8 w-20 text-xs"
                                        />
                                        <Input
                                          type="number"
                                          placeholder={`Unit cost (₹${p.purchase_price ?? '0'})`}
                                          value={returnUnitPrice}
                                          onChange={(e) => setReturnUnitPrice(e.target.value)}
                                          className="h-8 w-32 text-xs"
                                        />
                                        <select
                                          value={returnReason}
                                          onChange={(e) => setReturnReason(e.target.value as 'expired' | 'damaged' | 'wrong_item' | 'other')}
                                          className="h-8 text-xs rounded-lg border border-slate-200 px-2"
                                        >
                                          <option value="expired">Expired</option>
                                          <option value="damaged">Damaged</option>
                                          <option value="wrong_item">Wrong Item</option>
                                          <option value="other">Other</option>
                                        </select>
                                        <Button type="button" size="sm" className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={() => submitReturnToSupplier(p, b.id)}>
                                          Return
                                        </Button>
                                        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setReturnFor(null)}>
                                          Cancel
                                        </Button>
                                        <p className="w-full text-[11px] text-slate-500">
                                          {p.last_supplier ? `To: ${p.last_supplier.name}` : 'No supplier on record for this medicine.'}
                                        </p>
                                        {returnError && <p className="w-full text-[11px] text-rose-600">{returnError}</p>}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                {writeOffFor === b.id && (
                                  <tr className="bg-rose-50/40">
                                    <td colSpan={4} className="px-3 py-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Input
                                          type="number"
                                          placeholder="Qty"
                                          value={writeOffQty}
                                          onChange={(e) => setWriteOffQty(e.target.value)}
                                          className="h-8 w-20 text-xs"
                                        />
                                        <select
                                          value={writeOffReason}
                                          onChange={(e) => setWriteOffReason(e.target.value as 'expired' | 'damaged' | 'other')}
                                          className="h-8 text-xs rounded-lg border border-slate-200 px-2"
                                        >
                                          <option value="expired">Expired</option>
                                          <option value="damaged">Damaged</option>
                                          <option value="other">Other</option>
                                        </select>
                                        <Button type="button" size="sm" className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white" onClick={() => submitWriteOff(p.id, b.id)}>
                                          Write off
                                        </Button>
                                        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setWriteOffFor(null)}>
                                          Cancel
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                  {p.description && (
                    <p className="text-sm text-slate-500 mb-2 flex-1 line-clamp-2">{p.description}</p>
                  )}
                  <div className="mt-auto pt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-white/40">
                    <button
                      type="button"
                      onClick={() => toggleAvailability(p)}
                      disabled={togglingId === p.id}
                      className="flex items-center gap-1.5 pt-2 sm:pt-0 disabled:opacity-50"
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
          {products.length === 0 && !loading && (
            <div className="col-span-full py-12 text-center text-slate-400">
              No medicines found.
            </div>
          )}
        </div>
        {totalProducts !== null && loadedCount < totalProducts && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full h-11 rounded-2xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 text-sm font-semibold text-slate-600 hover:bg-white/55 disabled:opacity-60 transition-colors"
          >
            {loadingMore ? 'Loading…' : `Load more (${totalProducts - loadedCount} older)`}
          </button>
        )}

        {/* Barcode scan feedback (fixed overlay — no layout impact) */}
        {scanToast && (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white shadow-lg backdrop-blur-md ${
            scanToast.tone === 'ok' ? 'bg-emerald-600/90' : 'bg-sky-600/90'
          }`}>
            <ScanBarcode className="w-4 h-4" /> {scanToast.text}
          </div>
        )}
      </div>
    </AppShell>
  );
}
