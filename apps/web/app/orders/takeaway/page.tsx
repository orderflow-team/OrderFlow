'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { Coffee, Plus, ShoppingBag, CheckCircle } from 'lucide-react';
import { MenuSelectionModal, CartItem } from '@/components/menu-selection-modal';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  token_number: number | null;
  status: string;
  total_amount: string;
  items: OrderItem[];
  created_at: string;
}

interface OrderItem {
  id: string;
  product_id: string | null;
  custom_product_name: string | null;
  quantity: number;
  unit_price: string;
  subtotal: string;
  product?: { name: string };
}

function TakeawayGuestContent() {
  const searchParams = useSearchParams();
  const isCustomerMode = searchParams?.get('customerMode') === '1';
  const { businessId, ready } = useBusiness();

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMenuModal, setShowMenuModal] = useState(false);

  // Lock page scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const loadOrderData = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const orderId = localStorage.getItem('guest_takeaway_order_id');
      if (orderId) {
        const orderRes = await apiClient.get<Order>(`/api/orders/${orderId}`, { params: { businessId } });
        if (orderRes.data && orderRes.data.status !== 'paid' && orderRes.data.status !== 'cancelled') {
          setActiveOrder(orderRes.data);
        } else {
          setActiveOrder(null);
          localStorage.removeItem('guest_takeaway_order_id');
        }
      } else {
        setActiveOrder(null);
      }
    } catch (err) {
      console.error(err);
      setActiveOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && businessId) {
      loadOrderData();
    }
  }, [ready, businessId]);

  useEffect(() => {
    if (ready && !activeOrder && !loading && isCustomerMode) {
      setShowMenuModal(true);
    }
  }, [ready, activeOrder, loading, isCustomerMode]);

  const handleAddItems = async (items: CartItem[]) => {
    try {
      const payloadItems = items.map(i => ({
        productId: i.product.id,
        quantity: i.quantity,
        unitPrice: Number(i.product.selling_price),
      }));

      if (activeOrder) {
        await apiClient.post(`/api/orders/${activeOrder.id}/items`, { items: payloadItems }, { params: { businessId } });
      } else {
        const res = await apiClient.post('/api/orders', {
          businessId,
          customerName: 'Take Away Guest',
          orderType: 'take_away',
          items: payloadItems,
        });
        if (res.data?.id) {
          localStorage.setItem('guest_takeaway_order_id', res.data.id);
        }
      }
      setShowMenuModal(false);
      loadOrderData();
    } catch (err) {
      console.error(err);
    }
  };

  if (!ready || loading) return (
    <AppShell hideNavigation={isCustomerMode}>
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-slate-400">
        <Coffee className="w-8 h-8 animate-pulse" />
        <span className="text-sm">Loading takeaway menu...</span>
      </div>
    </AppShell>
  );

  return (
    <AppShell hideNavigation={isCustomerMode}>
      <div className="h-[100dvh] flex flex-col bg-slate-50/50">
        <div className="flex-1 flex flex-col overflow-hidden max-w-2xl mx-auto w-full border-x bg-white animate-fade-in">
          
          {/* Header */}
          <div className="border-b bg-white shrink-0 px-4 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-800">Self-Service Takeaway</h1>
                <p className="text-[10px] text-slate-400 font-medium">Browse & order on your own phone</p>
              </div>
            </div>
          </div>

          {!activeOrder ? (
            /* Free state / no items in card */
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 text-center">
              <div className="w-20 h-20 rounded-full bg-amber-500/10 backdrop-blur-sm flex items-center justify-center text-amber-600 ring-1 ring-amber-500/20">
                <ShoppingBag className="w-10 h-10 stroke-[1.5]" />
              </div>
              <div className="max-w-xs space-y-2">
                <h2 className="text-xl font-bold text-slate-800">Ready to Order</h2>
                <p className="text-sm text-slate-400">Add dishes to your cart and place your order.</p>
              </div>
              <Button
                onClick={() => setShowMenuModal(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white gap-2 px-8 h-11 text-sm rounded-full"
              >
                <Plus className="w-4 h-4" /> Add Items
              </Button>
            </div>
          ) : (
            /* Active order / Token layout */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex flex-col items-center py-6 shrink-0">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-800">Order Placed Successfully</h2>
                <p className="text-xs text-slate-500 mt-1">Please show this token at the counter to collect your order</p>
                
                {/* Large Token display */}
                <div className="mt-5 bg-white ring-1 ring-emerald-100 rounded-3xl px-8 py-3 shadow-md flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Token Number</span>
                  <span className="text-3xl font-black text-slate-800 mt-1">#{activeOrder.token_number ?? '—'}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ordered Items</span>
                  <span className="text-xs text-slate-500 font-mono font-bold">#{activeOrder.order_number}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {activeOrder.items.map(item => (
                    <div key={item.id} className="py-3 flex justify-between items-center text-sm">
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800">
                          {item.product?.name || item.custom_product_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          {item.quantity} x ₹{Number(item.unit_price).toFixed(2)}
                        </div>
                      </div>
                      <div className="font-semibold text-slate-800">
                        ₹{Number(item.subtotal).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Bar */}
              <div className="shrink-0 bg-white/50 backdrop-blur-xl border-t p-4 shadow-[0_-6px_20px_-6px_rgba(0,0,0,0.08)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-slate-500">Order Total</span>
                  <span className="text-xl font-extrabold text-slate-800">
                    ₹{Number(activeOrder.total_amount).toFixed(2)}
                  </span>
                </div>
                <Button
                  onClick={() => setShowMenuModal(true)}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white h-11 gap-1.5 text-sm rounded-full"
                >
                  <Plus className="w-4 h-4" /> Add More Items
                </Button>
              </div>

            </div>
          )}

        </div>
      </div>

      <MenuSelectionModal
        businessId={businessId!}
        isOpen={showMenuModal}
        guestName="Take Away Guest"
        onClose={() => setShowMenuModal(false)}
        onSubmit={handleAddItems}
      />
    </AppShell>
  );
}

export default function TakeawayGuestPage() {
  return (
    <React.Suspense fallback={<div className="p-10 text-center text-slate-500">Loading...</div>}>
      <TakeawayGuestContent />
    </React.Suspense>
  );
}
