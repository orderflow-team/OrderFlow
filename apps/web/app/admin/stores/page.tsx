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
  Tag,
  Boxes,
  Key,
  Trash2,
  AlertTriangle,
  Bell,
  Crown,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface StoreData {
  id: string;
  name: string;
  category: string;
  gst_number: string;
  inventory_enabled: boolean;
  ai_chat_enabled: boolean;
  b2b_sync_enabled: boolean;
  phone: string | null;
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
  { id: 'pharmacy', label: 'Pharmacy', icon: '💊', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
  { id: 'restaurant', label: 'Restaurant', icon: '🍔', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  { id: 'retail', label: 'Retail Store', icon: '🛍️', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' },
  { id: 'wholesale', label: 'Wholesale', icon: '📦', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' },
  { id: 'salesman', label: 'Sales Field / FMCG', icon: '💼', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' },
  { id: 'others', label: 'Other Business', icon: '🏬', color: 'bg-secondary text-foreground border-border' },
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
    b2b_sync_enabled: true,
    gst_number: '',
    plan_code: 'pro',
    status: 'active',
    extend_days: 0,
    billing_cycle: 'monthly',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Delete Store Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StoreData | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

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
      b2b_sync_enabled: store.b2b_sync_enabled ?? true,
      gst_number: store.gst_number || '',
      plan_code: 'pro',
      status: 'active',
      extend_days: 0,
      billing_cycle: 'monthly',
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

  const handleSendTestPush = async (store: StoreData) => {
    try {
      const res = await apiClient.post(`/api/platform-admin/stores/${store.id}/test-push`);
      alert(res.data.message || `Test push dispatched to ${store.name}`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send test push');
    }
  };

  const openDeleteModal = (store: StoreData) => {
    setDeleteTarget(store);
    setDeleteConfirmText('');
    setDeleteModalOpen(true);
  };

  const handleDeleteStore = async () => {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.name) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/api/platform-admin/stores/${deleteTarget.id}`);
      setMessage(`Store "${deleteTarget.name}" and all its data were permanently deleted.`);
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchStores();
      setTimeout(() => setMessage(''), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete store');
    } finally {
      setDeleting(false);
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
      await apiClient.patch(`/api/platform-admin/stores/${currentStore.id}`, {
        name: editForm.name,
        category: editForm.category,
        inventory_enabled: editForm.inventory_enabled,
        ai_chat_enabled: editForm.ai_chat_enabled,
        b2b_sync_enabled: editForm.b2b_sync_enabled,
        gst_number: editForm.gst_number,
      });

      await apiClient.patch(`/api/platform-admin/stores/${currentStore.id}/subscription`, {
        plan_code: editForm.plan_code,
        status: editForm.status,
        extend_days: Number(editForm.extend_days),
        billing_cycle: editForm.billing_cycle,
      });

      setMessage(`Store ${editForm.name} configuration & subscription updated successfully!`);
      setEditModalOpen(false);
      fetchStores();
      setTimeout(() => setMessage(''), 4000);
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
      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-secondary text-foreground border border-border capitalize">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Store className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Store Industry Directory
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage all {totalStores} tenant businesses and inspect products, user volumes, and feature modules per store.
          </p>
        </div>
        <button
          onClick={fetchStores}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground text-sm font-medium rounded-xl border border-border transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {message && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {message}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-card p-4 rounded-xl border border-border">
        {/* Search */}
        <div className="relative col-span-1 sm:col-span-2">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search store name, industry category, or owner email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500"
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
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500 capitalize"
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
              className="p-2 text-muted-foreground hover:text-foreground bg-secondary rounded-xl border border-border"
              title="Clear Category Filter"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stores Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted text-xs font-semibold uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3">Store</th>
                <th className="px-3 py-3 hidden xl:table-cell">Category</th>
                <th className="px-3 py-3">Users</th>
                <th className="px-3 py-3">Products</th>
                <th className="px-3 py-3 hidden xl:table-cell">Orders</th>
                <th className="px-3 py-3 hidden xl:table-cell">Modules</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                    Loading store catalog...
                  </td>
                </tr>
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No store accounts found matching criteria.
                  </td>
                </tr>
              ) : (
                stores.map((store) => {
                  // The platform admin's own account gets a "Dev" business shell
                  // automatically — it's not a real tenant, so category/product
                  // metrics for it would just be noise.
                  const isDevAccount = store.owner_email === 'admin@orderflow.com';
                  return (
                  <tr key={store.id} className="hover:bg-accent transition">
                    <td className="px-4 py-3 font-semibold text-foreground max-w-[170px] xl:max-w-[220px]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 shrink-0 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center font-bold text-blue-600 dark:text-blue-400 text-sm">
                          🏬
                        </div>
                        <div className="min-w-0">
                          <div className="text-foreground font-semibold truncate">{store.name}</div>
                          {store.owner_email && store.owner_email !== 'N/A' && (
                            <button
                              onClick={() => {
                                setSearch(store.owner_email!);
                                setPage(1);
                              }}
                              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-mono block text-left truncate max-w-full"
                              title={store.owner_email}
                            >
                              {store.owner_email}
                            </button>
                          )}
                          {store.gst_number && (
                            <div className="text-[10px] text-muted-foreground font-mono truncate">GST: {store.gst_number}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3 hidden xl:table-cell">
                      {isDevAccount ? <span className="text-muted-foreground">—</span> : renderCategoryBadge(store.category)}
                    </td>

                    <td className="px-3 py-3 font-semibold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> {store.user_count}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      {isDevAccount ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <button
                          onClick={() => openProductsModal(store)}
                          title="View Products"
                          className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-lg transition"
                        >
                          <Package className="w-3.5 h-3.5" />
                          {store.product_count}
                        </button>
                      )}
                    </td>

                    <td className="px-3 py-3 font-semibold text-foreground hidden xl:table-cell">
                      <div className="flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> {store.order_count}
                      </div>
                    </td>

                    <td className="px-3 py-3 hidden xl:table-cell">
                      <div className="flex items-center gap-1">
                        {store.inventory_enabled && (
                          <span title="Inventory module enabled" className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Inv
                          </span>
                        )}
                        {store.ai_chat_enabled && (
                          <span title="AI Chat module enabled" className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            AI
                          </span>
                        )}
                        {store.b2b_sync_enabled === false && (
                          <span title="OBIX Business Network disabled for this store" className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            B2B Off
                          </span>
                        )}
                        {!isDevAccount && !store.phone && (
                          <span title="No phone on file — still behind the required-phone backfill popup" className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            No phone
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-right">
                      {isDevAccount ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleImpersonateStore(store)}
                            title="Login as Store"
                            className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg border border-amber-500/30 transition"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openProductsModal(store)}
                            title="View Catalog"
                            className="p-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-500/30 transition"
                          >
                            <Package className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(store)}
                            title="Configure"
                            className="p-2 bg-secondary hover:bg-accent text-foreground rounded-lg border border-border transition"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSendTestPush(store)}
                            title="Send test push notification"
                            className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-500/30 transition"
                          >
                            <Bell className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(store)}
                            title="Delete Store"
                            className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-500/30 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-muted border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              Showing <span className="font-bold text-foreground">{totalStores > 0 ? startRecord : 0}</span> to{' '}
              <span className="font-bold text-foreground">{endRecord}</span> of{' '}
              <span className="font-bold text-foreground">{totalStores}</span> stores
            </span>

            <div className="flex items-center gap-2 border-l border-border pl-4">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-card border border-border text-foreground text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
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
              className="flex items-center gap-1 px-3 py-1.5 bg-secondary hover:bg-accent disabled:opacity-40 disabled:hover:bg-accent text-foreground text-xs font-semibold rounded-lg transition"
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
                    {showDots && <span className="px-1 text-muted-foreground">...</span>}
                    <button
                      onClick={() => setPage(pNum)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                        page === pNum
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                          : 'bg-card hover:bg-accent text-foreground border border-border'
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
              className="flex items-center gap-1 px-3 py-1.5 bg-secondary hover:bg-accent disabled:opacity-40 disabled:hover:bg-accent text-foreground text-xs font-semibold rounded-lg transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Store Products Modal */}
      {productsModalOpen && inspectStore && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400">
                  📦
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    {inspectStore.name} — Product Catalog
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Inspecting {totalStoreProducts} registered products in this store
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProductsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <input
                type="text"
                placeholder={`Search products in ${inspectStore.name}...`}
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setProductPage(1);
                }}
                className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Store Products Data Table */}
            <div className="border border-border rounded-xl overflow-auto bg-muted max-h-96">
              <table className="w-full min-w-[640px] text-left text-xs text-foreground">
                <thead className="bg-background text-[11px] font-semibold uppercase text-muted-foreground sticky top-0 border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Selling Price</th>
                    <th className="px-4 py-3">Cost Price</th>
                    <th className="px-4 py-3 text-right">Stock Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingProducts ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                        Loading products for {inspectStore.name}...
                      </td>
                    </tr>
                  ) : storeProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No products registered in this store.
                      </td>
                    </tr>
                  ) : (
                    storeProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-accent transition">
                        <td className="px-4 py-3 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <span>📦</span> {p.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{p.sku || '-'}</td>
                        <td className="px-4 py-3 capitalize text-foreground">{p.category || 'General'}</td>
                        <td className="px-4 py-3 font-bold text-emerald-600 dark:text-emerald-400">₹{(p.price || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-muted-foreground">₹{(p.cost_price || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center justify-center whitespace-nowrap px-2.5 py-0.5 font-semibold rounded-full border text-[10px] ${
                            p.current_stock > 10
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : p.current_stock > 0
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
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
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
              <div>
                Page <span className="font-bold text-foreground">{productPage}</span> of <span className="font-bold text-foreground">{productTotalPages}</span> ({totalStoreProducts} products)
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={productPage <= 1}
                  onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 bg-secondary hover:bg-accent disabled:opacity-40 text-foreground rounded-lg transition"
                >
                  Prev
                </button>
                <button
                  disabled={productPage >= productTotalPages}
                  onClick={() => setProductPage((p) => Math.min(productTotalPages, p + 1))}
                  className="px-3 py-1 bg-secondary hover:bg-accent disabled:opacity-40 text-foreground rounded-lg transition"
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
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Configure Store & Category
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStore} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Store Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Industry Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500 capitalize"
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
                <label className="block text-xs font-semibold text-foreground mb-1">GST Number</label>
                <input
                  type="text"
                  value={editForm.gst_number}
                  onChange={(e) => setEditForm({ ...editForm, gst_number: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500 font-mono uppercase"
                />
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between p-3 bg-background rounded-xl border border-border cursor-pointer">
                  <span className="text-xs font-semibold text-foreground">Inventory Module Enabled</span>
                  <input
                    type="checkbox"
                    checked={editForm.inventory_enabled}
                    onChange={(e) => setEditForm({ ...editForm, inventory_enabled: e.target.checked })}
                    className="w-4 h-4 rounded bg-card border-border text-blue-600 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-background rounded-xl border border-border cursor-pointer">
                  <span className="text-xs font-semibold text-foreground">AI Order Assistant Enabled</span>
                  <input
                    type="checkbox"
                    checked={editForm.ai_chat_enabled}
                    onChange={(e) => setEditForm({ ...editForm, ai_chat_enabled: e.target.checked })}
                    className="w-4 h-4 rounded bg-card border-border text-blue-600 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-background rounded-xl border border-border cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">OBIX Business Network Enabled</span>
                    <span className="text-[10px] text-muted-foreground">Turn off to stop this store from sending/receiving B2B connection requests</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editForm.b2b_sync_enabled}
                    onChange={(e) => setEditForm({ ...editForm, b2b_sync_enabled: e.target.checked })}
                    className="w-4 h-4 rounded bg-card border-border text-blue-600 focus:ring-0 shrink-0 ml-3"
                  />
                </label>
              </div>

              {/* Super Admin Subscription Override Block */}
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800/40 space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs">
                  <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Super Admin Subscription Override</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">Assigned Plan</label>
                    <select
                      value={editForm.plan_code}
                      onChange={(e) => setEditForm({ ...editForm, plan_code: e.target.value })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:border-indigo-500"
                    >
                      <option value="starter">Mobile Starter (₹59/mo)</option>
                      <option value="pro">Pro Plan ⭐ (₹399/mo)</option>
                      <option value="enterprise">Enterprise (₹999/mo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">Subscription Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:border-indigo-500"
                    >
                      <option value="active">Active ✅</option>
                      <option value="trialing">30-Day Free Trial ✨</option>
                      <option value="expired">Expired ⚠️</option>
                      <option value="canceled">Canceled ❌</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">Grant / Extend Days</label>
                    <input
                      type="number"
                      min="0"
                      max="365"
                      placeholder="e.g. 30"
                      value={editForm.extend_days}
                      onChange={(e) => setEditForm({ ...editForm, extend_days: Number(e.target.value) })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-foreground mb-1">Billing Cycle</label>
                    <select
                      value={editForm.billing_cycle}
                      onChange={(e) => setEditForm({ ...editForm, billing_cycle: e.target.value as any })}
                      className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Annual</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition shadow-lg shadow-blue-600/30"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Store Confirmation Modal */}
      {deleteModalOpen && deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-rose-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Delete Store Permanently</h3>
                <p className="text-xs text-muted-foreground">This cannot be undone</p>
              </div>
            </div>

            <div className="text-sm text-foreground space-y-2">
              <p>
                You are about to permanently delete <span className="font-bold">{deleteTarget.name}</span> and{' '}
                <span className="font-bold">all</span> of its data:
              </p>
              <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                <li>{deleteTarget.user_count} user account{deleteTarget.user_count === 1 ? '' : 's'}</li>
                <li>{deleteTarget.product_count} product{deleteTarget.product_count === 1 ? '' : 's'}</li>
                <li>{deleteTarget.order_count} order{deleteTarget.order_count === 1 ? '' : 's'}</li>
                <li>Customers, suppliers, invoices, and every other record tied to this store</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Type <span className="font-mono text-rose-600 dark:text-rose-400">{deleteTarget.name}</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={deleteTarget.name}
                autoFocus
                className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStore}
                disabled={deleting || deleteConfirmText !== deleteTarget.name}
                className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 rounded-xl transition shadow-lg shadow-rose-600/30"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
