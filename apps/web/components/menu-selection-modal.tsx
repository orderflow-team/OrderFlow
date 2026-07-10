import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import apiClient from '@/lib/api-client';
import { ShoppingCart, Plus, Minus, Search, Save, Check, Trash2 } from 'lucide-react';
import { parseQuantityUnit, canonicalUnitKey } from '@/lib/parse-quantity-unit';
import { CategoryFilterPills } from '@/components/category-filter-pills';

interface Product {
  id: string;
  name: string;
  selling_price: string | number;
  category: string | null;
  is_available: boolean;
  unit?: string;
  unit_prices?: Record<string, number> | null;
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

interface MenuSelectionModalProps {
  businessId: string;
  isOpen: boolean;
  guestName: string;
  onClose: () => void;
  onSubmit: (items: CartItem[]) => Promise<void>;
}

export function MenuSelectionModal({ businessId, isOpen, guestName, onClose, onSubmit }: MenuSelectionModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [submitting, setSubmitting] = useState(false);
  // productId → 'saving' | 'saved', for the per-unit "save this price" cart action
  const [unitPriceSaveState, setUnitPriceSaveState] = useState<Record<string, 'saving' | 'saved'>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);

  const focusSearch = () => {
    searchInputRef.current?.focus();
  };

  useEffect(() => {
    if (isOpen && businessId && products.length === 0) {
      loadData();
    }
  }, [isOpen, businessId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiClient.get<Product[]>('/api/products', { params: { businessId } }),
        apiClient.get<Category[]>('/api/categories', { params: { businessId } }),
      ]);
      const fetchedProducts = prodRes.data.filter(p => p.is_available && p.name !== 'Table Session Started');
      setProducts(fetchedProducts);

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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (selectedCategory && p.category !== selectedCategory) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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

