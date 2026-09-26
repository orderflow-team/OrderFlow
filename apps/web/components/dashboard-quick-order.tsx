'use client';

import React, { useState, useEffect } from 'react';
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
import apiClient from '@/lib/api-client';
import { VoiceOrderMicButton } from '@/components/voice-order-mic-button';
import { vibrateScanSuccess } from '@/lib/haptics';
import { useOfflineStore } from '@/lib/offline-store';
import { type ParsedVoiceItem } from '@/lib/use-voice-order';
import { getCached } from '@/lib/offline-db';
import { instantPrintReceipt, buildReceiptHtml } from '@/lib/receipt-template';

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DashboardQuickOrder({ 
  businessId, 
  isPharmacy = false, 
  open, 
  onOpenChange 
}: DashboardQuickOrderProps) {
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
  const [printing, setPrinting] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{ 
    id: string; 
    orderNumber: string; 
    total: number; 
    method: string;
    items: CartItem[];
    customerName: string;
  } | null>(null);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiQrUrl, setUpiQrUrl] = useState<string | null>(null);
  const enqueueOrder = useOfflineStore((s) => s.enqueueOrder);

  // Load products and customers when dialog opens
  useEffect(() => {
    if (!businessId || !open) return;
    let mounted = true;

    async function loadData() {
      try {
        const [prodRes, custRes, bizRes] = await Promise.allSettled([
          apiClient.get<Product[]>('/api/products', { params: { businessId, limit: 60 } }),
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
  }, [businessId, open]);

  // Handle Escape key and F2 Quick Cash
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      } else if (e.key === 'F2' && Object.keys(cart).length > 0 && !submitting) {
        e.preventDefault();
        handleExecuteOrder('cash');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, submitting, open, onOpenChange]);

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
    : products.slice(0, 12);

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
        items: [...cartItems],
        customerName: customerName.trim() || 'Walk-in',
      });

      // Clear the cart for next order
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
          items: [...cartItems],
          customerName: customerName.trim() || 'Walk-in',
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

  // Instant Print directly to connected printer (Zero browser tabs)
  const handleInstantPrint = async () => {
    if (!successOrder || printing) return;
    setPrinting(true);
    try {
      let receiptHtml = '';
      try {
        // 1. Fetch server formatted receipt if available
        const res = await apiClient.get<string>(`/api/orders/${successOrder.id}/receipt`, {
          params: { businessId },
          responseType: 'text',
        });
        receiptHtml = res.data;
      } catch (err) {
        // 2. Offline fallback: render thermal receipt instantly from local data
        const business = await getCached(businessId, 'business-profile');
        receiptHtml = buildReceiptHtml({
          business: business as any,
          orderNumber: successOrder.orderNumber,
          createdAt: new Date(),
          customerName: successOrder.customerName,
          items: successOrder.items.map((it) => ({
            name: it.product.name,
            quantity: it.quantity,
            unit: it.product.unit || 'pcs',
            unitPrice: Number(it.product.selling_price),
            subtotal: Number(it.product.selling_price) * it.quantity,
          })),
          totalAmount: successOrder.total,
        });
      }

      await instantPrintReceipt(receiptHtml);
    } catch (err) {
      console.error('Instant print failed', err);
    } finally {
      setPrinting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
      />

      {/* Sheet Container: Bottom Sheet on Mobile, Centered Modal on Tablet/Desktop */}
      <div className="relative z-10 w-full sm:max-w-2xl md:max-w-3xl max-h-[82dvh] sm:max-h-[85vh] flex flex-col bg-slate-50/98 backdrop-blur-2xl rounded-t-3xl sm:rounded-3xl border border-white/80 shadow-[0_20px_50px_rgba(15,23,42,0.3)] overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 sm:zoom-in-95 duration-200">
        {/* Mobile Pull Handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white/80 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* 1. Header Bar */}
        <div className="px-5 py-3.5 bg-white/80 border-b border-slate-200/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/25 shrink-0">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-800 text-base sm:text-lg tracking-tight truncate">
                  Quick Order POS
                </h3>
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 shrink-0">
                  Instant Counter
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Tap items &rarr; tap Quick Cash or UPI. 2-click settlement.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Customer Pill Button */}
            <button
              type="button"
              onClick={() => setShowCustomerModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition active:scale-95"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="max-w-[100px] truncate">{customerName}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition active:scale-90"
              aria-label="Close Quick Order"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
          {/* Success Notification Bar */}
          {successOrder && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-950 text-xs font-semibold flex items-center justify-between gap-2 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="truncate">
                  Order #{successOrder.orderNumber} settled for <strong>₹{successOrder.total.toFixed(2)}</strong> ({successOrder.method})!
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={printing}
                  onClick={handleInstantPrint}
                  className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 shadow-xs transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <Printer className="w-3 h-3" />
                  <span>{printing ? 'Printing...' : 'Print'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSuccessOrder(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Search & Voice Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isPharmacy ? "Search medicines or tap quick-picks below..." : "Search products or tap quick-picks below..."}
                className="pl-9 pr-8 h-11 rounded-2xl border-slate-200 bg-white shadow-xs text-xs sm:text-sm placeholder:text-slate-400 focus-visible:ring-emerald-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <VoiceOrderMicButton
              catalog={products}
              onItemsMatched={handleVoiceItemsMatched}
            />
          </div>

          {/* Fast-Picks Product Grid */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
              <span>{search ? 'Search Results' : '🔥 Fast-Picks (1-Tap Add)'}</span>
              <span>{products.length} products in stock</span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400 animate-pulse">Loading catalog...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">No matching products found.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredProducts.map((p) => {
                  const inCart = cart[p.id];
                  const qty = inCart?.quantity || 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => addToCart(p, 1)}
                      className={`p-3 rounded-2xl border transition-all duration-150 cursor-pointer flex flex-col justify-between select-none active:scale-[0.98] ${
                        qty > 0
                          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-xs shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                          : 'bg-white hover:bg-slate-50/80 border-slate-200/80 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <h4 className="font-bold text-xs text-slate-800 line-clamp-1 leading-snug">
                          {p.name}
                        </h4>
                        <p className="text-[11px] font-semibold text-slate-400">
                          ₹{Number(p.selling_price).toFixed(2)} {p.unit ? `/${p.unit}` : ''}
                        </p>
                      </div>

                      {/* Bottom Counter / Add Pill */}
                      <div className="pt-2.5 flex items-center justify-between mt-auto">
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
                            <span className="min-w-[14px] text-center font-black">{qty}</span>
                            <button
                              type="button"
                              onClick={() => addToCart(p, 1)}
                              className="w-4 h-4 flex items-center justify-center hover:bg-emerald-700 rounded transition"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-extrabold text-emerald-700 px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200">
                            + Add
                          </span>
                        )}
                        <span className="font-extrabold text-xs text-slate-800">
                          ₹{(Number(p.selling_price) * (qty || 1)).toFixed(0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 3. Bottom Sticky Settle Dock */}
        {cartItems.length > 0 ? (
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom,20px))] bg-white border-t border-slate-200/90 shadow-[0_-8px_25px_rgba(15,23,42,0.06)] space-y-3 shrink-0">
            {/* Cart summary chips */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                <span className="text-xs font-bold text-slate-700">
                  Cart ({totalItemCount}):
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5">
                  {cartItems.map((item) => (
                    <span
                      key={item.product.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700 shrink-0"
                    >
                      <span className="max-w-[85px] truncate">{item.product.name}</span>
                      <span className="font-bold text-slate-900">×{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => addToCart(item.product, -item.quantity)}
                        className="text-slate-400 hover:text-rose-500 ml-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[10px] font-semibold text-rose-500 hover:underline px-1 shrink-0"
                >
                  Clear
                </button>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Total Due</span>
                <span className="text-xl font-black text-slate-900 tracking-tight leading-none mt-1 block">
                  ₹{cartTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* The 1-Click Action Buttons */}
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

              {/* Click 2C: Credit / Khata */}
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
        ) : (
          <div className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,16px))] bg-slate-100/70 border-t border-slate-200/80 text-center text-xs text-slate-400 font-medium shrink-0">
            Tap any product or speak above to add to cart
          </div>
        )}

        {/* 4. Internal Customer Picker Overlay */}
        {showCustomerModal && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-3.5 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-800 text-sm">Select Customer</h4>
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Customer Name</label>
                <Input
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setCustomerId('');
                  }}
                  placeholder="Walk-in, Raj Kumar, etc."
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Mobile Number (Optional)</label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              {/* Quick regular customer list */}
              {customers.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Frequent Regulars</span>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerName('Walk-in');
                        setCustomerId('');
                        setCustomerPhone('');
                        setShowCustomerModal(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-slate-100 flex items-center justify-between"
                    >
                      <span className="font-semibold text-slate-800">Walk-in Customer</span>
                      <span className="text-[10px] text-slate-400">Default</span>
                    </button>
                    {customers.slice(0, 8).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomerName(c.name);
                          setCustomerId(c.id);
                          if (c.phone) setCustomerPhone(c.phone);
                          setShowCustomerModal(false);
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-slate-100 flex items-center justify-between"
                      >
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        {c.phone && <span className="text-[10px] text-slate-400">{c.phone}</span>}
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
                Confirm Customer
              </Button>
            </div>
          </div>
        )}

        {/* 5. Internal Dynamic UPI QR Overlay */}
        {showUpiModal && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-900 text-base">
                  Scan & Pay ₹{cartTotal.toFixed(2)}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowUpiModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {upiQrUrl && (
                <div className="p-3 bg-white rounded-2xl border border-slate-200 inline-block mx-auto shadow-md">
                  <img
                    src={upiQrUrl}
                    alt="Store UPI QR Code"
                    className="w-44 h-44 object-contain mx-auto"
                  />
                </div>
              )}

              <p className="text-xs text-slate-500">
                Customer scans using Google Pay, PhonePe, Paytm, or BHIM.
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
