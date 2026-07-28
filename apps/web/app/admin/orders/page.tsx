'use client';

import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Search,
  RefreshCw,
  Store,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface OrderItem {
  id: string;
  order_number: string;
  customer_name: string;
  business_id: string;
  business_name: string;
  status: string;
  total_amount: number;
  tax_amount: number;
  created_at: string;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/platform-admin/orders', {
        params: {
          search,
          status: statusFilter,
          page,
          limit,
        },
      });
      setOrders(res.data.data);
      setTotalRevenue(res.data.summary.totalRevenue || 0);
      setTotalPages(res.data.meta.totalPages);
      setTotalOrders(res.data.meta.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [search, statusFilter, page, limit]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await apiClient.get('/api/platform-admin/orders', {
        params: {
          search,
          status: statusFilter,
          page: 1,
          limit: 500,
        },
      });

      const exportData: OrderItem[] = res.data.data;
      if (!exportData || exportData.length === 0) {
        alert('No orders found to export.');
        return;
      }

      const headers = ['Order ID', 'Order Number', 'Customer Name', 'Store Name', 'Status', 'Total Amount (INR)', 'Tax (INR)', 'Date'];
      const csvRows = [headers.join(',')];

      exportData.forEach((o) => {
        const row = [
          `"${o.id}"`,
          `"${o.order_number}"`,
          `"${(o.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
          `"${(o.business_name || '').replace(/"/g, '""')}"`,
          `"${o.status}"`,
          o.total_amount || 0,
          o.tax_amount || 0,
          `"${new Date(o.created_at).toLocaleString()}"`,
        ];
        csvRows.push(row.join(','));
      });

      const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `orderflow_global_orders_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export orders CSV:', err);
      alert('Failed to export orders CSV.');
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed' || s === 'delivered') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 capitalize">
          <CheckCircle className="w-3.5 h-3.5" />
          {status}
        </span>
      );
    }
    if (s === 'pending' || s === 'processing') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 capitalize">
          <Clock className="w-3.5 h-3.5" />
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 capitalize">
        <XCircle className="w-3.5 h-3.5" />
        {status}
      </span>
    );
  };

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalOrders);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <ShoppingCart className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            Global Orders & Gross Volume Stream
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            System-wide order stream across all tenant stores with status filters and gross revenue tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition"
          >
            <FileSpreadsheet className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Exporting...' : 'Export Orders CSV'}
          </button>

          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground text-sm font-medium rounded-xl border border-border transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Gross Revenue Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-500/10 to-card border border-indigo-500/20 p-5 rounded-2xl backdrop-blur-sm">
          <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Gross Platform Volume</div>
          <div className="text-3xl font-extrabold text-foreground mt-2">
            ₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Accumulated across all stores
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl backdrop-blur-sm">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Recorded Orders</div>
          <div className="text-3xl font-extrabold text-foreground mt-2">{totalOrders}</div>
          <div className="text-xs text-muted-foreground mt-1">Live order count</div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl backdrop-blur-sm">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Average Order Value</div>
          <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            ₹{totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : '0.00'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Gross GMV / total orders</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-card p-4 rounded-xl border border-border">
        <div className="relative col-span-1 sm:col-span-2">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search order number, customer name, or store name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500 capitalize font-medium"
          >
            <option value="">All Order Statuses</option>
            <option value="completed">Completed / Delivered</option>
            <option value="pending">Pending / Processing</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {statusFilter && (
            <button
              onClick={() => {
                setStatusFilter('');
                setPage(1);
              }}
              className="p-2 text-muted-foreground hover:text-foreground bg-secondary rounded-xl border border-border"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted text-xs font-semibold uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-6 py-4">Order #</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Store Name</th>
                <th className="px-6 py-4">Total Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600 dark:text-indigo-400" />
                    Loading order stream...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No orders recorded matching criteria.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-accent transition">
                    <td className="px-6 py-4 font-mono font-semibold text-foreground">
                      #{o.order_number}
                    </td>

                    <td className="px-6 py-4 font-medium text-foreground">
                      {o.customer_name}
                    </td>

                    <td className="px-6 py-4 text-xs">
                      <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-medium">
                        <Store className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        {o.business_name}
                      </div>
                    </td>

                    <td className="px-6 py-4 font-extrabold text-emerald-600 dark:text-emerald-400">
                      ₹{o.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>

                    <td className="px-6 py-4">
                      {getStatusBadge(o.status)}
                    </td>

                    <td className="px-6 py-4 text-right text-xs text-muted-foreground font-mono">
                      {new Date(o.created_at).toLocaleString()}
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
              Showing <span className="font-bold text-foreground">{totalOrders > 0 ? startRecord : 0}</span> to{' '}
              <span className="font-bold text-foreground">{endRecord}</span> of{' '}
              <span className="font-bold text-foreground">{totalOrders}</span> orders
            </span>

            <div className="flex items-center gap-2 border-l border-border pl-4">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-card border border-border text-foreground text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500"
              >
                <option value={15}>15</option>
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
              className="flex items-center gap-1 px-3 py-1.5 bg-secondary hover:bg-accent disabled:opacity-40 text-foreground text-xs font-semibold rounded-lg transition"
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
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
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
              className="flex items-center gap-1 px-3 py-1.5 bg-secondary hover:bg-accent disabled:opacity-40 text-foreground text-xs font-semibold rounded-lg transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
