import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import apiClient from '@/lib/api-client';
import { ShoppingCart, Plus, Minus, Search } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  selling_price: string | number;
  category: string | null;
  is_available: boolean;
}

interface Category {
  id: string;
  name: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
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
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 gap-0 flex flex-col bg-white overflow-hidden rounded-xl">
        <DialogHeader className="p-5 border-b border-slate-100 flex-shrink-0">
          <DialogTitle className="text-xl">Add Items — {guestName}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 flex flex-col gap-5">
          {/* Categories */}
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

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              className="pl-9 h-10 bg-white" 
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
                  className={`relative p-3 rounded-xl border bg-white cursor-pointer transition-all ${qty > 0 ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-emerald-300'}`}
                  onClick={() => updateCart(p, 1)}
                >
                  {qty > 0 && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {qty}
                    </span>
                  )}
                  <h4 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2 pr-4">{p.name}</h4>
                  <div className="text-emerald-600 font-bold text-sm mt-2">₹{Number(p.selling_price).toFixed(2)}</div>
                </div>
              );
            })}
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
                  <span className="font-semibold text-slate-800 w-16 text-right">
                    ₹{(Number(item.product.selling_price) * item.quantity).toFixed(2)}
                  </span>
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
