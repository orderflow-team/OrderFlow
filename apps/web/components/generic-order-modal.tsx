'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { getCached, setCached } from '@/lib/offline-db';
import { getCachedBusinessCategory, getCachedInventoryEnabled, setCachedInventoryEnabled, hasRole } from '@/lib/auth';
import { parseQuantityUnit, canonicalUnitKey } from '@/lib/parse-quantity-unit';
import { ShoppingCart, Plus, Minus, Search, Trash2, Phone, User, CheckCircle2, Save, Check, ScanBarcode, Stethoscope, UserRound, ChevronDown, ChevronUp, Camera, Grid2x2 } from 'lucide-react';
import { CategoryFilterPills } from '@/components/category-filter-pills';
import { useBarcodeScanner } from '@/lib/use-barcode-scanner';
import { CameraScannerView } from '@/components/camera-scanner-view';
import { QuickAddProductDialog } from '@/components/quick-add-product-dialog';
import { Capacitor } from '@capacitor/core';
import { vibrateScanSuccess } from '@/lib/haptics';
import { useObixPhoneMatch } from '@/lib/use-obix-phone-match';
import { ObixPhoneMatchBanner } from '@/components/obix-phone-match-banner';

interface Product {
  id: string;
  name: string;
  selling_price: string | number;
  category: string | null;
  is_available: boolean;
  unit?: string;
  unit_prices?: Record<string, number> | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  prescription_required?: boolean;
  barcode?: string | null;
  sku?: string | null;
  stock_quantity?: number;
}

interface Category {
  id: string;
  name: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  original_unit?: string;
  original_price?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
}

interface GenericOrderModalProps {
  businessId: string;
  isOpen: boolean;
  customers: Customer[];
  onClose: () => void;
  onSubmit: (items: CartItem[], customerId: string, customerName: string, phone?: string, patientName?: string, doctorName?: string, doctorRegistrationNumber?: string, prescriptionImageKey?: string) => Promise<void>;
  onCustomerCreated?: (customer: Customer) => void;
}

