'use client';

import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  RefreshCw,
  Store,
  Tag,
  Boxes,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost_price: number;
  current_stock: number;
  business_id: string;
  business_name: string;
  category: string;
  created_at: string;
}

interface StoreOption {
  id: string;
  name: string;
  category?: string;
}

const MAIN_BUSINESS_CATEGORIES = [
  { id: 'grocery', label: 'Grocery Store' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'retail', label: 'Retail Store' },
  { id: 'wholesale', label: 'Wholesale' },
  { id: 'salesman', label: 'Sales Field / FMCG' },
  { id: 'others', label: 'Others / Custom' },
];

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [storesList, setStoresList] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  // Filters & Pagination State
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  const fetchStoresList = async () => {
    try {
      const res = await apiClient.get('/api/platform-admin/stores', {
        params: { limit: 100, category: selectedCategory },
      });
      setStoresList(res.data.data || []);
    } catch (err) {
      console.error('Failed to load stores list:', err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/platform-admin/products-overview', {
        params: {
          search,
          category: selectedCategory,
          business_id: selectedStoreId,
          page,
          limit,
        },
      });
      setProducts(res.data.data);
      setTotalPages(res.data.meta.totalPages);
      setTotalProducts(res.data.meta.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoresList();
    setSelectedStoreId('');
  }, [selectedCategory]);

  useEffect(() => {
    fetchProducts();
  }, [search, selectedCategory, selectedStoreId, page, limit]);

  // Export Filtered Catalog to CSV
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await apiClient.get('/api/platform-admin/products-overview', {
        params: {
          search,
          category: selectedCategory,
          business_id: selectedStoreId,
          page: 1,
          limit: 500,
        },
      });

      const exportData: ProductItem[] = res.data.data;
      if (!exportData || exportData.length === 0) {
        alert('No products found matching filters to export.');
        return;
      }

      const headers = ['ID', 'Product Name', 'SKU / Code', 'Store Name', 'Category', 'Selling Price (INR)', 'Cost Price (INR)', 'Stock Quantity', 'Created Date'];
      const csvRows = [headers.join(',')];

      exportData.forEach((p) => {
        const row = [
          `"${p.id}"`,
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.sku || 'N/A').replace(/"/g, '""')}"`,
          `"${(p.business_name || '').replace(/"/g, '""')}"`,
          `"${(p.category || 'General').replace(/"/g, '""')}"`,
          p.price || 0,
          p.cost_price || 0,
          p.current_stock || 0,
          `"${new Date(p.created_at).toLocaleDateString()}"`,
        ];
        csvRows.push(row.join(','));
      });

      const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      
      const storeNameSlug = storesList.find(s => s.id === selectedStoreId)?.name || 'all_stores';
      const filename = `catalog_${storeNameSlug}_${selectedCategory || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`;
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      alert('Failed to generate CSV export.');
    } finally {
      setExporting(false);
    }
  };

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalProducts);
  const selectedCatLabel = MAIN_BUSINESS_CATEGORIES.find(c => c.id === selectedCategory)?.label || selectedCategory;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Package className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Global Products Aggregator
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            System-wide product catalog with Shop/Store filter, Category filter, pagination, and instant CSV export.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition"
          >
            <FileSpreadsheet className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Exporting...' : 'Export Filtered CSV'}
          </button>

          <button
            onClick={fetchProducts}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground text-sm font-medium rounded-xl border border-border transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-card p-4 rounded-xl border border-border">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search product name, SKU, category, or shop name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Category Filter (Step 1) */}
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-emerald-500 capitalize font-medium"
          >
            <option value="">🏷️ All Main Business Categories</option>
            {MAIN_BUSINESS_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Shop / Store Name Filter (Step 2 - Filtered by Category) */}
        <div>
          <select
            value={selectedStoreId}
            onChange={(e) => {
              setSelectedStoreId(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-emerald-500 font-medium"
          >
            <option value="">
              🏪 {selectedCategory ? `Shops in ${selectedCatLabel}` : 'All Shops & Stores'} ({storesList.length})
            </option>
            {storesList.map((store) => (
              <option key={store.id} value={store.id}>
                🏪 {store.name} {store.category ? `— (${store.category})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Reset Filters */}
        <div className="flex items-center">
          <button
            onClick={() => {
              setSearch('');
              setSelectedCategory('');
              setSelectedStoreId('');
              setPage(1);
            }}
            className="w-full py-2 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary hover:bg-accent rounded-xl border border-border transition flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Reset Filters
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted text-xs font-semibold uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4">SKU / Code</th>
                <th className="px-6 py-4">Store / Shop Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Selling Price</th>
                <th className="px-6 py-4">Stock Level</th>
                <th className="px-6 py-4 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                    Loading catalog data...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    No products found matching specified shop or category filters.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-accent transition">
                    <td className="px-6 py-4 font-semibold text-foreground">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          📦
                        </div>
                        {p.name}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                      {p.sku || 'N/A'}
                    </td>

                    <td className="px-6 py-4 text-xs text-foreground">
                      <div className="flex items-center gap-1.5 font-medium text-indigo-700 dark:text-indigo-300">
                        <Store className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        {p.business_name}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs">
                      <span className="px-2.5 py-1 rounded-lg bg-secondary border border-border text-foreground font-semibold capitalize">
                        {p.category || 'General'}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{p.price.toLocaleString('en-IN')}
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center justify-center whitespace-nowrap px-3 py-1 text-xs font-semibold rounded-full border ${
                        p.current_stock > 10
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : p.current_stock > 0
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      }`}>
                        {p.current_stock} in stock
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right text-xs text-muted-foreground font-mono">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-muted border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              Showing <span className="font-bold text-foreground">{totalProducts > 0 ? startRecord : 0}</span> to{' '}
              <span className="font-bold text-foreground">{endRecord}</span> of{' '}
              <span className="font-bold text-foreground">{totalProducts}</span> products
            </span>

            <div className="flex items-center gap-2 border-l border-border pl-4">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-card border border-border text-foreground text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
              >
                <option value={12}>12</option>
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
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
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
    </div>
  );
}
