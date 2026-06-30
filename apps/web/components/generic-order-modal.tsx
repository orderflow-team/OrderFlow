'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import apiClient from '@/lib/api-client';
import { parseQuantityUnit } from '@/lib/parse-quantity-unit';
import { ShoppingCart, Plus, Minus, Search, Trash2 } from 'lucide-react';

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
}

interface Customer {
  id: string;
  name: string;
}

interface GenericOrderModalProps {
  businessId: string;
  isOpen: boolean;
  customers: Customer[];
  onClose: () => void;
  onSubmit: (items: CartItem[], customerId: string, customerName: string) => Promise<void>;
}

export function GenericOrderModal({ businessId, isOpen, customers, onClose, onSubmit }: GenericOrderModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && businessId && products.length === 0) {
      loadData();
    }
  }, [isOpen, businessId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiClient.get<Product[]>('/api/products', { params: { businessId, isDraft: 'all' } }),
        apiClient.get<Category[]>('/api/categories', { params: { businessId } }),
      ]);
      setProducts(prodRes.data.filter(p => p.is_available && p.name !== 'Table Session Started'));
      const uniqueCategories = (data: Category[]) => {
        const seen = new Set();
        return data.filter(c => {
          if (seen.has(c.name)) return false;
          seen.add(c.name);
          return true;
        });
      };
      setCategories(uniqueCategories(catRes.data));
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

  const updateCart = (product: Product, delta: number) => {
    setCart(prev => {
      const newCart = { ...prev };
      const current = newCart[product.id]?.quantity || 0;
      const next = current + delta;
      
      if (next <= 0) {
        delete newCart[product.id];
      } else {
        newCart[product.id] = { product, quantity: next };
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
          product: { ...newCart[productId].product, selling_price: newPrice }
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
      await onSubmit(items, customerId, customerName);
      setCart({});
      setCustomerName('');
      setCustomerId('');
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
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col bg-white overflow-hidden rounded-xl">
        <DialogHeader className="p-5 border-b border-slate-100 flex-shrink-0 space-y-4">
          <DialogTitle className="text-xl">New Order</DialogTitle>
          <div className="relative">
            <Input 
              list="customers-list" 
              placeholder="Customer name (Walk-in by default)" 
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                const existing = customers?.find(c => c.name === e.target.value);
                setCustomerId(existing ? existing.id : '');
              }}
              className="w-full h-10"
            />
            {customers && (
              <datalist id="customers-list">
                {customers.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 flex flex-col gap-5">
          {/* Categories */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <div 
                className={`px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${
                  selectedCategory === null ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => setSelectedCategory(null)}
              >
                All
              </div>
              {categories.map(c => (
                <div 
                  key={c.id} 
                  className={`px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer transition-colors ${
                    selectedCategory === c.name ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
              className="pl-9 h-10 bg-white" 
              placeholder="Search products..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Menu Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            {filteredProducts.map(p => {
              const qty = cart[p.id]?.quantity || 0;
              return (
                <div
                  key={p.id}
                  className={`p-5 rounded-xl border bg-white cursor-pointer transition-all space-y-2 ${qty > 0 ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-emerald-300'}`}
                  onClick={() => updateCart(p, 1)}
                >
                  <h4 className="font-medium text-slate-800 leading-snug">{p.name}</h4>
                  <div className="text-emerald-600 font-semibold">₹{Number(p.selling_price).toFixed(2)}</div>
                  {qty > 0 && <div className="text-emerald-600 text-xs font-medium pt-1">{qty} in cart</div>}
                </div>
              );
            })}
            
            {search.trim().length > 0 && !products.some(p => p.name.toLowerCase() === search.trim().toLowerCase()) && (() => {
               const parsed = parseQuantityUnit(search.trim());
               return (
                 <div
                    className="p-5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 cursor-pointer transition-all hover:bg-emerald-50 space-y-2 flex flex-col items-center justify-center text-center"
                    onClick={() => {
                      const tempProduct: Product = {
                        id: 'draft-' + Date.now(),
                        name: search.trim(),
                        selling_price: 0,
                        category: null,
                        is_available: true,
                        unit: parsed?.unit,
                      };
                      updateCart(tempProduct, 1);
                      setSearch('');
                    }}
                 >
                   <Plus className="w-8 h-8 text-emerald-600 mb-1" />
                   <h4 className="font-medium text-emerald-800 leading-snug">Add "{search.trim()}"</h4>
                   <div className="text-emerald-600/70 text-xs">
                     Create as draft product
                     {parsed ? ` · ${parsed.quantity} ${parsed.unit}` : ' (₹0)'}
                   </div>
                 </div>
               );
            })()}
          </div>
        </div>

        {/* Cart Bottom Sheet */}
        <div className="flex-shrink-0 bg-white border-t border-slate-200 p-5 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] z-10">
          <div className="flex items-center gap-2 mb-4 font-semibold text-slate-800">
            <ShoppingCart className="w-5 h-5" />
            Cart ({cartItems.length} items)
          </div>
          
          <div className="max-h-40 overflow-y-auto space-y-3 mb-4 pr-2">
            {cartItems.map(item => (
              <div key={item.product.id} className="flex justify-between items-center text-sm">
                <span className="text-slate-700 truncate pr-4 flex-1">{item.product.name}</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
                    <button onClick={() => updateCart(item.product, -1)} className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-200">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-4 text-center font-medium">{item.quantity}</span>
                    <button onClick={() => updateCart(item.product, 1)} className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-200">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => setCart(prev => { const n = { ...prev }; delete n[item.product.id]; return n; })}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex flex-col items-end w-24">
                    <div className="flex items-center gap-1 border border-slate-200 rounded px-1.5 focus-within:ring-1 focus-within:ring-emerald-500 bg-white overflow-hidden transition-all">
                      <span className="text-slate-400 text-xs font-semibold">₹</span>
                      <input
                        type="number"
                        className="w-14 h-7 text-right text-sm font-semibold text-slate-800 bg-transparent outline-none p-0"
                        value={item.product.selling_price}
                        onChange={(e) => updateCartPrice(item.product.id, e.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    {item.quantity > 1 && (
                      <span className="text-[10px] text-slate-500 font-medium mt-1">
                        Sub: ₹{(Number(item.product.selling_price) * item.quantity).toFixed(2)}
                      </span>
                    )}
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
          
          <Button 
            className="w-full mt-4 h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white" 
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
