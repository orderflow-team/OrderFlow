'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBusiness } from '@/lib/use-business';
import { hasRole } from '@/lib/auth';
import apiClient from '@/lib/api-client';
import { ChefHat, Play, CheckCircle2, Check, UtensilsCrossed, KeyRound, Plus, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface KitchenStaffUser {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
}

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
  const isCookRole = hasRole('kitchen_staff');
  const [kots, setKots] = useState<KOT[]>([]);
  const [loading, setLoading] = useState(true);

  const [kitchenStaff, setKitchenStaff] = useState<KitchenStaffUser[]>([]);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '' });
  const [savingStaff, setSavingStaff] = useState(false);
  const [staffError, setStaffError] = useState('');

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

  const fetchKitchenStaff = async () => {
    if (!businessId) return;
    try {
      const res = await apiClient.get<KitchenStaffUser[]>('/api/restaurant/kitchen-staff', { params: { businessId } });
      setKitchenStaff(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (ready) {
      fetchKots();
      const interval = setInterval(fetchKots, 10000); // Auto-refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [businessId, ready]);

  useEffect(() => {
    if (ready && !isCookRole) fetchKitchenStaff();
  }, [businessId, ready, isCookRole]);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await apiClient.patch(`/api/restaurant/kot/${id}/status`, { status: newStatus }, { params: { businessId } });
      fetchKots();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddKitchenStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSavingStaff(true);
    setStaffError('');
    try {
      await apiClient.post('/api/restaurant/kitchen-staff', staffForm, { params: { businessId } });
      setStaffForm({ name: '', email: '', password: '' });
      setShowStaffForm(false);
      fetchKitchenStaff();
    } catch (err: any) {
      setStaffError(err.response?.data?.message || 'Failed to create login');
    } finally {
      setSavingStaff(false);
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
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20 backdrop-blur-sm text-sm font-semibold">
                {pendingKots.length} Pending
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20 backdrop-blur-sm text-sm font-semibold">
                {preparingKots.length} Preparing
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 backdrop-blur-sm text-sm font-semibold">
                {readyKots.length} Ready
              </span>
            </div>
          }
        />

        {!isCookRole && (
          <Card className="ring-white/50 glass-sheen-sm mt-6 shrink-0">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <CardTitle className="text-base">Kitchen Staff</CardTitle>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowStaffForm((s) => !s)}>
                  {showStaffForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showStaffForm ? 'Cancel' : 'Add Cook'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showStaffForm && (
                <form onSubmit={handleAddKitchenStaff} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                  <Input placeholder="Name" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} required />
                  <Input type="email" placeholder="Email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} required />
                  <Input type="password" placeholder="Password (min 6 chars)" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} minLength={6} required />
                  <Button type="submit" disabled={savingStaff} className="sm:col-span-3">{savingStaff ? 'Saving...' : 'Save'}</Button>
                  {staffError && <p className="sm:col-span-3 text-sm text-rose-600">{staffError}</p>}
                </form>
              )}
              {kitchenStaff.length === 0 ? (
                <p className="text-sm text-slate-400">No kitchen staff logins yet — cooks only see this KOT screen, nothing else.</p>
              ) : (
                <div className="space-y-2">
                  {kitchenStaff.map((s) => (
                    <div key={s.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                      <span className="text-slate-800 font-medium">{s.fullName}</span>
                      <span className="text-slate-400">{s.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 mt-6 min-h-0">
          
          {/* Column 1: Pending */}
          <div className="flex flex-col bg-white/20 backdrop-blur-sm rounded-3xl">
            <div className="p-4 border-b border-white/40 flex justify-between items-center bg-white/40 backdrop-blur-md rounded-t-3xl">
              <h2 className="text-lg font-bold text-amber-600 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                New / Pending
              </h2>
              <span className="bg-white/40 backdrop-blur-sm ring-1 ring-white/50 text-slate-600 px-2 py-0.5 rounded-full text-sm font-bold">{pendingKots.length}</span>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {pendingKots.map(kot => (
                <Card key={kot.id} className="ring-1 ring-amber-300/40 overflow-hidden bg-white/40 backdrop-blur-md glass-sheen-sm hover:ring-amber-400/50 transition-colors">
                  <CardContent className="p-0">
                    <div className="p-4 border-b border-white/40 bg-amber-500/10 backdrop-blur-sm">
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
                        className="w-full"
                        onClick={() => updateStatus(kot.id, 'preparing')}
                      >
                        <Play className="w-4 h-4 mr-2" /> Accept & Prepare
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pendingKots.length === 0 && (
                <div className="text-center p-8 border-2 border-dashed border-white/60 rounded-2xl text-slate-400 bg-white/20 backdrop-blur-sm">
                  <ChefHat className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No pending orders
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Preparing */}
          <div className="flex flex-col bg-white/20 backdrop-blur-sm rounded-3xl">
            <div className="p-4 border-b border-white/40 flex justify-between items-center bg-white/40 backdrop-blur-md rounded-t-3xl">
              <h2 className="text-lg font-bold text-blue-600 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                Preparing
              </h2>
              <span className="bg-white/40 backdrop-blur-sm ring-1 ring-white/50 text-slate-600 px-2 py-0.5 rounded-full text-sm font-bold">{preparingKots.length}</span>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {preparingKots.map(kot => (
                <Card key={kot.id} className="ring-1 ring-blue-300/40 overflow-hidden bg-white/40 backdrop-blur-md glass-sheen-sm hover:ring-blue-400/50 transition-colors">
                  <CardContent className="p-0">
                    <div className="p-4 border-b border-white/40 bg-blue-500/10 backdrop-blur-sm">
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
                        className="w-full"
                        onClick={() => updateStatus(kot.id, 'ready')}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Ready
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {preparingKots.length === 0 && (
                <div className="text-center p-8 border-2 border-dashed border-white/60 rounded-2xl text-slate-400 bg-white/20 backdrop-blur-sm">
                  <ChefHat className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Nothing in preparation
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Ready */}
          <div className="flex flex-col bg-white/20 backdrop-blur-sm rounded-3xl">
            <div className="p-4 border-b border-white/40 flex justify-between items-center bg-white/40 backdrop-blur-md rounded-t-3xl">
              <h2 className="text-lg font-bold text-emerald-600 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                Ready for Pickup
              </h2>
              <span className="bg-white/40 backdrop-blur-sm ring-1 ring-white/50 text-slate-600 px-2 py-0.5 rounded-full text-sm font-bold">{readyKots.length}</span>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {readyKots.map(kot => (
                <Card key={kot.id} className="ring-1 ring-emerald-300/40 overflow-hidden bg-white/40 backdrop-blur-md glass-sheen-sm hover:ring-emerald-400/50 transition-colors">
                  <CardContent className="p-0">
                    <div className="p-4 border-b border-white/40 bg-emerald-500/10 backdrop-blur-sm">
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
                        className="w-full"
                        onClick={() => updateStatus(kot.id, 'served')}
                      >
                        <Check className="w-4 h-4 mr-2" /> Mark as Served
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {readyKots.length === 0 && (
                <div className="text-center p-8 border-2 border-dashed border-white/60 rounded-2xl text-slate-400 bg-white/20 backdrop-blur-sm">
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
