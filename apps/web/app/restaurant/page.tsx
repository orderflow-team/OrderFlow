'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useBusiness } from '@/lib/use-business';
import apiClient from '@/lib/api-client';
import { ChefHat, Play, CheckCircle2, Check, UtensilsCrossed } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface OrderItem {
  id: string;
  quantity: number;
  custom_product_name: string | null;
  product?: { name: string };
}

interface Table {
  name: string;
}

interface Order {
  customer_name: string;
  order_type: string;
  token_number: number | null;
}

interface KOT {
  id: string;
  status: string;
  created_at: string;
  table: Table;
  order: Order;
  items: OrderItem[];
}

export default function KitchenDisplayPage() {
  const { businessId, ready } = useBusiness();
  const [kots, setKots] = useState<KOT[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKots = async () => {
    if (!businessId) return;
    try {
      const res = await apiClient.get<KOT[]>('/api/restaurant/kot', { params: { businessId } });
      setKots(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready) {
      fetchKots();
      const interval = setInterval(fetchKots, 10000); // Auto-refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [businessId, ready]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await apiClient.patch(`/api/restaurant/kot/${id}/status`, { status: newStatus }, { params: { businessId } });
      fetchKots();
    } catch (err) {
      console.error(err);
    }
  };

  if (!ready || loading) return (
    <AppShell>
      <div className="p-6 text-center text-slate-400">Loading KDS...</div>
    </AppShell>
  );

  const pendingKots = kots.filter(k => k.status === 'pending');
  const preparingKots = kots.filter(k => k.status === 'preparing');
  const readyKots = kots.filter(k => k.status === 'ready');

  const kotLabel = (kot: KOT) =>
    kot.table?.name || (kot.order?.token_number ? `Take Away #${kot.order.token_number}` : 'Take Away');

  const renderItem = (item: OrderItem) => (
    <div key={item.id} className="flex gap-2 text-sm text-slate-700 font-medium py-1">
      <span className="text-slate-400 shrink-0">{item.quantity}x</span>
      <span>{item.product?.name || item.custom_product_name}</span>
    </div>
  );

  return (
    <AppShell>
      <div className="p-6 h-[calc(100vh-64px)] flex flex-col">
        <PageHeader
          title="Active Orders"
          description="Real-time kitchen order screen. Updates automatically."
          action={
            <div className="flex gap-3 mt-4 md:mt-0">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-sm font-semibold">
                {pendingKots.length} Pending
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-sm font-semibold">
                {preparingKots.length} Preparing
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-semibold">
                {readyKots.length} Ready
              </span>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 mt-6 min-h-0">
          
          {/* Column 1: Pending */}
          <div className="flex flex-col bg-slate-50/50 rounded-xl">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white rounded-t-xl">
              <h2 className="text-lg font-bold text-amber-600 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                New / Pending
              </h2>
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-sm font-bold">{pendingKots.length}</span>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {pendingKots.map(kot => (
                <Card key={kot.id} className="border-amber-200 shadow-sm overflow-hidden bg-white hover:border-amber-300 transition-colors">
                  <CardContent className="p-0">
                    <div className="p-4 border-b border-slate-100 bg-amber-50/30">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-emerald-800 text-lg">{kotLabel(kot)}</h3>
                          <p className="text-sm text-slate-500 font-medium">{kot.order?.customer_name || 'Guest'}</p>
                        </div>
                        <div className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                          {formatDistanceToNow(new Date(kot.created_at))} ago
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="space-y-1 mb-6">
                        {kot.items?.map(renderItem)}
                      </div>
                      <Button 
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                        onClick={() => updateStatus(kot.id, 'preparing')}
                      >
                        <Play className="w-4 h-4 mr-2" /> Accept & Prepare
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pendingKots.length === 0 && (
                <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 bg-white">
                  <ChefHat className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No pending orders
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Preparing */}
          <div className="flex flex-col bg-slate-50/50 rounded-xl">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white rounded-t-xl">
              <h2 className="text-lg font-bold text-blue-600 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                Preparing
              </h2>
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-sm font-bold">{preparingKots.length}</span>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {preparingKots.map(kot => (
                <Card key={kot.id} className="border-blue-200 shadow-sm overflow-hidden bg-white hover:border-blue-300 transition-colors">
                  <CardContent className="p-0">
                    <div className="p-4 border-b border-slate-100 bg-blue-50/30">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-emerald-800 text-lg">{kotLabel(kot)}</h3>
                          <p className="text-sm text-slate-500 font-medium">{kot.order?.customer_name || 'Guest'}</p>
                        </div>
                        <div className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                          {formatDistanceToNow(new Date(kot.created_at))} ago
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="space-y-1 mb-6">
                        {kot.items?.map(renderItem)}
                      </div>
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        onClick={() => updateStatus(kot.id, 'ready')}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Ready
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {preparingKots.length === 0 && (
                <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 bg-white">
                  <ChefHat className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Nothing in preparation
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Ready */}
          <div className="flex flex-col bg-slate-50/50 rounded-xl">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white rounded-t-xl">
              <h2 className="text-lg font-bold text-emerald-600 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                Ready for Pickup
              </h2>
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-sm font-bold">{readyKots.length}</span>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {readyKots.map(kot => (
                <Card key={kot.id} className="border-emerald-200 shadow-sm overflow-hidden bg-white hover:border-emerald-300 transition-colors">
                  <CardContent className="p-0">
                    <div className="p-4 border-b border-slate-100 bg-emerald-50/30">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-emerald-800 text-lg">{kotLabel(kot)}</h3>
                          <p className="text-sm text-slate-500 font-medium">{kot.order?.customer_name || 'Guest'}</p>
                        </div>
                        <div className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                          {formatDistanceToNow(new Date(kot.created_at))} ago
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="space-y-1 mb-6 text-slate-400 line-through">
                        {kot.items?.map(renderItem)}
                      </div>
                      <Button 
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                        onClick={() => updateStatus(kot.id, 'served')}
                      >
                        <Check className="w-4 h-4 mr-2" /> Mark as Served
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {readyKots.length === 0 && (
                <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 bg-white">
                  <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No orders ready to serve
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
