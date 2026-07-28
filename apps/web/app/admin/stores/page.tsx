'use client';

import React, { useState, useEffect } from 'react';
import {
  Store,
  Search,
  RefreshCw,
  Users,
  Package,
  ShoppingCart,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Edit,
  X,
  Save,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface StoreData {
  id: string;
  name: string;
  category: string;
  gst_number: string;
  inventory_enabled: boolean;
  ai_chat_enabled: boolean;
  user_count: number;
  product_count: number;
  order_count: number;
  created_at: string;
}

export default function AdminStoresPage() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStores, setTotalStores] = useState(0);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentStore, setCurrentStore] = useState<StoreData | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    inventory_enabled: true,
    ai_chat_enabled: true,
    gst_number: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchStores = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/platform-admin/stores', {
        params: { search, page, limit: 10 },
      });
      setStores(res.data.data);
      setTotalPages(res.data.meta.totalPages);
      setTotalStores(res.data.meta.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, [search, page]);

  const openEditModal = (store: StoreData) => {
    setCurrentStore(store);
    setEditForm({
      name: store.name || '',
      category: store.category || '',
      inventory_enabled: store.inventory_enabled ?? true,
      ai_chat_enabled: store.ai_chat_enabled ?? true,
      gst_number: store.gst_number || '',
    });
    setEditModalOpen(true);
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) return;
    setSaving(true);
    try {
      await apiClient.patch(`/api/platform-admin/stores/${currentStore.id}`, editForm);
      setMessage(`Store ${editForm.name} updated successfully!`);
      setEditModalOpen(false);
      fetchStores();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update store');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Store className="w-7 h-7 text-purple-400" />
            Stores & Tenant Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage all {totalStores} tenant businesses, inspect user/product volumes, and configure module feature flags.
          </p>
        </div>
        <button
          onClick={fetchStores}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {message && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {message}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search store name or category..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Stores Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Store Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Users</th>
                <th className="px-6 py-4">Products</th>
                <th className="px-6 py-4">Orders</th>
                <th className="px-6 py-4">Features Active</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    Loading store accounts...
                  </td>
                </tr>
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No store accounts found matching criteria.
                  </td>
                </tr>
              ) : (
                stores.map((store) => (
                  <tr key={store.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 font-semibold text-white">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center font-bold text-purple-400">
                          🏪
                        </div>
                        <div>
                          <div>{store.name}</div>
                          {store.gst_number && (
                            <div className="text-[10px] text-slate-400 font-mono">GST: {store.gst_number}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                        {store.category || 'General'}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-400" /> {store.user_count}
                      </div>
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-emerald-400" /> {store.product_count}
                      </div>
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-amber-400" /> {store.order_count}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {store.inventory_enabled && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Inventory
                          </span>
                        )}
                        {store.ai_chat_enabled && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            AI Chat
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(store)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
                      >
                        Configure
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Store Modal */}
      {editModalOpen && currentStore && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-purple-400" />
                Configure Store Settings
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Store Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category / Industry</label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">GST Number</label>
                <input
                  type="text"
                  value={editForm.gst_number}
                  onChange={(e) => setEditForm({ ...editForm, gst_number: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500 font-mono uppercase"
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-200">Inventory Module Enabled</span>
                  <input
                    type="checkbox"
                    checked={editForm.inventory_enabled}
                    onChange={(e) => setEditForm({ ...editForm, inventory_enabled: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-200">AI Order Assistant Enabled</span>
                  <input
                    type="checkbox"
                    checked={editForm.ai_chat_enabled}
                    onChange={(e) => setEditForm({ ...editForm, ai_chat_enabled: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition shadow-lg shadow-purple-600/30"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
