'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { Coffee, ArrowLeft, Plus, XCircle, SplitSquareHorizontal, Clock, Users } from 'lucide-react';
import { MenuSelectionModal, CartItem } from '@/components/menu-selection-modal';

interface Table {
  id: string;
  name: string;
  capacity: number;
  status: string;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  guest_count: number | null;
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

export default function TableDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const searchParams = useSearchParams();
  const isCustomerMode = searchParams?.get('customerMode') === '1';
  const { businessId, ready } = useBusiness();
  const router = useRouter();

  const [table, setTable] = useState<Table | null>(null);
  const [activeSession, setActiveSession] = useState<Order | null>(null);
  const [previousSessions, setPreviousSessions] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [billingError, setBillingError] = useState('');
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  // Lock page scroll — this page is a single-screen layout
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (ready && businessId) loadTableData();
  }, [ready, businessId]);

  const loadTableData = async () => {
    setLoading(true);
    try {
      const tableRes = await apiClient.get<Table[]>(`/api/restaurant/tables`, { params: { businessId } });
      const currentTable = tableRes.data.find(t => t.id === id);
      if (currentTable) setTable(currentTable);

      const ordersRes = await apiClient.get<Order[]>('/api/orders', { params: { businessId } });
      const tableOrders = ordersRes.data.filter((o: any) => o.table_id === id && o.order_type === 'dine_in');

      const active = tableOrders.find(o => o.status === 'draft' || o.status === 'pending' || o.status === 'confirmed');
      const previous = tableOrders.filter(o => o.status === 'paid');

      if (active) {
        const detailedOrderRes = await apiClient.get<Order>(`/api/orders/${active.id}`, { params: { businessId } });
        setActiveSession(detailedOrderRes.data);
      } else {
        setActiveSession(null);
      }
      setPreviousSessions(previous);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItems = async (items: CartItem[]) => {
    try {
      const payloadItems = items.map(i => ({
        productId: i.product.id,
        quantity: i.quantity,
        unitPrice: Number(i.product.selling_price),
      }));
      if (activeSession) {
        await apiClient.post(`/api/orders/${activeSession.id}/items`, { items: payloadItems }, { params: { businessId } });
      } else {
        await apiClient.post('/api/orders', {
          businessId,
          customerName: `Table ${table?.name}`,
          tableId: table?.id,
          orderType: 'dine_in',
          items: payloadItems,
        });
      }
      loadTableData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseAndPay = async () => {
    if (!activeSession) return;
    setBillingError('');
    try {
      const status = Number(activeSession.total_amount) <= 0 ? 'cancelled' : 'paid';
      await apiClient.patch(`/api/orders/${activeSession.id}/status`, { status }, { params: { businessId } });
      await apiClient.post(`/api/restaurant/tables/${id}/release`, {}, { params: { businessId } });
      loadTableData();
    } catch (err: any) {
      setBillingError(err.response?.data?.message || 'Failed to close session');
    }
  };

  const handleForceRelease = async () => {
    try {
      await apiClient.post(`/api/restaurant/tables/${id}/release`, {}, { params: { businessId } });
      loadTableData();
    } catch (err) {
      console.error(err);
    }
  };

  if (!ready || loading || (!table && !loadingError)) return (
    <AppShell hideNavigation={isCustomerMode}>
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3 text-slate-400">
        <Coffee className="w-8 h-8 animate-pulse" />
        <span className="text-sm">Loading table...</span>
      </div>
    </AppShell>
  );

  if (loadingError) return (
    <AppShell hideNavigation={isCustomerMode}>
      <div className="p-6 text-center text-rose-500 font-bold">{loadingError}</div>
    </AppShell>
  );

  if (!table) return null;

  const isAvailable = table.status === 'available' && !activeSession;
  const isEmpty = !activeSession || !activeSession.items?.length;
  const isZeroBill = !activeSession || Number(activeSession.total_amount) <= 0;

  return (
    <AppShell hideNavigation={isCustomerMode}>
      {/*
        main in AppShell has pt-[60px] pb-16 on mobile = 60+64=124px used.
        So we constrain this page to exactly 100dvh-124px, no page scroll.
      */}
      <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 124px)' }}>

        {/* ── Top bar ── */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white/50 backdrop-blur-xl border-white/40 flex-shrink-0">
          {!isCustomerMode && (
            <button
              onClick={() => router.push('/orders?view=dine_in')}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/40 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-800 truncate">Table {table.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0 ${
                isAvailable
                  ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20'
              }`}>
                {isAvailable ? 'Available' : 'Occupied'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{table.capacity} seats</span>
              {activeSession && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(activeSession.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
          {isAvailable && (
            <Button
              onClick={() => setShowMenuModal(true)}
              className="text-white h-9 px-4 gap-1.5 text-sm flex-shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Items
            </Button>
          )}
        </div>

        {/* ── Body ── */}
        {isAvailable ? (
          /* Available state — centred CTA, previous sessions below */
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col items-center justify-center py-10 px-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-white/40 backdrop-blur-md ring-1 ring-white/50 flex items-center justify-center">
                <Coffee className="w-8 h-8 text-slate-300 stroke-[1.5]" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-semibold text-slate-700 mb-1">Table is free</h3>
                <p className="text-slate-400 text-sm">Tap below to start taking orders</p>
              </div>
              <Button
                onClick={() => setShowMenuModal(true)}
                className="text-white gap-2 px-8 h-11 text-sm rounded-full"
              >
                <Plus className="w-4 h-4" /> Add Items
              </Button>
            </div>

            {previousSessions.length > 0 && !isCustomerMode && (
              <div className="px-4 pb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Previous Sessions</p>
                <div className="space-y-2">
                  {previousSessions.map(session => {
                    const isExpanded = !!expandedSessions[session.id];
                    return (
                      <div key={session.id} className="flex flex-col rounded-2xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 glass-sheen-sm overflow-hidden transition-all duration-200">
                        <div
                          onClick={() => setExpandedSessions(prev => ({ ...prev, [session.id]: !prev[session.id] }))}
                          className="flex justify-between items-center py-3 px-4 cursor-pointer hover:bg-white/10 transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-700">{session.customer_name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {new Date(session.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 font-bold text-emerald-600">
                            <span>₹{Number(session.total_amount).toFixed(2)}</span>
                            <svg
                              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-3 pt-2 border-t border-white/30 bg-white/10 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Session Items</div>
                            <div className="space-y-1.5">
                              {session.items && session.items.length > 0 ? (
                                session.items.map((item) => (
                                  <div key={item.id} className="flex justify-between text-sm text-slate-700">
                                    <span>
                                      {item.product?.name || item.custom_product_name || 'Unknown item'}
                                      <span className="text-xs text-slate-400 font-normal ml-2">x{Number(item.quantity)}</span>
                                    </span>
                                    <span className="font-medium text-slate-800">₹{Number(item.subtotal).toFixed(2)}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-slate-400">No items found in this session.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Occupied state — items list + sticky bottom bar, all within the container */
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Order # label */}
            {activeSession && (
              <div className="px-4 pt-3 pb-1 flex items-center justify-between flex-shrink-0">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Current Order</span>
                <span className="text-[11px] font-mono font-semibold text-slate-500 bg-white/40 backdrop-blur-sm ring-1 ring-white/50 px-2 py-0.5 rounded-full">
                  #{activeSession.order_number}
                </span>
              </div>
            )}

            {/* Items — scrollable zone */}
            <div className="flex-1 overflow-y-auto px-4 pb-3">
              {isEmpty ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                  <Coffee className="w-10 h-10 stroke-[1.5] opacity-25" />
                  <p className="text-sm">No items ordered yet</p>
                </div>
              ) : (
                <div className="bg-white/40 backdrop-blur-md rounded-3xl ring-1 ring-white/50 glass-sheen-sm overflow-hidden">
                  {activeSession!.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between px-4 py-3.5 ${
                        idx !== activeSession!.items.length - 1 ? 'border-b border-slate-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {item.quantity}
                        </span>
                        <span className="text-sm font-medium text-slate-700 truncate">
                          {item.product?.name || item.custom_product_name || 'Item'}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-slate-600 ml-3 flex-shrink-0">
                        ₹{Number(item.subtotal).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom action bar — flex-shrink-0 so it stays at bottom */}
            <div className="flex-shrink-0 bg-white/50 backdrop-blur-xl border-white/40 px-4 pt-3 pb-3 shadow-[0_-6px_20px_-6px_rgba(0,0,0,0.08)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">Running Total</span>
                <span className="text-xl font-extrabold text-slate-800">
                  ₹{Number(activeSession?.total_amount || 0).toFixed(2)}
                </span>
              </div>
              {billingError && (
                <p className="text-xs text-rose-500 font-medium mb-2 text-center">{billingError}</p>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowMenuModal(true)}
                  className="flex-1 h-11 gap-1.5 text-sm"
                >
                  <Plus className="w-4 h-4" /> Add Items
                </Button>
                {!isCustomerMode && (
                  <Button
                    onClick={isZeroBill ? handleForceRelease : handleCloseAndPay}
                    className="flex-1 h-11 gap-1.5 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    {isZeroBill ? (
                      <><XCircle className="w-4 h-4" /> Cancel</>
                    ) : (
                      <><SplitSquareHorizontal className="w-4 h-4" /> Close &amp; Pay</>
                    )}
                  </Button>
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      <MenuSelectionModal
        businessId={businessId!}
        isOpen={showMenuModal}
        guestName={activeSession?.customer_name || `Table ${table.name}`}
        onClose={() => setShowMenuModal(false)}
        onSubmit={handleAddItems}
      />
    </AppShell>
  );
}
