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
  Filter,
  Layers,
  ChevronLeft,
  ChevronRight,
  Eye,
  Tag,
  Boxes,
  Key,
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
  owner_email?: string;
  owner_name?: string;
  created_at: string;
}

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost_price: number;
  current_stock: number;
  business_name: string;
  category: string;
  created_at: string;
}

const CATEGORY_PRESETS = [
  { id: 'grocery', label: 'Grocery', icon: '🛒', color: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  { id: 'pharmacy', label: 'Pharmacy', icon: '💊', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { id: 'restaurant', label: 'Restaurant', icon: '🍔', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { id: 'retail', label: 'Retail Store', icon: '🛍️', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { id: 'wholesale', label: 'Wholesale', icon: '📦', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  { id: 'salesman', label: 'Sales Field / FMCG', icon: '💼', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { id: 'others', label: 'Other Business', icon: '🏬', color: 'bg-slate-800 text-slate-300 border-slate-700' },
];

export default function AdminStoresPage() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStores, setTotalStores] = useState(0);

  // Edit Store Modal State
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

  // Inspect Store Products Modal State
  const [productsModalOpen, setProductsModalOpen] = useState(false);
  const [inspectStore, setInspectStore] = useState<StoreData | null>(null);
  const [storeProducts, setStoreProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [totalStoreProducts, setTotalStoreProducts] = useState(0);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/platform-admin/stores', {
        params: {
          search,
          category: selectedCategory,
          page,
          limit,
        },
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

  const fetchStoreProducts = async (storeId: string) => {
    setLoadingProducts(true);
    try {
      const res = await apiClient.get('/api/platform-admin/products-overview', {
        params: {
          business_id: storeId,
          search: productSearch,
          page: productPage,
          limit: 8,
        },
      });
      setStoreProducts(res.data.data);
      setProductTotalPages(res.data.meta.totalPages);
      setTotalStoreProducts(res.data.meta.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, [search, selectedCategory, page, limit]);

  useEffect(() => {
    if (inspectStore) {
      fetchStoreProducts(inspectStore.id);
    }
  }, [inspectStore, productSearch, productPage]);

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

  const handleImpersonateStore = async (store: StoreData) => {
    if (!confirm(`Switch developer session to store "${store.name}" as store owner?`)) return;
    try {
      const res = await apiClient.post(`/api/platform-admin/impersonate/${store.id}`);
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      window.location.href = '/dashboard';
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to impersonate store');
    }
  };

  const openProductsModal = (store: StoreData) => {
    setInspectStore(store);
    setProductSearch('');
    setProductPage(1);
    setProductsModalOpen(true);
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

  const renderCategoryBadge = (category: string) => {
    const catLower = (category || '').toLowerCase();
    const preset = CATEGORY_PRESETS.find((p) => p.id === catLower || catLower.includes(p.id));
    if (preset) {
      return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border ${preset.color}`}>
          <span>{preset.icon}</span>
          <span>{category}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 border border-slate-700 capitalize">
        <span>🏪</span>
        <span>{category || 'General'}</span>
      </span>
    );
  };

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalStores);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Store className="w-7 h-7 text-purple-400" />
            Store Industry Directory
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage all {totalStores} tenant businesses and inspect products, user volumes, and feature modules per store.
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

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
        {/* Search */}
        <div className="relative col-span-1 sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search store name, industry category, or owner email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500 capitalize"
          >
            <option value="">All Industry Categories</option>
            {CATEGORY_PRESETS.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory('')}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl border border-slate-700"
              title="Clear Category Filter"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stores Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Store Name</th>
                <th className="px-6 py-4">Industry Category</th>
                <th className="px-6 py-4">Users</th>
                <th className="px-6 py-4">Store Products</th>
                <th className="px-6 py-4">Orders</th>
                <th className="px-6 py-4">Active Modules</th>
                <th className="px-6 py-4 text-right">Actions / Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-400" />
                    Loading store catalog...
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
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center font-bold text-purple-400 text-base">
                          🏬
                        </div>
                        <div>
                          <div className="text-white font-semibold">{store.name}</div>
                          {store.owner_email && store.owner_email !== 'N/A' && (
                            <button
                              onClick={() => {
                                setSearch(store.owner_email!);
                                setPage(1);
                              }}
                              className="text-[11px] text-purple-400 hover:underline font-mono block text-left"
                              title="Click to view all stores registered under this email"
                            >
                              📧 {store.owner_email}
                            </button>
                          )}
                          {store.gst_number && (
                            <div className="text-[10px] text-slate-400 font-mono">GST: {store.gst_number}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {renderCategoryBadge(store.category)}
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-400" /> {store.user_count}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <button
                        onClick={() => openProductsModal(store)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-lg transition"
                      >
                        <Package className="w-3.5 h-3.5" />
                        {store.product_count} Products <Eye className="w-3 h-3 opacity-60 ml-0.5" />
                      </button>
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
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleImpersonateStore(store)}
                          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-lg border border-amber-500/30 transition flex items-center gap-1"
                        >
                          <Key className="w-3.5 h-3.5" /> Login as Store
                        </button>
                        <button
                          onClick={() => openProductsModal(store)}
                          className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium rounded-lg border border-indigo-500/30 transition flex items-center gap-1"
                        >
                          <Package className="w-3.5 h-3.5" /> View Catalog
                        </button>
                        <button
                          onClick={() => openEditModal(store)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
                        >
                          Configure
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>
              Showing <span className="font-bold text-white">{totalStores > 0 ? startRecord : 0}</span> to{' '}
              <span className="font-bold text-white">{endRecord}</span> of{' '}
              <span className="font-bold text-white">{totalStores}</span> stores
            </span>

            <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-purple-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg transition"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((pNum) => pNum === 1 || pNum === totalPages || Math.abs(pNum - page) <= 1)
              .map((pNum, i, arr) => {
                const prev = arr[i - 1];
                const showDots = prev && pNum - prev > 1;
                return (
                  <React.Fragment key={pNum}>
                    {showDots && <span className="px-1 text-slate-600">...</span>}
                    <button
                      onClick={() => setPage(pNum)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                        page === pNum
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      {pNum}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Store Products Modal */}
      {productsModalOpen && inspectStore && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400">
                  📦
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {inspectStore.name} — Product Catalog
                  </h3>
                  <p className="text-xs text-slate-400">
                    Inspecting {totalStoreProducts} registered products in this store
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProductsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder={`Search products in ${inspectStore.name}...`}
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setProductPage(1);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Store Products Data Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[11px] font-semibold uppercase text-slate-400 sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Selling Price</th>
                    <th className="px-4 py-3">Cost Price</th>
                    <th className="px-4 py-3 text-right">Stock Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingProducts ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                        Loading products for {inspectStore.name}...
                      </td>
                    </tr>
                  ) : storeProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No products registered in this store.
                      </td>
                    </tr>
                  ) : (
                    storeProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span>📦</span> {p.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-400">{p.sku || '-'}</td>
                        <td className="px-4 py-3 capitalize text-slate-300">{p.category || 'General'}</td>
                        <td className="px-4 py-3 font-bold text-emerald-400">₹{(p.price || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-slate-400">₹{(p.cost_price || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center justify-center whitespace-nowrap px-2.5 py-0.5 font-semibold rounded-full border text-[10px] ${
                            p.current_stock > 10
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : p.current_stock > 0
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {p.current_stock} in stock
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Pagination Footer */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <div>
                Page <span className="font-bold text-white">{productPage}</span> of <span className="font-bold text-white">{productTotalPages}</span> ({totalStoreProducts} products)
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={productPage <= 1}
                  onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg transition"
                >
                  Prev
                </button>
                <button
                  disabled={productPage >= productTotalPages}
                  onClick={() => setProductPage((p) => Math.min(productTotalPages, p + 1))}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Store Modal */}
      {editModalOpen && currentStore && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-purple-400" />
                Configure Store & Category
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Industry Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500 capitalize"
                >
                  <option value="">-- Select Industry Preset --</option>
                  {CATEGORY_PRESETS.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
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
