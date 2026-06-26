'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { Coffee, ArrowLeft, Settings, SplitSquareHorizontal, Plus, AlertTriangle, XCircle } from 'lucide-react';
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
  const { businessId, ready } = useBusiness();
  const router = useRouter();
  
  const [table, setTable] = useState<Table | null>(null);
  const [activeSession, setActiveSession] = useState<Order | null>(null);
  const [previousSessions, setPreviousSessions] = useState<Order[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState('');
  const [billingError, setBillingError] = useState('');
  const [showMenuModal, setShowMenuModal] = useState(false);

  useEffect(() => {
    if (ready && businessId) loadTableData();
  }, [ready, businessId]);

  const loadTableData = async () => {
    setLoading(true);
    try {
      // Fetch table details
      const tableRes = await apiClient.get<Table[]>(`/api/restaurant/tables`, { params: { businessId } });
      const currentTable = tableRes.data.find(t => t.id === id);
      if (currentTable) setTable(currentTable);
      
      // Fetch orders for this table (we filter out the active one and previous ones)
      const ordersRes = await apiClient.get<Order[]>('/api/orders', { params: { businessId } });
      // Currently backend doesn't filter by tableId on /api/orders, so we do it client side for now.
      // Wait, Order doesn't expose table_id in the /api/orders payload if we didn't update the Entity mapping, but we added the column.
      // Since it's a new column, TypeORM includes it automatically! Let's hope it's exposed as table_id.
      // Let's just fetch all orders and filter.
      // We will actually just use the ones mapped.
      const tableOrders = ordersRes.data.filter((o: any) => o.table_id === id && o.order_type === 'dine_in');
      
      const active = tableOrders.find(o => o.status === 'draft' || o.status === 'pending' || o.status === 'confirmed');
      const previous = tableOrders.filter(o => o.status === 'paid');
      
      if (active) {
        // Fetch detailed order items
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
        unitPrice: Number(i.product.selling_price)
      }));

      if (activeSession) {
        await apiClient.post(`/api/orders/${activeSession.id}/items`, {
          items: payloadItems
        }, { params: { businessId } });
      } else {
        await apiClient.post('/api/orders', {
          businessId,
          customerName: `Table ${table?.name}`,
          tableId: table?.id,
          orderType: 'dine_in',
          items: payloadItems
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
      if (Number(activeSession.total_amount) <= 0) {
        // If it's a 0 bill, just cancel the order and free the table instead of throwing an error.
        await apiClient.patch(`/api/orders/${activeSession.id}/status`, { status: 'cancelled' }, { params: { businessId } });
      } else {
        // In a real flow, this opens a payment modal. For now, mark as paid.
        await apiClient.patch(`/api/orders/${activeSession.id}/status`, { status: 'paid' }, { params: { businessId } });
      }
      await apiClient.post(`/api/restaurant/tables/${id}/release`, {}, { params: { businessId } });
      loadTableData();
    } catch (err: any) {
      console.error(err);
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
    <AppShell>
      <div className="p-6 text-center text-slate-400">Loading table...</div>
    </AppShell>
  );

  if (loadingError) return (
    <AppShell>
      <div className="p-6 text-center text-rose-500 font-bold">{loadingError}</div>
    </AppShell>
  );

  if (!table) return null;

  const isAvailable = table.status === 'available' && !activeSession;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/orders?view=dine_in')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-slate-800">Table {table.name}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide capitalize ${
                  isAvailable ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/50' : 
                  'bg-blue-50 text-blue-600 ring-1 ring-blue-200/50'
                }`}>
                  {isAvailable ? 'Available' : 'Occupied'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
                <span>{table.capacity} seats</span>
                <Settings className="w-3.5 h-3.5" />
                {!isAvailable && activeSession && (
                  <span>· 1 active session</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            {isAvailable ? (
              <Button onClick={() => setShowMenuModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 gap-1.5 px-6">
                <Plus className="w-4 h-4" /> Add Items
              </Button>
            ) : null}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-slate-100 p-2 text-xs font-mono">
          DEBUG: isAvailable={String(isAvailable)}, activeSession={activeSession ? 'exists' : 'null'}, tableStatus={table.status}, activeSessionItems={activeSession?.items ? 'exists' : 'undefined'}
        </div>
        {isAvailable ? (
          <>
            <Card className="h-[400px] flex flex-col items-center justify-center border border-slate-200 shadow-sm mt-8">
              <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-6 text-slate-400 border border-slate-100">
                <Coffee className="w-10 h-10 stroke-[1.5]" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Table is available</h3>
              <p className="text-slate-500 text-sm mb-8">Add items to start taking orders</p>
              <Button onClick={() => setShowMenuModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8 py-6 text-lg rounded-xl shadow-sm">
                <Plus className="w-5 h-5" /> Add Items
              </Button>
            </Card>

            {/* Previous Sessions list... */}
            {previousSessions.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-4">
                  <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px]">L</span>
                  Previous Sessions ({previousSessions.length})
                </div>
                <div className="space-y-2">
                  {previousSessions.map(session => (
                    <div key={session.id} className="flex justify-between items-center py-4 px-5 rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-500">{new Date(session.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="font-semibold text-slate-800">{session.customer_name}</span>
                      </div>
                      <div className="font-semibold text-emerald-600">
                        ₹{Number(session.total_amount).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : activeSession ? (
          <Card className="mt-8 border border-emerald-100 shadow-sm overflow-hidden">
            <div className="bg-white px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Coffee className="w-5 h-5 text-slate-400" />
                <h3 className="font-bold text-lg text-slate-800">{activeSession.customer_name}</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700">active</span>
              </div>
            </div>
            
            <CardContent className="p-0">
              <div className="px-6 py-2">
                {(activeSession?.items || []).map(item => (
                  <div key={item.id} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0 group">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 font-medium w-6">{item.quantity}x</span>
                      <span className="font-medium text-slate-700">{item.product?.name || item.custom_product_name || 'Item'}</span>
                    </div>
                    <div className="text-slate-500 font-medium">
                      ₹{Number(item.subtotal).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 p-6 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Running Total</p>
                    <p className="text-3xl font-extrabold text-emerald-600">₹{Number(activeSession.total_amount).toFixed(2)}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={() => setShowMenuModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 px-6 h-12 text-base">
                      <Plus className="w-4 h-4" /> Add Items
                    </Button>
                    <Button
                      onClick={handleCloseAndPay}
                      className={Number(activeSession.total_amount) <= 0 ? "bg-rose-500 hover:bg-rose-600 text-white gap-1.5 px-6 h-12 text-base" : "bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 px-6 h-12 text-base"}
                    >
                      {Number(activeSession.total_amount) <= 0 ? (
                        <><XCircle className="w-4 h-4" /> Cancel Session</>
                      ) : (
                        <><SplitSquareHorizontal className="w-4 h-4" /> Close & Pay</>
                      )}
                    </Button>
                  </div>
                </div>
                {billingError && <p className="text-sm text-rose-600 font-medium mt-3 text-right">{billingError}</p>}
              </div>
            </CardContent>
          </Card>
        ) : !isAvailable && !activeSession ? (
          <Card className="h-[400px] flex flex-col items-center justify-center border border-slate-200 shadow-sm mt-8 bg-white">
            <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center mb-6 text-rose-400 border border-rose-100">
              <AlertTriangle className="w-10 h-10 stroke-[1.5]" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Table is stuck in occupied state</h3>
            <p className="text-slate-500 text-sm mb-8 text-center max-w-md">This table is marked as occupied but has no active orders. This can happen if an order was manually cancelled or deleted from the orders dashboard.</p>
            <Button onClick={handleForceRelease} className="bg-rose-500 hover:bg-rose-600 text-white gap-2 px-8 py-6 text-base rounded-xl shadow-sm font-semibold">
              Force Free Table
            </Button>
          </Card>
        ) : null}

        {/* Add Items Menu Modal */}
        <MenuSelectionModal
          businessId={businessId!}
          isOpen={showMenuModal}
          guestName={activeSession?.customer_name || `Table ${table.name}`}
          onClose={() => setShowMenuModal(false)}
          onSubmit={handleAddItems}
        />

      </div>
    </AppShell>
  );
}
