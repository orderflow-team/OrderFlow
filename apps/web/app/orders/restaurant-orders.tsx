'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { ClearModuleButton } from '@/components/clear-module-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { Plus, Users, ShoppingBag, Trash2, UtensilsCrossed, CheckCircle2, QrCode, Printer } from 'lucide-react';
import Link from 'next/link';
import { MenuSelectionModal, CartItem } from '@/components/menu-selection-modal';
import React from 'react';

interface Table {
  id: string;
  name: string;
  capacity: number;
  status: string;
}

interface TakeawayOrder {
  id: string;
  token_number: number | null;
  status: string;
  total_amount: string | number;
  created_at: string;
  items?: any[];
}

type OrderTypeChoice = 'choice' | 'dine_in' | 'take_away';

function RestaurantPageContent() {
  const { businessId, ready } = useBusiness();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', capacity: '4' });
  const [saving, setSaving] = useState(false);

  // Order type entry point: every new order starts with this choice.
  const [view, setView] = useState<OrderTypeChoice>((searchParams.get('view') as OrderTypeChoice) || 'choice');

  // Take Away states
  const [showTakeAwayMenuModal, setShowTakeAwayMenuModal] = useState(false);
  const [takeAwayToken, setTakeAwayToken] = useState<number | null>(null);
  const [previousTakeaways, setPreviousTakeaways] = useState<TakeawayOrder[]>([]);
  const [expandedTakeaways, setExpandedTakeaways] = useState<Record<string, boolean>>({});

  // QR Modal States
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrTable, setQrTable] = useState<Table | null>(null);
  const [showTakeAwayQrModal, setShowTakeAwayQrModal] = useState(false);

  const handleShowQr = (table: Table) => {
    setQrTable(table);
    setShowQrModal(true);
  };

  const loadTables = async (bizId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.get<Table[]>('/api/restaurant/tables', { params: { businessId: bizId } });
      setTables(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load tables');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadPreviousTakeaways = async (bizId: string) => {
    try {
      const res = await apiClient.get<any[]>('/api/orders', { params: { businessId: bizId } });
      setPreviousTakeaways(res.data.filter(o => o.order_type === 'take_away').slice(0, 10));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (ready && businessId) {
      loadTables(businessId);
      loadPreviousTakeaways(businessId);

      const interval = setInterval(() => {
        loadTables(businessId, true);
        loadPreviousTakeaways(businessId);
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [ready, businessId]);

  const handleDeleteTable = async (e: React.MouseEvent, tableId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!businessId) return;
    if (!confirm('Delete this table? This cannot be undone.')) return;
    try {
      await apiClient.delete(`/api/restaurant/tables/${tableId}`, { params: { businessId } });
      loadTables(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete table');
    }
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    try {
      await apiClient.post('/api/restaurant/tables', { businessId, name: form.name, capacity: Number(form.capacity) });
      setForm({ name: '', capacity: '4' });
      setShowAddForm(false);
      loadTables(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create table');
    } finally {
      setSaving(false);
    }
  };

  const handleTakeAwaySubmit = async (items: CartItem[]) => {
    if (!businessId || items.length === 0) return;
    try {
      const res = await apiClient.post('/api/orders', {
        businessId,
        customerName: 'Take Away Guest',
        orderType: 'take_away',
        items: items.map(i => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: Number(i.product.selling_price)
        }))
      });
      setShowTakeAwayMenuModal(false);
      setTakeAwayToken(res.data.token_number ?? null);
      loadPreviousTakeaways(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create take away order');
    }
  };

  if (!ready) return null;

  const availableCount = tables.filter(t => t.status === 'available').length;
  const occupiedCount = tables.filter(t => t.status === 'occupied').length;
  const reservedCount = tables.filter(t => t.status === 'reserved').length;

  if (view === 'choice') {
    return (
      <AppShell>
        <div className="p-6 md:p-10 max-w-3xl mx-auto">
          <div className="flex flex-col gap-1 mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">New Order</h1>
            <p className="text-slate-500 mt-1">How is this order being served?</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button
              onClick={() => setView('dine_in')}
              className="group flex flex-col items-center justify-center gap-4 p-10 rounded-3xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 glass-sheen-sm hover:ring-emerald-400/50 transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-emerald-500/20">
                <UtensilsCrossed className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-slate-800">Dine In</div>
              <p className="text-sm text-slate-500 text-center">Seat a guest at a table</p>
            </button>

            <button
              onClick={() => setView('take_away')}
              className="group flex flex-col items-center justify-center gap-4 p-10 rounded-3xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 glass-sheen-sm hover:ring-amber-400/50 transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-amber-500/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-amber-500/20">
                <ShoppingBag className="w-8 h-8 text-amber-600" />
              </div>
              <div className="text-xl font-bold text-slate-800">Takeaway</div>
              <p className="text-sm text-slate-500 text-center">Add items directly, get a token number</p>
            </button>
          </div>

          {error && <p className="text-sm text-rose-600 mt-6">{error}</p>}
        </div>
      </AppShell>
    );
  }

  if (view === 'take_away') {
    return (
      <AppShell>
        <div className="p-6 md:p-10 max-w-3xl mx-auto">
          <div className="flex flex-col gap-1 mb-8">
            <button
              onClick={() => setView('choice')}
              className="text-sm text-slate-400 hover:text-slate-600 mb-1 self-start"
            >
              ← Change order type
            </button>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-800">Takeaway</h1>
                <p className="text-slate-500 mt-1">Add items directly and track orders by token number</p>
              </div>
              <Button
                onClick={() => setShowTakeAwayQrModal(true)}
                variant="outline"
                className="gap-2 shrink-0 bg-white/60 hover:bg-white"
              >
                <QrCode className="w-4 h-4" /> Self-Service QR
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-rose-600 mb-6">{error}</p>}

          <Card className="h-[300px] flex flex-col items-center justify-center ring-white/50 glass-sheen-sm mb-12">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 backdrop-blur-sm flex items-center justify-center mb-6 text-amber-600 ring-1 ring-amber-500/20">
              <ShoppingBag className="w-10 h-10 stroke-[1.5]" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Ready for a new takeaway</h3>
            <p className="text-slate-500 text-sm mb-8">Add items to generate a token number</p>
            <Button onClick={() => setShowTakeAwayMenuModal(true)} className="bg-amber-500/85 backdrop-blur-md hover:bg-amber-500/95 text-white gap-2 px-8 py-6 text-lg rounded-full ring-1 ring-white/30">
              <Plus className="w-5 h-5" /> Add Items
            </Button>
          </Card>

          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-4">
            <ShoppingBag className="w-4 h-4" />
            Previous Takeaways ({previousTakeaways.length})
          </div>
          {previousTakeaways.length === 0 ? (
            <p className="text-sm text-slate-400">No takeaway orders yet.</p>
          ) : (
            <div className="space-y-2">
              {previousTakeaways.map(order => {
                const isExpanded = !!expandedTakeaways[order.id];
                return (
                  <div key={order.id} className="flex flex-col rounded-2xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 glass-sheen-sm overflow-hidden transition-all duration-200">
                    <div
                      onClick={() => setExpandedTakeaways(prev => ({ ...prev, [order.id]: !prev[order.id] }))}
                      className="flex justify-between items-center py-4 px-5 cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-500">{new Date(order.created_at).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="font-semibold text-slate-800">Token #{order.token_number ?? '—'}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                          order.status === 'paid' ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20' : 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-semibold text-emerald-600">
                        <span>₹{Number(order.total_amount).toFixed(2)}</span>
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
                      <div className="px-5 pb-4 pt-2 border-t border-white/30 bg-white/10 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Order Items</div>
                        <div className="space-y-1.5">
                          {order.items && order.items.length > 0 ? (
                            order.items.map((item: any) => (
                              <div key={item.id} className="flex justify-between text-sm text-slate-700">
                                <span>
                                  {item.product?.name || item.custom_product_name || 'Unknown item'}
                                  <span className="text-xs text-slate-400 font-normal ml-2">x{Number(item.quantity)}</span>
                                </span>
                                <span className="font-medium text-slate-800">₹{Number(item.subtotal).toFixed(2)}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400">No items found in this order.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Takeaway: items go straight into the cart, no name step */}
        {businessId && showTakeAwayMenuModal && (
          <MenuSelectionModal
            businessId={businessId}
            isOpen={showTakeAwayMenuModal}
            onClose={() => setShowTakeAwayMenuModal(false)}
            guestName="Take Away Guest"
            onSubmit={handleTakeAwaySubmit}
          />
        )}

        {/* Token number confirmation. Plain overlay (not the shared Dialog primitive) since
            mounting it in the same tick as the menu modal's unmount confuses base-ui's dialog stack. */}
        {takeAwayToken !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10">
            <div className="bg-white/50 backdrop-blur-2xl backdrop-saturate-150 rounded-3xl ring-1 ring-white/50 glass-sheen-sm p-6 w-full max-w-[360px] text-center mx-4">
              <div className="flex items-center justify-center gap-2 font-medium mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Order Placed
              </div>
              <p className="text-sm text-slate-500 mb-2">Takeaway Token Number</p>
              <p className="text-5xl font-bold text-amber-600">#{takeAwayToken}</p>
              <p className="text-sm text-slate-400 mt-3 mb-6">Give this number to the customer to track the order.</p>
              <Button className="w-full" onClick={() => setTakeAwayToken(null)}>Done</Button>
            </div>
          </div>
        )}
      </AppShell>
    );
  }

  return (
    <>
      <AppShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">

        {/* Header Section */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-start">
            <div>
              <button
                onClick={() => setView('choice')}
                className="text-sm text-slate-400 hover:text-slate-600 mb-1"
              >
                ← Change order type
              </button>
              <h1 className="text-3xl font-bold tracking-tight text-slate-800">Tables</h1>
              <p className="text-slate-500 mt-1">Manage your restaurant tables and sessions</p>
            </div>
            <div className="flex items-center gap-3">
              {businessId && <ClearModuleButton module="restaurant" businessId={businessId} />}
            </div>
          </div>

          <div className="flex items-center gap-6 mt-4 text-sm font-medium">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              {availableCount} Available
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              {occupiedCount} Occupied
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              {reservedCount} Reserved
            </div>
            <div className="ml-auto text-slate-400 text-xs font-normal">
              Click any table to enter
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-400">Loading tables...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            
            {tables.map((t) => {
              const isAvailable = t.status === 'available';
              const isOccupied = t.status === 'occupied';
              
              return (
                <Link key={t.id} href={`/orders/table/${t.id}`}>
                  <Card className={`group relative h-36 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-0.5 ${isAvailable ? 'ring-emerald-300/50' : isOccupied ? 'ring-blue-300/50' : 'ring-white/50'}`}>
                    <button
                      onClick={(e) => handleDeleteTable(e, t.id)}
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-full text-slate-300 hover:text-rose-600 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete table"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleShowQr(t);
                      }}
                      className="absolute top-2 right-9 z-10 p-1.5 rounded-full text-slate-300 hover:text-emerald-600 hover:bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="View Table QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                    <CardContent className="p-5 flex-1 flex flex-col">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-slate-800">{t.name}</span>
                          <span className={`w-2 h-2 rounded-full mt-1 ${isAvailable ? 'bg-emerald-500' : isOccupied ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide capitalize backdrop-blur-sm ${
                          isAvailable ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20' :
                          isOccupied ? 'bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20' :
                          'bg-slate-500/10 text-slate-600 ring-1 ring-slate-500/20'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-3">
                        <Users className="w-4 h-4" />
                        <span>{t.capacity} Seats</span>
                      </div>
                      
                      {isAvailable && (
                        <div className="mt-auto pt-2">
                          <span className="text-emerald-600 text-sm font-medium flex items-center gap-1 opacity-90 group-hover:opacity-100">
                            → Start a session
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}

            {/* Add Table Card */}
            {showAddForm ? (
              <Card className="h-36 ring-white/50 overflow-hidden">
                <CardContent className="p-4 h-full flex flex-col justify-center">
                  <form onSubmit={handleCreateTable} className="space-y-2">
                    <div className="flex gap-2">
                      <Input placeholder="Name (e.g. 9)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="h-8 text-sm" autoFocus />
                      <Input placeholder="Seats" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required className="h-8 text-sm w-20" />
                    </div>
                    <div className="flex gap-2 justify-end mt-2">
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setShowAddForm(false)}>Cancel</Button>
                      <Button type="submit" size="sm" className="h-7 text-xs px-3" disabled={saving}>Save</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <button onClick={() => setShowAddForm(true)} className="h-36 rounded-3xl border-2 border-dashed border-white/60 bg-white/10 backdrop-blur-sm flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 hover:border-white/80 transition-colors hover:bg-white/25">
                <Plus className="w-6 h-6 mb-2" />
                <span className="text-sm font-medium">Add Table</span>
              </button>
            )}

          </div>
        )}
      </div>
    </AppShell>

    {/* Table QR Code Modal */}
    {showQrModal && qrTable && (
      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-[360px] ring-white/50 glass-sheen-sm">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-slate-800 text-lg">
              Self-Service QR - {qrTable.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-xs text-slate-400 font-medium px-4">
              Customers can scan this QR code to view the menu and place their own orders directly from their phones.
            </p>
            
            {/* QR Image container */}
            <div id="table-qr-print-area" className="p-4 bg-white rounded-3xl border border-slate-100 flex flex-col items-center gap-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  typeof window !== 'undefined' ? `${window.location.origin}/orders/table/${qrTable.id}?customerMode=1` : ''
                )}`}
                alt={`QR for ${qrTable.name}`}
                className="w-[200px] h-[200px] object-contain"
              />
              <span className="text-sm font-extrabold text-slate-800 tracking-wider">
                TABLE {qrTable.name}
              </span>
            </div>

            <div className="text-[10px] font-mono text-slate-400 break-all select-all px-2 py-1 bg-slate-50 rounded-lg max-w-[280px]">
              {typeof window !== 'undefined' ? `${window.location.origin}/orders/table/${qrTable.id}?customerMode=1` : ''}
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowQrModal(false)}>
              Close
            </Button>
            <Button
              type="button"
              className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={() => {
                const printContent = document.getElementById('table-qr-print-area');
                if (!printContent) return;
                const win = window.open('', '_blank');
                if (!win) return;
                win.document.write(`
                  <html>
                    <head>
                      <title>Print QR Code - ${qrTable.name}</title>
                      <style>
                        body {
                          display: flex;
                          flex-direction: column;
                          align-items: center;
                          justify-content: center;
                          height: 80vh;
                          font-family: sans-serif;
                          text-align: center;
                        }
                        .qr-container {
                          border: 2px solid #e2e8f0;
                          padding: 24px;
                          border-radius: 24px;
                          background: white;
                        }
                        img {
                          width: 250px;
                          height: 250px;
                        }
                        .label {
                          margin-top: 16px;
                          font-size: 24px;
                          font-weight: bold;
                          color: #1e293b;
                          letter-spacing: 0.05em;
                        }
                        .instruction {
                          margin-top: 8px;
                          font-size: 14px;
                          color: #64748b;
                        }
                      </style>
                    </head>
                    <body>
                      <div class="qr-container">
                        <img src="${printContent.querySelector('img')?.src}" alt="QR" />
                        <div class="label">TABLE ${qrTable.name}</div>
                        <div class="instruction">Scan to view Menu & Order</div>
                      </div>
                      <script>
                        window.onload = function() {
                          window.print();
                          window.close();
                        }
                      </script>
                    </body>
                  </html>
                `);
                win.document.close();
              }}
            >
              <Printer className="w-4 h-4" /> Print QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

      {/* Takeaway QR Code Modal */}
      <Dialog open={showTakeAwayQrModal} onOpenChange={setShowTakeAwayQrModal}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">Takeaway Self-Service QR</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 space-y-6 bg-slate-50 rounded-2xl border border-slate-100 mt-2">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/50 flex flex-col items-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                  typeof window !== 'undefined' ? `${window.location.origin}/orders/takeaway?businessId=${businessId}&customerMode=1` : ''
                )}`}
                alt="Takeaway Self-Service QR"
                className="w-48 h-48 sm:w-56 sm:h-56"
              />
              <div className="text-slate-800 font-extrabold text-lg mt-4 tracking-wide uppercase">TAKEAWAY ORDERING</div>
              <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase mt-1">Scan to View Menu & Order</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-slate-600">Scan this QR code from your phone to browse our menu and place a takeaway order.</p>
            </div>
          </div>
          <DialogFooter className="sm:justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTakeAwayQrModal(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
              onClick={() => {
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                  typeof window !== 'undefined' ? `${window.location.origin}/orders/takeaway?businessId=${businessId}&customerMode=1` : ''
                )}`;
                const win = window.open('', '_blank');
                if (!win) return;
                win.document.write(`
                  <html>
                    <head>
                      <title>Print Takeaway QR Code</title>
                      <style>
                        body {
                          margin: 0;
                          display: flex;
                          flex-direction: column;
                          align-items: center;
                          justify-content: center;
                          height: 100vh;
                          font-family: system-ui, -apple-system, sans-serif;
                          color: #1e293b;
                        }
                        .container {
                          text-align: center;
                          border: 2px dashed #cbd5e1;
                          padding: 40px;
                          border-radius: 24px;
                          background: #f8fafc;
                        }
                        img {
                          width: 320px;
                          height: 320px;
                          margin-bottom: 20px;
                        }
                        .label {
                          font-size: 28px;
                          font-weight: 800;
                          letter-spacing: 0.05em;
                          margin-bottom: 8px;
                        }
                        .instruction {
                          font-size: 16px;
                          color: #64748b;
                          font-weight: 500;
                        }
                      </style>
                    </head>
                    <body>
                      <div class="container">
                        <img src="${qrUrl}" alt="QR" />
                        <div class="label">TAKEAWAY ORDERING</div>
                        <div class="instruction">Scan to view Menu & Order</div>
                      </div>
                      <script>
                        window.onload = function() {
                          window.print();
                          window.close();
                        }
                      </script>
                    </body>
                  </html>
                `);
                win.document.close();
              }}
            >
              <Printer className="w-4 h-4" /> Print QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RestaurantOrders() {
  return (
    <React.Suspense fallback={<div className="p-10 text-center text-slate-500">Loading...</div>}>
      <RestaurantPageContent />
    </React.Suspense>
  );
}