export function GenericOrderModal({ businessId, isOpen, customers, onClose, onSubmit, onCustomerCreated }: GenericOrderModalProps) {
  const isPharmacy = getCachedBusinessCategory(businessId) === 'pharmacy';
  // A salesman's job is just to record what the customer wants — pricing is
  // the owner's concern, so price stays read-only (and unit-price management
  // hidden) in their cart.
  const isSalesmanRole = hasRole('salesman');
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [phone, setPhone] = useState('');
  const phoneMatch = useObixPhoneMatch(businessId);
  const [phoneError, setPhoneError] = useState('');
  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorRegistrationNumber, setDoctorRegistrationNumber] = useState('');
  const [prescriptionImageKey, setPrescriptionImageKey] = useState('');
  const [prescriptionFileName, setPrescriptionFileName] = useState('');
  const [prescriptionUploading, setPrescriptionUploading] = useState(false);
  const prescriptionInputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState('');
  const [baseProducts, setBaseProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [submitting, setSubmitting] = useState(false);
  // customer-specific price overrides: productId → price
  const [customerPrices, setCustomerPrices] = useState<Record<string, { price: number, unit?: string }>>({});
  const priceLoadRef = useRef<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  // productId → 'saving' | 'saved', for the per-unit "save this price" cart action
  const [unitPriceSaveState, setUnitPriceSaveState] = useState<Record<string, 'saving' | 'saved'>>({});
  const [inventoryEnabled, setInventoryEnabled] = useState(true);
  const [allowOrdersBeyondStock, setAllowOrdersBeyondStock] = useState(true);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [justCreatedCustomer, setJustCreatedCustomer] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  // Camera barcode scanning is native-only (Capacitor Android) — the toggle
  // stays hidden entirely on web/PWA, where search + a hardware scanner-gun
  // (useBarcodeScanner below) remain the only ways to add items.
  const canCameraScan = Capacitor.isNativePlatform();
  const [scanMode, setScanMode] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState('');
  // Prefill for the quick-add dialog, from another business's earlier scan
  // of this same barcode (see /api/products/barcode-lookup) — arrives a beat
  // after the dialog opens rather than delaying it.
  const [suggestedName, setSuggestedName] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState<number | undefined>(undefined);

  const handleProductScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop > 40 && !isHeaderCollapsed) {
      setIsHeaderCollapsed(true);
    } else if (scrollTop === 0 && isHeaderCollapsed) {
      setIsHeaderCollapsed(false);
    }
  };

  useEffect(() => {
    if (!businessId) return;
    const cached = getCachedInventoryEnabled(businessId);
    if (cached !== null) {
      setInventoryEnabled(cached);
    }
    apiClient
      .get<{ category: string | null; inventory_enabled: boolean; allow_orders_beyond_stock: boolean }>(`/api/businesses/${businessId}`)
      .then((res) => {
        setInventoryEnabled(res.data.inventory_enabled);
        setCachedInventoryEnabled(businessId, res.data.inventory_enabled);
        setAllowOrdersBeyondStock(res.data.allow_orders_beyond_stock !== false);
      })
      .catch(() => {});
  }, [businessId]);

  // Stock-tracked products cap at what's actually on hand; free-text/draft
  // items (never stock-tracked), businesses without inventory tracking
  // enabled, and businesses that allow overselling are uncapped.
  const getMaxQty = (product: Product): number => {
    if (!inventoryEnabled || allowOrdersBeyondStock || product.id.startsWith('draft-') || product.stock_quantity == null) {
      return Infinity;
    }
    return Number(product.stock_quantity);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const prodRes = await apiClient.get<Product[]>('/api/products', { params: { businessId, isDraft: 'all' } });
      const catRes = await apiClient.get<Category[]>('/api/categories', { params: { businessId } });
      // Every catalog product is selectable here regardless of is_available —
      // stock-outs and manually-discontinued items both still show up, since
      // orders.service.ts now always sells the full requested quantity (see
      // decrementStock) rather than silently dropping out-of-stock items.
      const fetchedProducts = prodRes.data.filter(p => p.name !== 'Table Session Started');
      setBaseProducts(fetchedProducts);
      const seen = new Set<string>();
      const combinedCategories: Category[] = [];

      for (const c of catRes.data) {
        if (!seen.has(c.name)) {
          seen.add(c.name);
          combinedCategories.push(c);
        }
      }

      for (const p of fetchedProducts) {
        if (p.category && !seen.has(p.category)) {
          seen.add(p.category);
          combinedCategories.push({ id: `cat-${p.category}`, name: p.category });
        }
      }

      setCategories(combinedCategories);
      // Write-through cache so the cart can still be built with zero network.
      setCached(businessId, 'products', fetchedProducts);
      setCached(businessId, 'categories', combinedCategories);
    } catch (err) {
      // Network failure (offline) — fall back to the last-cached catalog so the
      // counter can keep taking sales instead of showing a blank/error screen.
      const [cachedProducts, cachedCategories] = await Promise.all([
        getCached<Product[]>(businessId, 'products'),
        getCached<Category[]>(businessId, 'categories'),
      ]);
      if (cachedProducts) setBaseProducts(cachedProducts);
      if (cachedCategories) setCategories(cachedCategories);
      if (!cachedProducts) console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && businessId && baseProducts.length === 0) loadData();
  }, [isOpen, businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) {
      setCustomerName('');
      setCustomerId('');
      setPhone('');
      setPhoneError('');
      setCustomerPrices({});
      priceLoadRef.current = '';
      setCart({});
      setSearch('');
      setSelectedCategory(null);
      setCreatingCustomer(false);
      setJustCreatedCustomer(false);
      phoneMatch.dismiss();
      setPatientName('');
      setDoctorName('');
      setIsHeaderCollapsed(false);
      setIsCartCollapsed(false);
      setShowOptionalFields(false);
      setScanMode(false);
      setQuickAddOpen(false);
      setPendingBarcode('');
      setSuggestedName('');
      setSuggestedPrice(undefined);
    }
  }, [isOpen]);

  const loadCustomerPrices = async (cid: string) => {
    if (!cid || priceLoadRef.current === cid) return;
    priceLoadRef.current = cid;
    try {
      console.log('[prices] fetching for customer', cid);
      const res = await apiClient.get<Record<string, { price: number, unit?: string }>>('/api/orders/customer-prices', {
        params: { businessId, customerId: cid },
      });
      console.log('[prices] response', res.data);
      setCustomerPrices(res.data);
    } catch (e) {
      console.error('[prices] error', e);
      setCustomerPrices({});
    }
  };

  const selectCustomer = (c: Customer) => {
    console.log('[phone match] customer', c);
    setCustomerId(c.id);
    setCustomerName(c.name);
    setPhone(c.phone || '');
    setJustCreatedCustomer(false);
    loadCustomerPrices(c.id);
  };

  // Registers a walk-in as a real customer the moment their phone + name are both
  // captured, rather than only on order submit — so they show up in the customer
  // list even if this visit doesn't end in a sale. Fires on blur of either field;
  // safe to call repeatedly since it no-ops once a customer is already resolved.
  const maybeCreateCustomer = async () => {
    // Runs even once a customer is already resolved, so blurring the phone field
    // after picking/creating a customer still surfaces the OBIX match nudge.
    phoneMatch.check(phone);
    if (customerId || creatingCustomer) return;
    const trimmedName = customerName.trim();
    if (!trimmedName || !/^\d{10}$/.test(phone)) return;

    const existing = customers.find((c) => c.phone === phone);
    if (existing) {
      selectCustomer(existing);
      return;
    }

    setCreatingCustomer(true);
    try {
      const res = await apiClient.post<Customer>('/api/customers', { businessId, name: trimmedName, phone });
      setCustomerId(res.data.id);
      setJustCreatedCustomer(true);
      onCustomerCreated?.(res.data);
    } catch (err) {
      console.error('[customer sync] failed to save new customer', err);
    } finally {
      setCreatingCustomer(false);
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

  // Name field: matches an existing customer by exact name too, so picking a
  // name from the datalist (or typing one that matches) auto-fills their phone
  // the same way typing a known phone auto-fills the name.
  const handleNameChange = (val: string) => {
    setCustomerName(val);
    const existing = customers.find(c => c.name === val);
    if (existing) {
      selectCustomer(existing);
    } else if (customerId) {
      setCustomerId('');
      setCustomerPrices({});
      setJustCreatedCustomer(false);
      priceLoadRef.current = '';
    }
  };

  // Phone field: sole source of customer identity
  const handlePhoneChange = (val: string) => {
    setPhone(val);
    setPhoneError('');
    if (phoneMatch.match) phoneMatch.dismiss();
    console.log('[phone] typed', val, 'customers with phone:', customers.filter(c => c.phone).map(c => ({ name: c.name, phone: c.phone })));
    const existing = customers.find(c => c.phone === val);
    if (existing) {
      selectCustomer(existing);
    } else {
      setCustomerId('');
      setCustomerPrices({});
      setJustCreatedCustomer(false);
      priceLoadRef.current = '';
    }
  };

  // Merge base products with customer price overrides
  const products: Product[] = baseProducts.map(p => {
    const override = customerPrices[p.id];
    return {
      ...p,
      selling_price: override !== undefined ? override.price : p.selling_price,
      unit: override !== undefined && override.unit ? override.unit : p.unit,
    };
  });

  const filteredProducts = products.filter(p => {
    if (selectedCategory && p.category !== selectedCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.barcode || '').includes(search)) return false;
    return true;
  });

  const updateCart = (product: Product, delta: number) => {
    setCart(prev => {
      const newCart = { ...prev };
      const current = newCart[product.id]?.quantity || 0;

      let next = Math.min(current + delta, getMaxQty(product));
      let nextProduct = { ...product };

      if (current === 0 && delta > 0) {
        // Just add the product as configured, without splitting the unit and quantity
      }

      if (next <= 0) {
        delete newCart[product.id];
      } else {
        const existingItem = newCart[product.id];
        newCart[product.id] = { 
          product: nextProduct, 
          quantity: next,
          original_unit: existingItem ? existingItem.original_unit : product.unit,
          original_price: existingItem ? existingItem.original_price : Number(product.selling_price)
        };
      }
      return newCart;
    });
  };

  const setCartQuantity = (product: Product, quantity: number) => {
    setCart(prev => {
      const newCart = { ...prev };
      const existingItem = newCart[product.id];
      newCart[product.id] = {
        product,
        quantity: Math.min(quantity, getMaxQty(product)),
        original_unit: existingItem ? existingItem.original_unit : product.unit,
        original_price: existingItem ? existingItem.original_price : Number(product.selling_price)
      };
      return newCart;
    });
  };

  const updateCartName = (productId: string, newName: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[productId]) {
        newCart[productId] = {
          ...newCart[productId],
          product: { ...newCart[productId].product, name: newName },
        };
      }
      return newCart;
    });
  };

  const updateCartUnit = (productId: string, newUnit: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      const item = newCart[productId];
      if (item) {
        const originalUnit = item.original_unit || item.product.unit || 'pcs';
        const originalPrice = item.original_price ?? Number(item.product.selling_price);
        let newPrice = originalPrice;

        const savedPrice = item.product.unit_prices?.[canonicalUnitKey(newUnit)];

        if (savedPrice !== undefined) {
          newPrice = savedPrice;
        } else {
          const normalize = (u: string) => {
            const lower = (u || '').toLowerCase();
            if (lower === 'gram' || lower === 'g' || lower === 'gm' || lower === 'gms') return 'g';
            if (lower === 'kg' || lower === 'kilo' || lower === 'kgs' || lower === 'kilogram') return 'kg';
            if (lower === 'litre' || lower === 'l' || lower === 'ltr' || lower === 'liters') return 'L';
            if (lower === 'ml' || lower === 'mls' || lower === 'millilitre') return 'ml';
            return lower;
          };

          const parsedOriginal = parseQuantityUnit(originalUnit) || { quantity: 1, unit: originalUnit };
          const parsedNew = parseQuantityUnit(newUnit) || { quantity: 1, unit: newUnit };

          const normOriginal = normalize(parsedOriginal.unit);
          const normNew = normalize(parsedNew.unit);
          const isMass = (u: string) => u === 'kg' || u === 'g';
          const isVol = (u: string) => u === 'L' || u === 'ml';

          if (normOriginal && normNew && ((isMass(normOriginal) && isMass(normNew)) || (isVol(normOriginal) && isVol(normNew)))) {
            // Calculate price per 1 basic unit (g or ml)
            let pricePerBasicUnit = originalPrice / parsedOriginal.quantity;
            if (normOriginal === 'kg' || normOriginal === 'L') {
              pricePerBasicUnit = pricePerBasicUnit / 1000;
            }

            // Multiply by the new unit's configuration
            let finalPrice = pricePerBasicUnit * parsedNew.quantity;
            if (normNew === 'kg' || normNew === 'L') {
              finalPrice = finalPrice * 1000;
            }

            newPrice = finalPrice;
          }
        }

        newCart[productId] = {
          ...item,
          product: { 
            ...item.product, 
            unit: newUnit,
            selling_price: parseFloat(newPrice.toFixed(4)).toString()
          },
        };
      }
      return newCart;
    });
  };

  const updateCartPrice = (productId: string, newPrice: string) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (newCart[productId]) {
        newCart[productId] = {
          ...newCart[productId],
          product: { ...newCart[productId].product, selling_price: newPrice },
        };
      }
      return newCart;
    });
  };

  // Persists the cart item's current unit + price as a saved override on the
  // product, so this exact unit reflects this price next time instead of
  // being re-derived via proportional conversion.
  const saveUnitPrice = async (item: CartItem) => {
    const productId = item.product.id;
    const unit = item.product.unit?.trim();
    const price = Number(item.product.selling_price);
    if (productId.startsWith('draft-') || !unit || !Number.isFinite(price)) return;

    setUnitPriceSaveState(prev => ({ ...prev, [productId]: 'saving' }));
    try {
      const unitPrices = { ...(item.product.unit_prices || {}), [canonicalUnitKey(unit)]: price };
      await apiClient.patch(`/api/products/${productId}`, { unitPrices }, { params: { businessId } });
      setBaseProducts(prev => prev.map(p => (p.id === productId ? { ...p, unit_prices: unitPrices } : p)));
      setUnitPriceSaveState(prev => ({ ...prev, [productId]: 'saved' }));
      setTimeout(() => setUnitPriceSaveState(prev => { const next = { ...prev }; delete next[productId]; return next; }), 1500);
    } catch (err) {
      console.error(err);
      setUnitPriceSaveState(prev => { const next = { ...prev }; delete next[productId]; return next; });
    }
  };

  const handlePrescriptionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPrescriptionUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post<{ key: string }>('/api/orders/prescription-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPrescriptionImageKey(res.data.key);
      setPrescriptionFileName(file.name);
    } catch (err) {
      console.error('Failed to upload prescription photo', err);
    } finally {
      setPrescriptionUploading(false);
      if (prescriptionInputRef.current) prescriptionInputRef.current.value = '';
    }
  };

  const focusSearch = () => {
    setScanMode(false);
    setTimeout(() => {
      searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      searchInputRef.current?.focus();
    }, 0);
  };

  const handleSubmit = async () => {
    const items = Object.values(cart);
    if (items.length === 0) return;

    if (phone && !/^\d{10}$/.test(phone)) {
      setPhoneError('Phone number must be exactly 10 digits');
      return;
    }

    // Verify all items have a unit
    const hasItemWithoutUnit = items.some(item => !item.product.unit || !item.product.unit.trim());
    if (hasItemWithoutUnit) {
      setValidationError('Please specify a unit for all items in the cart.');
      return;
    }

    setSubmitting(true);
    setValidationError('');
    setPhoneError('');
    try {
      await onSubmit(items, customerId, customerName, phone, isPharmacy ? patientName : undefined, isPharmacy ? doctorName : undefined, isPharmacy ? doctorRegistrationNumber : undefined, isPharmacy ? prescriptionImageKey || undefined : undefined);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((acc, item) => acc + (Number(item.product.selling_price) * item.quantity), 0);
  const hasCustomerPrices = Object.keys(customerPrices).length > 0;

  // Barcode scanner (keyboard-wedge): scanning an item while the modal is open
  // drops it straight into the cart. Fixed-position toast, no layout impact.
  const [scanToast, setScanToast] = useState<{ text: string; tone: 'ok' | 'miss' } | null>(null);
  const scanToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showScanToast = (text: string, tone: 'ok' | 'miss') => {
    if (scanToastTimer.current) clearTimeout(scanToastTimer.current);
    setScanToast({ text, tone });
    scanToastTimer.current = setTimeout(() => setScanToast(null), 3000);
  };
  useEffect(() => () => { if (scanToastTimer.current) clearTimeout(scanToastTimer.current); }, []);

  // Shared by both scan inputs (hardware scanner-gun and camera) so there's
  // one match/add/miss code path. On a miss, opens the quick-add dialog
  // instead of just toasting, so an unrecognized item never dead-ends the
  // flow.
  const handleScannedCode = (code: string) => {
    const match = products.find((p) => p.barcode === code || (p.sku && p.sku === code));
    if (match) {
      updateCart(match, 1);
      const inCart = cart[match.id]?.quantity || 0;
      showScanToast(`Added ${match.name} (×${inCart + 1})`, 'ok');
      vibrateScanSuccess();
    } else {
      setSuggestedName('');
      setSuggestedPrice(undefined);
      setPendingBarcode(code);
      setQuickAddOpen(true);
      // Open the dialog immediately — no need to make the user wait on this
      // fetch. If another business already named this barcode, the fields
      // populate a beat later; otherwise it just stays blank as before.
      apiClient
        .get<{ name: string; suggestedPrice: number | null } | null>('/api/products/barcode-lookup', { params: { barcode: code } })
        .then((res) => {
          if (res.data) {
            setSuggestedName(res.data.name);
            setSuggestedPrice(res.data.suggestedPrice ?? undefined);
          }
        })
        .catch(() => {});
    }
  };

  const handleQuickAddCreated = (product: Product) => {
    setBaseProducts(prev => [...prev, product]);
    updateCart(product, 1);
    setQuickAddOpen(false);
    setPendingBarcode('');
    setSuggestedName('');
    setSuggestedPrice(undefined);
    showScanToast(`Added ${product.name} (×1)`, 'ok');
    vibrateScanSuccess();
  };

  useBarcodeScanner(handleScannedCode, { enabled: isOpen });

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="barcode-scanner-modal sm:max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col bg-transparent overflow-hidden rounded-3xl border-none shadow-none ring-0">

        {/* Barcode scan feedback (fixed overlay — no layout impact) */}
        {scanToast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white shadow-lg backdrop-blur-md ${
            scanToast.tone === 'ok' ? 'bg-emerald-600/90' : 'bg-rose-600/90'
          }`}>
            <ScanBarcode className="w-4 h-4" /> {scanToast.text}
          </div>
        )}

        {/* Header */}
        <DialogHeader className="p-4 border-b border-slate-100 flex-shrink-0 relative">
          <div className="flex justify-between items-center">
            <DialogTitle className="text-lg flex items-center gap-2">
              New Order
              <button
                type="button"
                onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                title={isHeaderCollapsed ? "Show customer fields" : "Hide customer fields"}
              >
                {isHeaderCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </DialogTitle>
          </div>

          {/* Collapsible Customer Fields Container */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isHeaderCollapsed ? 'max-h-0 opacity-0 pointer-events-none mt-0' : 'max-h-48 opacity-100 mt-3'
          }`}>
            <div className="space-y-3">
              <div className="flex gap-2">
                {/* Phone */}
                <div className="relative w-44 flex-shrink-0">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder="Phone"
                    value={phone}
                    list="customers-phone-list"
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onBlur={maybeCreateCustomer}
                    className="pl-8 h-10 text-sm text-[16px]"
                  />
                  <datalist id="customers-phone-list">
                    {customers.filter(c => c.phone).map(c => (
                      <option key={c.id} value={c.phone} />
                    ))}
                  </datalist>
                </div>

                {/* Name */}
                <div className="relative flex-1">
                  <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    list="customers-name-list"
                    placeholder="Customer name (Walk-in)"
                    value={customerName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={maybeCreateCustomer}
                    className="pl-8 h-10 text-sm"
                  />
                  <datalist id="customers-name-list">
                    {customers.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>
              </div>

              {isPharmacy && (
                <div>
                  {!showOptionalFields ? (
                    <button
                      type="button"
                      onClick={() => setShowOptionalFields(true)}
                      className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline font-semibold flex items-center gap-1 mt-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Patient / Doctor details (optional)
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        {/* Patient name — printed on the Cash Memo invoice */}
                        <div className="relative flex-1">
                          <UserRound className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="Patient name (optional)"
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            className="pl-8 h-10 text-sm"
                          />
                        </div>

                        {/* Prescribing doctor — printed on the Cash Memo invoice */}
                        <div className="relative flex-1">
                          <Stethoscope className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="Dr. name (optional)"
                            value={doctorName}
                            onChange={(e) => setDoctorName(e.target.value)}
                            className="pl-8 h-10 text-sm"
                          />
                        </div>
                      </div>
                      {/* Doctor's registration no. — required record-keeping for Schedule H1/X drugs */}
                      <div className="relative">
                        <Stethoscope className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder="Doctor's registration no. (required for Schedule H1/X items)"
                          value={doctorRegistrationNumber}
                          onChange={(e) => setDoctorRegistrationNumber(e.target.value)}
                          className="pl-8 h-10 text-sm"
                        />
                      </div>
                      {/* Prescription photo — attached for record-keeping, not required to check out */}
                      <div className="flex items-center gap-2">
                        <input
                          ref={prescriptionInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePrescriptionFileChange}
                          className="hidden"
                          id="prescription-photo-input"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs gap-1.5"
                          disabled={prescriptionUploading}
                          onClick={() => prescriptionInputRef.current?.click()}
                        >
                          <Camera className="w-3.5 h-3.5" />
                          {prescriptionUploading ? 'Uploading...' : prescriptionImageKey ? 'Replace prescription photo' : 'Attach prescription photo (optional)'}
                        </Button>
                        {prescriptionFileName && !prescriptionUploading && (
                          <span className="text-xs text-emerald-600 font-medium truncate">{prescriptionFileName}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowOptionalFields(false)}
                        className="text-xs text-rose-500 hover:text-rose-600 hover:underline font-semibold flex items-center gap-1 transition-colors"
                      >
                        Hide optional fields
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {(phoneError || validationError || creatingCustomer || (!creatingCustomer && customerId)) && (
            <div className="mt-2 space-y-1">
              {phoneError && (
                <p className="text-xs text-rose-600 font-medium">
                  {phoneError}
                </p>
              )}
              {validationError && (
                <p className="text-xs text-rose-600 font-medium">
                  {validationError}
                </p>
              )}
              {creatingCustomer && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                  Saving {customerName} to your customer list…
                </div>
              )}
              {!creatingCustomer && customerId && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {justCreatedCustomer
                    ? `Saved ${customerName} as a new customer`
                    : hasCustomerPrices
                    ? `Showing ${customerName}'s personalised prices`
                    : `Matched: ${customerName}`}
                </div>
              )}
            </div>
          )}
          <ObixPhoneMatchBanner
            match={phoneMatch.match}
            connectionStatus={phoneMatch.connectionStatus}
            connecting={phoneMatch.connecting}
            error={phoneMatch.error}
            role="wholesaler"
            onConnect={() => phoneMatch.connect('wholesaler', phone)}
            onDismiss={phoneMatch.dismiss}
          />
        </DialogHeader>

        {/* Product area */}
        <div
          onScroll={handleProductScroll}
          className={`flex-1 overflow-y-auto p-4 flex flex-col gap-4 relative z-0 ${
            scanMode ? '' : 'bg-white/30 backdrop-blur-3xl backdrop-saturate-150'
          }`}
        >
          {/* Browse / Scan toggle — camera scanning only exists in the native app */}
          {canCameraScan && (
            <div className="shrink-0 flex justify-center">
              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/50 ring-1 ring-white/60 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setScanMode(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    !scanMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Grid2x2 className="w-3.5 h-3.5" /> Browse
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    scanMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" /> Scan
                </button>
              </div>
            </div>
          )}

          {scanMode ? (
            <CameraScannerView active={isOpen && scanMode && !quickAddOpen} onScan={handleScannedCode} />
          ) : (
          <>
          {/* Categories */}
          <div className="shrink-0">
            <CategoryFilterPills
              categories={categories}
              selectedCategory={selectedCategory}
              onSelect={setSelectedCategory}
              totalCount={baseProducts.length}
              countFor={(name) => baseProducts.filter(p => p.category === name).length}
              onDeleteCategory={deleteCategory}
              onRenameCategory={renameCategory}
            />
          </div>

          <div className="shrink-0 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              ref={searchInputRef}
              className="pl-10 h-12 rounded-full border border-transparent bg-white/35 backdrop-blur-md px-4 text-sm ring-1 ring-white/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_3px_rgba(148,163,184,0.2)] focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:bg-white/55"
              placeholder={isPharmacy ? 'Search medicines...' : 'Search products...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Product list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pb-4">
            {filteredProducts.map(p => {
              const qty = cart[p.id]?.quantity || 0;
              const maxQty = getMaxQty(p);
              const atMax = Number.isFinite(maxQty) && qty >= maxQty;
              const hasPreviousPrice = customerPrices[p.id] !== undefined;
              const originalPrice = hasPreviousPrice ? baseProducts.find(b => b.id === p.id)?.selling_price : undefined;
              const hasCustomPrice = hasPreviousPrice && originalPrice !== undefined && Number(originalPrice) !== Number(p.selling_price);
              const metaBits = [
                hasPreviousPrice ? 'Last purchased price' : null,
                p.batch_number ? `Batch ${p.batch_number}` : null,
                atMax ? `Only ${maxQty} in stock — max added` : null,
              ].filter(Boolean);
              return (
                <div
                  key={p.id}
                  className={`relative flex items-center gap-2 pl-3 pr-8 py-2 min-h-[68px] rounded-xl border transition-all bg-white/40 backdrop-blur-xl glass-sheen-sm ${
                    atMax ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                  } ${
                    qty > 0 ? 'border-emerald-400 ring-1 ring-emerald-400' : 'border-white/50 hover:bg-white/60 ring-1 ring-white/50'
                  }`}
                  onClick={() => !atMax && updateCart(p, 1)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1.5">
                      <h4 className="font-semibold text-slate-800 text-sm leading-snug break-words">{p.name}</h4>
                      {p.prescription_required && (
                        <span className="shrink-0 mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20">
                          Rx
                        </span>
                      )}
                    </div>
                    {metaBits.length > 0 && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {metaBits.map((bit, i) => (
                          <span
                            key={i}
                            className={
                              bit === 'Last purchased price'
                                ? 'font-semibold text-emerald-700'
                                : bit?.startsWith('Only')
                                  ? 'font-semibold text-rose-600'
                                  : ''
                            }
                          >
                            {i > 0 && <span className="text-slate-300"> · </span>}
                            {bit}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {hasCustomPrice && originalPrice !== undefined && (
                      <span className="text-xs text-slate-400 line-through">
                        ₹{Number(originalPrice).toFixed(2)}
                      </span>
                    )}
                    <span className="font-bold text-sm text-emerald-600 whitespace-nowrap">
                      ₹{Number(p.selling_price).toFixed(2)}
                      {p.unit && <span className="text-[10px] text-slate-500 font-medium ml-0.5">/ {p.unit}</span>}
                    </span>
                  </div>
                  {qty > 0 && (
                    <span className="absolute top-1/2 -translate-y-1/2 right-2 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {qty}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Add free-text item */}
            {search.trim().length > 0 && !products.some(p => p.name.toLowerCase() === search.trim().toLowerCase()) && (() => {
              const parsed = parseQuantityUnit(search.trim());
              return (
                <div
                  className="flex items-center gap-2 px-3 py-2 min-h-[68px] rounded-xl border border-dashed border-emerald-400/50 bg-emerald-500/10 cursor-pointer hover:bg-emerald-500/20"
                  onClick={() => {
                    const tempProduct: Product = {
                      id: 'draft-' + Date.now(),
                      name: parsed ? search.trim().replace(new RegExp(`\\s*${parsed.quantity}\\s*${parsed.unit}\\s*`, 'i'), '').trim() || search.trim() : search.trim(),
                      selling_price: 0,
                      category: null,
                      is_available: true,
                      unit: parsed ? `${parsed.quantity}${parsed.unit}` : '',
                    };
                    updateCart(tempProduct, 1);
                    setSearch('');
                  }}
                >
                  <Plus className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <h4 className="font-medium text-emerald-800 text-sm leading-snug break-words min-w-0 flex-1">Add "{search.trim()}"</h4>
                  <span className="text-emerald-600/70 text-[10px] flex-shrink-0 ml-auto">
                    {parsed ? `${parsed.quantity} ${parsed.unit}` : 'draft product'}
                  </span>
                </div>
              );
            })()}
          </div>
          </>
          )}
        </div>

        {/* Cart */}
        <div className="flex-shrink-0 bg-white/60 backdrop-blur-3xl backdrop-saturate-150 border-t border-white/50 px-4 pt-4 pb-4 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.1)] z-10 glass-sheen-sm rounded-b-3xl">
          <button
            type="button"
            onClick={() => setIsCartCollapsed(!isCartCollapsed)}
            className="w-full flex items-center justify-between gap-2 mb-3 font-semibold text-slate-800 text-sm"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Cart ({cartItems.length} items)
            </span>
            <span className="p-1 -m-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              {isCartCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </span>
          </button>

          <div className={`overflow-y-auto space-y-2.5 mb-3 pr-1 transition-all duration-300 ease-in-out ${
            isCartCollapsed ? 'max-h-0 !mb-0 opacity-0 pointer-events-none' : 'max-h-36 opacity-100'
          }`}>
            {cartItems.map(item => (
              <div key={item.product.id} className="flex flex-col gap-2 pb-3 border-b border-white/20 last:border-0 last:pb-0 text-sm">
                <input
                  type="text"
                  className="text-slate-800 font-medium bg-transparent border-none outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1 -mx-1"
                  value={item.product.name}
                  onChange={(e) => updateCartName(item.product.id, e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex items-center justify-between gap-1 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="flex items-center gap-1 bg-white/50 border border-white/60 ring-1 ring-white/50 rounded-xl px-1 py-0.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
                      <button onClick={() => updateCart(item.product, -1)} className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:bg-slate-200">
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <input
                        type="number"
                        className="w-6 text-center font-medium text-xs bg-transparent outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        value={item.quantity === 0 ? '' : item.quantity}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                          if (!isNaN(val) && val >= 0) setCartQuantity(item.product, val);
                        }}
                        onBlur={() => {
                          if (item.quantity === 0) updateCart(item.product, 0);
                        }}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={() => updateCart(item.product, 1)}
                        disabled={item.quantity >= getMaxQty(item.product)}
                        className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      list="unit-options"
                      className={`bg-white/50 border text-slate-600 text-xs rounded outline-none py-1 px-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] cursor-text w-16 transition-all ${
                        (!item.product.unit || !item.product.unit.trim())
                          ? 'border-rose-400 focus:ring-1 focus:ring-rose-500'
                          : 'border-white/60 focus:ring-1 focus:ring-emerald-500'
                      }`}
                      value={item.product.unit || ''}
                      placeholder="Unit"
                      onChange={(e) => updateCartUnit(item.product.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <datalist id="unit-options">
                      <option value="pcs" />
                      <option value="kg" />
                      <option value="g" />
                      <option value="100g" />
                      <option value="250g" />
                      <option value="500g" />
                      <option value="L" />
                      <option value="ml" />
                      <option value="100ml" />
                      <option value="250ml" />
                      <option value="500ml" />
                      <option value="pl" />
                      <option value="box" />
                      <option value="pkt" />
                    </datalist>
                    {!isSalesmanRole && (
                      <button
                        onClick={(e) => { e.stopPropagation(); saveUnitPrice(item); }}
                        disabled={item.product.id.startsWith('draft-') || unitPriceSaveState[item.product.id] === 'saving'}
                        title="Save this price for this unit"
                        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-500/10 flex-shrink-0 disabled:opacity-30"
                      >
                        {unitPriceSaveState[item.product.id] === 'saved'
                          ? <Check className="w-3 h-3 text-emerald-600" />
                          : <Save className="w-3 h-3" />}
                      </button>
                    )}
                    <button
                      onClick={() => setCart(prev => { const n = { ...prev }; delete n[item.product.id]; return n; })}
                      className="w-6 h-6 flex items-center justify-center rounded text-rose-400 hover:text-rose-600 hover:bg-rose-500/10 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 justify-end flex-1">
                    <div
                      className="flex items-center gap-0.5 border border-white/60 rounded-lg px-2 py-0.5 bg-white/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] transition-all focus-within:ring-1 focus-within:ring-emerald-500"
                      title="Total Price"
                    >
                      <span className="text-slate-400 text-xs">₹</span>
                      <input
                        type="number"
                        className="w-16 h-6 text-right text-sm font-semibold text-slate-800 bg-transparent outline-none p-0 disabled:text-slate-400"
                        value={item.quantity > 0 ? Number((Number(item.product.selling_price) * item.quantity).toFixed(2)) : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                             updateCartPrice(item.product.id, "0");
                          } else {
                             const numVal = parseFloat(val);
                             if (!isNaN(numVal) && item.quantity > 0) {
                               updateCartPrice(item.product.id, (numVal / item.quantity).toString());
                             }
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {cartItems.length === 0 && (
              <p className="text-slate-400 text-xs text-center py-2">Your cart is empty.</p>
            )}
          </div>

          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-slate-600">Total</span>
            <span className="font-bold text-lg text-slate-800">₹{cartTotal.toFixed(2)}</span>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1 h-11 gap-1.5 font-semibold bg-tile-lavender-fg hover:brightness-95 text-white"
              onClick={focusSearch}
            >
              <Plus className="w-4 h-4" /> {isPharmacy ? 'Add Medicine' : 'Add Product'}
            </Button>
            <Button
              className="flex-1 h-11 text-base font-semibold"
              disabled={cartItems.length === 0 || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Submitting...' : 'Submit Order'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <QuickAddProductDialog
      open={quickAddOpen}
      barcode={pendingBarcode}
      businessId={businessId}
      suggestedName={suggestedName}
      suggestedPrice={suggestedPrice}
      onClose={() => { setQuickAddOpen(false); setPendingBarcode(''); setSuggestedName(''); setSuggestedPrice(undefined); }}
      onCreated={handleQuickAddCreated}
    />
    </>
  );
}
