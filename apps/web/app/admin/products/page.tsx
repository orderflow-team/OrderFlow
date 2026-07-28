'use client';

import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  RefreshCw,
  Store,
  Tag,
  Boxes,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost_price: number;
  current_stock: number;
  business_name: string;
  created_at: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/platform-admin/products-overview', {
        params: { search, page, limit: 12 },
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
    fetchProducts();
  }, [search, page]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Package className="w-7 h-7 text-emerald-400" />
            Global Products Aggregator
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            System-wide view of all {totalProducts} inventory products registered across tenant stores.
          </p>
        </div>
        <button
          onClick={fetchProducts}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search product name or SKU across all stores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4">SKU / Code</th>
                <th className="px-6 py-4">Store</th>
                <th className="px-6 py-4">Selling Price</th>
                <th className="px-6 py-4">Stock Level</th>
                <th className="px-6 py-4 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    Loading catalog data...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No products found matching criteria.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 font-semibold text-white">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-xs">
                          📦
                        </div>
                        {p.name}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs font-mono text-slate-400">
                      {p.sku || 'N/A'}
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-slate-500" />
                        {p.business_name}
                      </div>
                    </td>

                    <td className="px-6 py-4 font-semibold text-emerald-400">
                      ₹{p.price.toLocaleString('en-IN')}
                    </td>

                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        p.current_stock > 10
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : p.current_stock > 0
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {p.current_stock} in stock
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right text-xs text-slate-400 font-mono">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
