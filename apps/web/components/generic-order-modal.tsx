'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { parseQuantityUnit } from '@/lib/parse-quantity-unit';
import { ShoppingCart, Plus, Minus, Search, Trash2, Phone, User, CheckCircle2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  selling_price: string | number;
  category: string | null;
  is_available: boolean;
  unit?: string;
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
  onSubmit: (items: CartItem[], customerId: string, customerName: string, phone?: string) => Promise<void>;
}

export function GenericOrderModal({ businessId, isOpen, customers, onClose, onSubmit }: GenericOrderModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [phone, setPhone] = useState('');
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

  const loadData = async () => {
    setLoading(true);
    try {
      const prodRes = await apiClient.get<Product[]>('/api/products', { params: { businessId, isDraft: 'all' } });
      const catRes = await apiClient.get<Category[]>('/api/categories', { params: { businessId } });
      setBaseProducts(prodRes.data.filter(p => p.is_available && p.name !== 'Table Session Started'));
      const seen = new Set<string>();
      setCategories(catRes.data.filter(c => {
        if (seen.has(c.name)) return false;
        seen.add(c.name);
        return true;
      }));
    } catch (err) {
      console.error(err);
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
      setCustomerPrices({});
      priceLoadRef.current = '';
      setCart({});
      setSearch('');
      setSelectedCategory(null);
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
    setCustomerName(c.name);
    setCustomerId(c.id);
    if (c.phone) setPhone(c.phone);
    loadCustomerPrices(c.id);
  };

  // Name field: free text only — phone is the sole identifier for customer matching
  const handleNameChange = (val: string) => {
    setCustomerName(val);
  };

  // Phone field: sole source of customer identity
  const handlePhoneChange = (val: string) => {
    setPhone(val);
    console.log('[phone] typed', val, 'customers with phone:', customers.filter(c => c.phone).map(c => ({ name: c.name, phone: c.phone })));
    const existing = customers.find(c => c.phone === val);
    if (existing) {
      selectCustomer(existing);
    } else {
      setCustomerId('');
      setCustomerPrices({});
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
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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

  const handleSubmit = async () => {
    const items = Object.values(cart);
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(items, customerId, customerName, phone);
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col bg-transparent overflow-hidden rounded-3xl border-none shadow-none ring-0">

        {/* Header */}
        <DialogHeader className="p-4 border-b border-slate-100 flex-shrink-0 space-y-3">
          <DialogTitle className="text-lg">New Order</DialogTitle>

          {/* Customer fields row */}
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
                className="pl-8 h-10 text-sm"
              />
              <datalist id="customers-name-list">
                {customers.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
          </div>

          {/* Customer matched indicator */}
          {customerId && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {hasCustomerPrices
                ? `Showing ${customerName}'s personalised prices`
                : `Matched: ${customerName}`}
            </div>
          )}
        </DialogHeader>

        {/* Product area */}
        <div className="flex-1 overflow-y-auto p-4 bg-white/30 backdrop-blur-3xl backdrop-saturate-150 flex flex-col gap-4 relative z-0">
          {/* Categories */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <div
                className={`px-3 py-1.5 rounded-2xl text-sm font-medium border cursor-pointer transition-all ${
                  selectedCategory === null ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-800 ring-1 ring-emerald-500/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]' : 'border-white/40 bg-white/40 text-slate-700 hover:bg-white/60 ring-1 ring-white/50 glass-sheen-sm'
                }`}
                onClick={() => setSelectedCategory(null)}
              >
                All
              </div>
              {categories.map(c => (
                <div
                  key={c.id}
                  className={`px-3 py-1.5 rounded-2xl text-sm font-medium border cursor-pointer transition-all ${
                    selectedCategory === c.name ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-800 ring-1 ring-emerald-500/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]' : 'border-white/40 bg-white/40 text-slate-700 hover:bg-white/60 ring-1 ring-white/50 glass-sheen-sm'
                  }`}
                  onClick={() => setSelectedCategory(c.name)}
                >
                  {c.name}
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-10 h-12 rounded-full border border-transparent bg-white/35 backdrop-blur-md px-4 text-sm ring-1 ring-white/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_3px_rgba(148,163,184,0.2)] focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:bg-white/55"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Product grid */}
          <div className="grid grid-cols-2 gap-3 pb-4">
            {filteredProducts.map(p => {
              const qty = cart[p.id]?.quantity || 0;
              const hasPreviousPrice = customerPrices[p.id] !== undefined;
              const originalPrice = hasPreviousPrice ? baseProducts.find(b => b.id === p.id)?.selling_price : undefined;
              const hasCustomPrice = hasPreviousPrice && originalPrice !== undefined && Number(originalPrice) !== Number(p.selling_price);
              return (
                <div
                  key={p.id}
                  className={`relative p-3 rounded-2xl border cursor-pointer transition-all bg-white/40 backdrop-blur-xl glass-sheen-sm flex flex-col justify-between ${
                    qty > 0 ? 'border-emerald-400 ring-1 ring-emerald-400' : 'border-white/50 hover:bg-white/60 ring-1 ring-white/50'
                  }`}
                  onClick={() => updateCart(p, 1)}
                >
                  {qty > 0 && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {qty}
                    </span>
                  )}
                  <h4 className="font-semibold text-slate-800 text-sm leading-snug pr-5">{p.name}</h4>
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-emerald-600">
                        ₹{Number(p.selling_price).toFixed(2)}
                        {p.unit && <span className="text-xs text-slate-500 font-medium ml-1">/ {p.unit}</span>}
                      </span>
                      {hasCustomPrice && originalPrice !== undefined && (
                        <span className="text-xs text-slate-400 line-through">
                          ₹{Number(originalPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                    {hasPreviousPrice && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-500/20 px-1.5 py-0.5 rounded w-fit border border-emerald-500/30">
                        Last purchased price
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add free-text item */}
            {search.trim().length > 0 && !products.some(p => p.name.toLowerCase() === search.trim().toLowerCase()) && (() => {
              const parsed = parseQuantityUnit(search.trim());
              return (
                <div
                  className="p-3 rounded-xl border border-dashed border-emerald-400/50 bg-emerald-500/10 cursor-pointer hover:bg-emerald-500/20 flex flex-col items-center justify-center text-center gap-1"
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
                  <Plus className="w-6 h-6 text-emerald-600" />
                  <h4 className="font-medium text-emerald-800 text-sm leading-snug">Add "{search.trim()}"</h4>
                  <div className="text-emerald-600/70 text-[10px]">
                    {parsed ? `${parsed.quantity} ${parsed.unit}` : 'draft product'}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Cart */}
        <div className="flex-shrink-0 bg-white/60 backdrop-blur-3xl backdrop-saturate-150 border-t border-white/50 px-4 pt-4 pb-4 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.1)] z-10 glass-sheen-sm rounded-b-3xl">
          <div className="flex items-center gap-2 mb-3 font-semibold text-slate-800 text-sm">
            <ShoppingCart className="w-4 h-4" />
            Cart ({cartItems.length} items)
          </div>

          <div className="max-h-36 overflow-y-auto space-y-2.5 mb-3 pr-1">
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
                      list="unit-options"
                      className="bg-white/50 border border-white/60 text-slate-600 text-xs rounded outline-none focus:ring-1 focus:ring-emerald-500 py-1 px-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] cursor-text w-16"
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
              <p className="text-slate-400 text-xs text-center py-2">Your cart is empty.</p>
            )}
          </div>

          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-slate-600">Total</span>
            <span className="font-bold text-lg text-slate-800">₹{cartTotal.toFixed(2)}</span>
          </div>

          <Button
            className="w-full h-11 text-base font-semibold"
            disabled={cartItems.length === 0 || submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Submitting...' : 'Submit Order'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