  const updateCart = (product: Product, delta: number) => {
    setCart(prev => {
      const newCart = { ...prev };
      const current = newCart[product.id]?.quantity || 0;
      
      let next = current + delta;
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
        quantity,
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
    if (!unit || !Number.isFinite(price)) return;

    setUnitPriceSaveState(prev => ({ ...prev, [productId]: 'saving' }));
    try {
      const unitPrices = { ...(item.product.unit_prices || {}), [canonicalUnitKey(unit)]: price };
      await apiClient.patch(`/api/products/${productId}`, { unitPrices }, { params: { businessId } });
      setProducts(prev => prev.map(p => (p.id === productId ? { ...p, unit_prices: unitPrices } : p)));
      setUnitPriceSaveState(prev => ({ ...prev, [productId]: 'saved' }));
      setTimeout(() => setUnitPriceSaveState(prev => { const next = { ...prev }; delete next[productId]; return next; }), 1500);
    } catch (err) {
      console.error(err);
      setUnitPriceSaveState(prev => { const next = { ...prev }; delete next[productId]; return next; });
    }
  };

  const handleSubmit = async () => {
    const items = Object.values(cart);
    if (items.length === 0) return;
    
    setSubmitting(true);
    try {
      await onSubmit(items);
      setCart({});
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce((acc, item) => acc + (Number(item.product.selling_price) * item.quantity), 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col bg-transparent overflow-hidden rounded-3xl border-none shadow-none ring-0">
        <DialogHeader className="p-5 border-b border-slate-100 flex-shrink-0">
          <DialogTitle className="text-xl">Add Items — {guestName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 bg-white/30 backdrop-blur-3xl backdrop-saturate-150 flex flex-col gap-5 relative z-0">
          {/* Category Filters */}
          <div className="shrink-0">
            <CategoryFilterPills
              categories={categories}
              selectedCategory={selectedCategory}
              onSelect={setSelectedCategory}
              totalCount={products.length}
              countFor={(name) => products.filter(p => p.category === name).length}
              onDeleteCategory={deleteCategory}
              onRenameCategory={renameCategory}
            />
          </div>

          <div className="shrink-0 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              ref={searchInputRef}
              className="pl-10 h-12 rounded-full border border-transparent bg-white/35 backdrop-blur-md px-4 text-sm ring-1 ring-white/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_3px_rgba(148,163,184,0.2)] focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:bg-white/55" 
              placeholder="Search dishes..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Menu Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
            {filteredProducts.map(p => {
              const qty = cart[p.id]?.quantity || 0;
              return (
                <div
                  key={p.id}
                  className={`relative p-3 rounded-2xl border cursor-pointer transition-all bg-white/40 backdrop-blur-xl glass-sheen-sm ${qty > 0 ? 'border-emerald-400 ring-1 ring-emerald-400' : 'border-white/50 ring-1 ring-white/50 hover:bg-white/60'}`}
                  onClick={() => updateCart(p, 1)}
                >
                  {qty > 0 && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {qty}
                    </span>
                  )}
                  <h4 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2 pr-4">{p.name}</h4>
                  <div className="text-emerald-600 font-bold text-sm mt-2">
                    ₹{Number(p.selling_price).toFixed(2)}
                    {p.unit && <span className="text-xs text-slate-500 font-medium ml-1">/ {p.unit}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart Bottom Sheet */}
        <div className="flex-shrink-0 bg-white/60 backdrop-blur-3xl backdrop-saturate-150 border-t border-white/50 p-5 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.1)] z-10 glass-sheen-sm rounded-b-3xl">
          <div className="flex items-center gap-2 mb-4 font-semibold text-slate-800">
            <ShoppingCart className="w-5 h-5" />
            Cart ({cartItems.length} items)
          </div>
          
          <div className="max-h-40 overflow-y-auto space-y-3 mb-4 pr-2">
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
                      <button onClick={() => updateCart(item.product, 1)} className="w-5 h-5 flex items-center justify-center rounded text-slate-500 hover:bg-slate-200">
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      list="unit-options-menu"
                      className="bg-white/50 border border-white/60 text-slate-600 text-xs rounded outline-none focus:ring-1 focus:ring-emerald-500 py-1 px-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] cursor-text w-16"
                      value={item.product.unit || ''}
                      placeholder="Unit"
                      onChange={(e) => updateCartUnit(item.product.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <datalist id="unit-options-menu">
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
                    <button
                      onClick={(e) => { e.stopPropagation(); saveUnitPrice(item); }}
                      disabled={unitPriceSaveState[item.product.id] === 'saving'}
                      title="Save this price for this unit"
                      className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-500/10 flex-shrink-0 disabled:opacity-30"
                    >
                      {unitPriceSaveState[item.product.id] === 'saved'
                        ? <Check className="w-3 h-3 text-emerald-600" />
                        : <Save className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => setCart(prev => { const n = { ...prev }; delete n[item.product.id]; return n; })}
                      className="w-6 h-6 flex items-center justify-center rounded text-rose-400 hover:text-rose-600 hover:bg-rose-500/10 flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 justify-end flex-1">
                    <div className="flex items-center gap-0.5 border border-white/60 rounded-lg px-2 py-0.5 focus-within:ring-1 focus-within:ring-emerald-500 bg-white/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]" title="Total Price">
                      <span className="text-slate-400 text-xs">₹</span>
                      <input
                        type="number"
                        className="w-16 h-6 text-right text-sm font-semibold text-slate-800 bg-transparent outline-none p-0"
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
              <p className="text-slate-400 text-sm text-center py-2">Your cart is empty.</p>
            )}
          </div>

          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm font-semibold text-slate-800 text-xl">Total</p>
            </div>
            <p className="font-bold text-xl text-slate-800">₹{cartTotal.toFixed(2)}</p>
          </div>
          
          <div className="flex gap-2 mt-4">
            <Button
              type="button"
              className="flex-1 h-12 gap-1.5 font-semibold bg-tile-lavender-fg hover:brightness-95 text-white"
              onClick={focusSearch}
            >
              <Plus className="w-4 h-4" /> Add Item
            </Button>
            <Button
              className="flex-1 h-12 text-base font-semibold"
              disabled={cartItems.length === 0 || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Submitting...' : 'Submit Order'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
