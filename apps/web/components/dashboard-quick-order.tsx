'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Search, 
  CheckCircle2, 
  CreditCard, 
  QrCode, 
  User, 
  X, 
  Printer, 
  Phone, 
  Clock, 
  ChevronDown, 
  ArrowRight,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import apiClient from '@/lib/api-client';
import { VoiceOrderMicButton } from '@/components/voice-order-mic-button';
import { vibrateScanSuccess } from '@/lib/haptics';
import { useOfflineStore } from '@/lib/offline-store';
import { type ParsedVoiceItem } from '@/lib/use-voice-order';

interface Product {
  id: string;
  name: string;
  selling_price: string | number;
  category?: string | null;
  is_available?: boolean;
  unit?: string;
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface DashboardQuickOrderProps {
  businessId: string;
  isPharmacy?: boolean;
}

export function DashboardQuickOrder({ businessId, isPharmacy = false }: DashboardQuickOrderProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [customerName, setCustomerName] = useState('Walk-in');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{ id: string; orderNumber: string; total: number; method: string } | null>(null);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiQrUrl, setUpiQrUrl] = useState<string | null>(null);
  const enqueueOrder = useOfflineStore((s) => s.enqueueOrder);

  // Load products and customers
  useEffect(() => {
    if (!businessId) return;
    let mounted = true;

    async function loadData() {
      try {
        const [prodRes, custRes, bizRes] = await Promise.allSettled([
          apiClient.get<Product[]>('/api/products', { params: { businessId, limit: 50 } }),
          apiClient.get<Customer[]>('/api/customers', { params: { businessId, limit: 50 } }),
          apiClient.get<{ upi_qr_url?: string | null }>(`/api/businesses/${businessId}`),
        ]);

        if (!mounted) return;

        if (prodRes.status === 'fulfilled') {
          setProducts(prodRes.value.data.filter((p) => p.is_available !== false));
        }
        if (custRes.status === 'fulfilled') {
          setCustomers(custRes.value.data);
        }
        if (bizRes.status === 'fulfilled' && bizRes.value.data?.upi_qr_url) {
          setUpiQrUrl(bizRes.value.data.upi_qr_url);
        }
      } catch (err) {
        console.error('Failed to load Quick Order data', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [businessId]);

  // Keyboard shortcut: F2 for Quick Cash
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'F2' && Object.keys(cart).length > 0 && !submitting) {
        e.preventDefault();
        handleExecuteOrder('cash');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, submitting]);

  // Cart operations
  const addToCart = (product: Product, delta = 1) => {
    try { vibrateScanSuccess(); } catch (e) {}
    setCart((prev) => {
      const existing = prev[product.id];
      const newQty = (existing?.quantity || 0) + delta;
      if (newQty <= 0) {
        const updated = { ...prev };
        delete updated[product.id];
        return updated;
      }
      return {
        ...prev,
        [product.id]: {
          product,
          quantity: newQty,
        },
      };
    });
  };

  const clearCart = () => setCart({});

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + Number(item.product.selling_price) * item.quantity,
    0
  );
  const totalItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Filter products for fast selection
  const filteredProducts = search.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : products.slice(0, 8); // Top 8 fast-picks when no search

  // Handle Voice Order items
  const handleVoiceItemsMatched = (matched: ParsedVoiceItem[]) => {
    matched.forEach((m) => {
      addToCart(m.product, m.quantity);
    });
  };

  // ⚡ 1-Click Order Execution (Cash, UPI, Credit)
  const handleExecuteOrder = async (paymentMode: 'cash' | 'upi' | 'credit') => {
    if (!businessId || cartItems.length === 0 || submitting) return;
    setSubmitting(true);
    setSuccessOrder(null);

    const payload = {
      businessId,
      customerId: customerId || undefined,
      customerName: customerName.trim() || 'Walk-in',
      phone: customerPhone ? customerPhone.replace(/\D/g, '').slice(-10) : undefined,
      orderType: 'regular',
      items: cartItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        unit: item.product.unit || 'pcs',
        unitPrice: Number(item.product.selling_price),
      })),
    };

    try {
      const res = await apiClient.post<{ id: string; order_number: string; total_amount: string | number }>(
        '/api/orders',
        payload
      );
      const orderId = res.data.id;
      const orderNum = res.data.order_number;

      // If Cash or UPI, immediately mark as paid
      if (paymentMode === 'cash' || paymentMode === 'upi') {
        try {
          await apiClient.patch(`/api/orders/${orderId}/status`, { status: 'paid' }, { params: { businessId } });
        } catch (e) {
          console.warn('Status patch warning', e);
        }
      }

      // Play success haptic
      try { vibrateScanSuccess(); } catch (e) {}

      // Fire global update so Dashboard stats refresh immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('order-updated'));
      }

      setSuccessOrder({
        id: orderId,
        orderNumber: orderNum,
        total: cartTotal,
        method: paymentMode.toUpperCase(),
      });

      // Clear the cart for the next order
      setCart({});
      setSearch('');

      // Auto-dismiss success notification after 7 seconds
      setTimeout(() => {
        setSuccessOrder(null);
      }, 7000);
    } catch (err: any) {
      if (!err.response) {
        // Offline queue
        await enqueueOrder(businessId, payload);
        setSuccessOrder({
          id: 'offline-' + Date.now(),
          orderNumber: 'OFFLINE',
          total: cartTotal,
          method: `${paymentMode.toUpperCase()} (QUEUED)`,
        });
        setCart({});
      } else {
        alert(err.response?.data?.message || 'Failed to execute quick order');
      }
    } finally {
      setSubmitting(false);
      setShowUpiModal(false);
    }
  };

  return (
    <div className="rounded-3xl bg-gradient-to-br from-white/90 via-white/80 to-slate-50/90 backdrop-blur-xl border border-white/60 p-4 sm:p-5 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.12),inset_0_1px_2px_rgba(255,255,255,0.8)] relative overflow-hidden transition-all space-y-4">
      {/* Background ambient accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-400/10 via-emerald-400/10 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Header bar: Title + Walk-in selector */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-sm shadow-orange-500/20">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm sm:text-base tracking-tight flex items-center gap-1.5">
              <span>2-Click Quick Order</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                Instant Counter POS
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Tap items &rarr; tap Quick Cash or UPI. Settled in 2 seconds.
            </p>
          </div>
        </div>

        {/* Customer Badge / Pill */}
        <button
          type="button"
          onClick={() => setShowCustomerModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/70 border border-slate-200/80 hover:bg-white text-slate-700 text-xs font-semibold shadow-xs transition active:scale-95"
        >
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span className="max-w-[120px] truncate">{customerName}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
      </div>

      {/* Success Notification Bar */}
      {successOrder && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">
              Order #{successOrder.orderNumber} settled for ₹{successOrder.total.toFixed(2)} ({successOrder.method})!
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => window.open(`/api/orders/${successOrder.id}/receipt`, '_blank')}
              className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition flex items-center gap-1"
            >
              <Printer className="w-3 h-3" /> Print
            </button>
            <button
              onClick={() => setSuccessOrder(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Quick Search & Voice Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isPharmacy ? "Search medicines or tap quick-picks..." : "Search products or tap quick-picks..."}
            className="pl-9 pr-4 h-10 rounded-2xl border-white/60 bg-white/60 backdrop-blur-md text-xs sm:text-sm placeholder:text-slate-400 focus-visible:ring-emerald-500/50 shadow-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <VoiceOrderMicButton
          catalog={products}
          onItemsMatched={handleVoiceItemsMatched}
        />
      </div>

      {/* Fast-Picks Product Grid / Chips */}
      <div>
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
          <span>{search ? 'Search Results' : '🔥 Fast-Picks (1-Tap Add)'}</span>
          <span>{products.length} products available</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading catalog...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">No matching products found.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {filteredProducts.map((p) => {
              const inCart = cart[p.id];
              const qty = inCart?.quantity || 0;

              return (
                <div
                  key={p.id}
                  onClick={() => addToCart(p, 1)}
                  className={`p-2.5 rounded-2xl border transition-all duration-150 cursor-pointer flex flex-col justify-between select-none active:scale-[0.98] ${
                    qty > 0
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-xs shadow-emerald-500/10'
                      : 'bg-white/60 hover:bg-white border-white/80 hover:border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="space-y-0.5">
                    <h4 className="font-bold text-xs text-slate-800 line-clamp-1 leading-snug">
                      {p.name}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      ₹{Number(p.selling_price).toFixed(2)} {p.unit ? `/${p.unit}` : ''}
                    </p>
                  </div>

                  {/* Bottom Counter / Add Pill */}
                  <div className="pt-2 flex items-center justify-between mt-auto">
                    {qty > 0 ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 bg-emerald-600 text-white rounded-xl px-1.5 py-0.5 text-xs font-bold shadow-xs"
                      >
                        <button
                          type="button"
                          onClick={() => addToCart(p, -1)}
                          className="w-4 h-4 flex items-center justify-center hover:bg-emerald-700 rounded transition"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="min-w-[12px] text-center">{qty}</span>
                        <button
                          type="button"
                          onClick={() => addToCart(p, 1)}
                          className="w-4 h-4 flex items-center justify-center hover:bg-emerald-700 rounded transition"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-lg bg-slate-100/80 group-hover:bg-emerald-500 group-hover:text-white transition">
                        + Add
                      </span>
                    )}
                    <span className="font-bold text-xs text-slate-700">
                      ₹{(Number(p.selling_price) * (qty || 1)).toFixed(0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ⚡ 2-Click Settle Dock (Appears when cart has items) */}
      {cartItems.length > 0 && (
        <div className="pt-3 border-t border-slate-200/60 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Cart Chips & Total */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap flex-1">
              <span className="text-xs font-bold text-slate-700">
                Cart ({totalItemCount}):
              </span>
              {cartItems.map((item) => (
                <span
                  key={item.product.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700"
                >
                  <span className="max-w-[90px] truncate">{item.product.name}</span>
                  <span className="font-bold text-slate-900">×{item.quantity}</span>
                  <button
                    onClick={() => addToCart(item.product, -item.quantity)}
                    className="text-slate-400 hover:text-rose-500 ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearCart}
                className="text-[10px] font-semibold text-rose-500 hover:underline px-1"
              >
                Clear
              </button>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Due</span>
              <span className="text-lg font-black text-slate-900 tracking-tight">
                ₹{cartTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* THE 2-CLICK ACTION BUTTONS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* Click 2A: Instant Cash */}
            <Button
              type="button"
              disabled={submitting}
              onClick={() => handleExecuteOrder('cash')}
              className="h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/25 active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <Zap className="w-4 h-4 fill-current text-amber-300" />
              <span>{submitting ? 'Settling...' : '⚡ Quick Cash'}</span>
            </Button>

            {/* Click 2B: Instant UPI QR */}
            <Button
              type="button"
              disabled={submitting}
              onClick={() => {
                if (upiQrUrl) {
                  setShowUpiModal(true);
                } else {
                  handleExecuteOrder('upi');
                }
              }}
              className="h-12 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:opacity-95 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-indigo-600/25 active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <QrCode className="w-4 h-4 text-cyan-300" />
              <span>📲 Instant UPI</span>
            </Button>

            {/* Click 2C: Credit / Khata (Span 2 on mobile or 1 on desktop) */}
            <Button
              type="button"
              disabled={submitting}
              onClick={() => handleExecuteOrder('credit')}
              variant="outline"
              className="col-span-2 sm:col-span-1 h-12 rounded-2xl border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <Clock className="w-4 h-4 text-amber-500" />
              <span>⏳ Credit / Due</span>
            </Button>
          </div>
        </div>
      )}

      {/* Customer Selector Modal */}
      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent className="max-w-md p-5 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">
              Select or Enter Customer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Customer Name</label>
              <Input
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setCustomerId('');
                }}
                placeholder="Walk-in, Raj Kumar, etc."
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">WhatsApp / Mobile Number (Optional)</label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="h-10 rounded-xl"
              />
            </div>

            {/* Quick customer pick list */}
            {customers.length > 0 && (
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase">Recent Regulars</label>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerName('Walk-in');
                      setCustomerId('');
                      setCustomerPhone('');
                      setShowCustomerModal(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-100 flex items-center justify-between"
                  >
                    <span>Walk-in Customer</span>
                    <span className="text-[10px] text-slate-400">Default</span>
                  </button>
                  {customers.slice(0, 10).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCustomerName(c.name);
                        setCustomerId(c.id);
                        if (c.phone) setCustomerPhone(c.phone);
                        setShowCustomerModal(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-medium hover:bg-slate-100 flex items-center justify-between"
                    >
                      <span className="font-semibold text-slate-800">{c.name}</span>
                      {c.phone && <span className="text-[11px] text-slate-400">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={() => setShowCustomerModal(false)}
              className="w-full h-10 rounded-xl bg-slate-900 text-white font-bold text-xs"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dynamic Instant UPI Modal */}
      <Dialog open={showUpiModal} onOpenChange={setShowUpiModal}>
        <DialogContent className="max-w-sm p-6 rounded-3xl text-center space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              Scan & Pay ₹{cartTotal.toFixed(2)}
            </DialogTitle>
          </DialogHeader>

          {upiQrUrl && (
            <div className="p-3 bg-white rounded-2xl border border-slate-200 inline-block mx-auto shadow-md">
              <img
                src={upiQrUrl}
                alt="Store UPI QR Code"
                className="w-48 h-48 object-contain mx-auto"
              />
            </div>
          )}

          <p className="text-xs text-slate-500">
            Ask customer to scan using Google Pay, PhonePe, Paytm, or BHIM.
          </p>

          <Button
            type="button"
            disabled={submitting}
            onClick={() => handleExecuteOrder('upi')}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-sm shadow-md shadow-emerald-600/25 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5 text-white" />
            <span>Payment Received (Mark Paid)</span>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
