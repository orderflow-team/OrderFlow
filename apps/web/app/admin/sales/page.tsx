'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Store,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

type Tab = 'stores' | 'items' | 'orders';

interface StoreSales {
  business_id: string;
  business_name: string;
  category: string | null;
  orders_count: number;
  items_sold: number;
  revenue: number;
  tax: number;
  avg_order_value: number;
  last_order_at: string | null;
}

interface ItemSold {
  business_id: string;
  business_name: string;
  product_name: string;
  category: string | null;
  quantity_sold: number;
  quantity_returned: number;
  net_quantity: number;
  revenue: number;
  tax: number;
  orders_count: number;
}

interface OrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  business_id: string;
  business_name: string;
  status: string;
  origin: string;
  total_amount: number;
  tax_amount: number;
  created_at: string;
}

interface OrderDetail extends OrderRow {
  order_type: string;
  notes: string | null;
  items: {
    id: string;
    product_name: string;
    quantity: number;
    unit: string | null;
    unit_price: number;
    subtotal: number;
    tax_percentage: number;
    tax_amount: number;
    returned_quantity: number;
  }[];
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const num = (n: number) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

// Quote every field and neutralise spreadsheet formula injection (store and
// product names are user-controlled and this file is opened in Excel).
const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return '""';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

const downloadCsv = (filename: string, headers: string[], rows: unknown[][]) => {
  const body = [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');
  // BOM so Excel reads UTF-8 (₹, non-English names) correctly.
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString() : '');
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
const today = () => new Date().toISOString().slice(0, 10);

export default function AdminSalesPage() {
  const [tab, setTab] = useState<Tab>('stores');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [storeId, setStoreId] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const [stores, setStores] = useState<StoreSales[]>([]);
  const [storeSummary, setStoreSummary] = useState({ stores: 0, orders: 0, itemsSold: 0, revenue: 0, tax: 0 });
  const [items, setItems] = useState<ItemSold[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const limit = 25;

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const storeName = stores.find((s) => s.business_id === storeId)?.business_name;
  const rangeLabel = `${from || 'start'}_to_${to || today()}`;

  // The store dropdown + Stores tab always need the per-store list.
  const loadStores = useCallback(async () => {
    const res = await apiClient.get('/api/platform-admin/sales/stores', {
      params: { from: from || undefined, to: to || undefined, search: tab === 'stores' ? search || undefined : undefined },
    });
    setStores(res.data?.data ?? []);
    setStoreSummary(res.data?.summary ?? { stores: 0, orders: 0, itemsSold: 0, revenue: 0, tax: 0 });
  }, [from, to, search, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'stores') {
        await loadStores();
      } else if (tab === 'items') {
        const res = await apiClient.get('/api/platform-admin/sales/items', {
          params: { business_id: storeId || undefined, from: from || undefined, to: to || undefined, search: search || undefined },
        });
        setItems(res.data?.data ?? []);
      } else {
        const res = await apiClient.get('/api/platform-admin/orders', {
          params: {
            business_id: storeId || undefined,
            from: from || undefined,
            to: to || undefined,
            search: search || undefined,
            status: status || undefined,
            page,
            limit,
          },
        });
        setOrders(res.data?.data ?? []);
        setTotalPages(res.data?.meta?.totalPages || 1);
        setTotalOrders(res.data?.meta?.total || 0);
      }
    } catch (e) {
      console.error(e);
      setError('Failed to load sales data.');
    } finally {
      setLoading(false);
    }
  }, [tab, storeId, from, to, search, status, page, loadStores]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce search typing
    return () => clearTimeout(t);
  }, [load]);

  // Populate the store filter once, independent of the active tab.
  useEffect(() => {
    if (tab !== 'stores' && stores.length === 0) loadStores().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await apiClient.get(`/api/platform-admin/orders/${id}/detail`);
      setDetail(res.data);
    } catch {
      setError('Failed to load order details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setExporting(key);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      alert('Export failed.');
    } finally {
      setExporting('');
    }
  };

  const exportStores = () =>
    run('stores', async () => {
      if (!stores.length) return alert('Nothing to export.');
      downloadCsv(
        `obix_sales_by_store_${rangeLabel}.csv`,
        ['Store', 'Category', 'Orders', 'Items Sold (net)', 'Revenue (INR)', 'Tax (INR)', 'Avg Order Value (INR)', 'Last Order'],
        stores.map((s) => [s.business_name, s.category, s.orders_count, s.items_sold, s.revenue.toFixed(2), s.tax.toFixed(2), s.avg_order_value.toFixed(2), fmtDate(s.last_order_at)]),
      );
    });

  const exportItems = () =>
    run('items', async () => {
      if (!items.length) return alert('Nothing to export.');
      downloadCsv(
        `obix_items_sold_${slug(storeName || 'all_stores')}_${rangeLabel}.csv`,
        ['Store', 'Item', 'Category', 'Qty Sold', 'Qty Returned', 'Net Qty', 'Orders', 'Revenue (INR)', 'Tax (INR)'],
        items.map((i) => [i.business_name, i.product_name, i.category, i.quantity_sold, i.quantity_returned, i.net_quantity, i.orders_count, i.revenue.toFixed(2), i.tax.toFixed(2)]),
      );
    });

  const lineParams = () => ({
    business_id: storeId || undefined,
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
    status: status || undefined,
  });

  const exportOrders = () =>
    run('orders', async () => {
      // Page through the list endpoint (max 100/page) so the export isn't capped.
      const all: OrderRow[] = [];
      for (let p = 1; p <= 200; p++) {
        const res = await apiClient.get('/api/platform-admin/orders', { params: { ...lineParams(), page: p, limit: 100 } });
        all.push(...(res.data?.data ?? []));
        if (p >= (res.data?.meta?.totalPages || 1)) break;
      }
      if (!all.length) return alert('No orders to export.');
      downloadCsv(
        `obix_orders_${slug(storeName || 'all_stores')}_${rangeLabel}.csv`,
        ['Order Number', 'Date', 'Store', 'Customer', 'Status', 'Origin', 'Total (INR)', 'Tax (INR)'],
        all.map((o) => [o.order_number, fmtDate(o.created_at), o.business_name, o.customer_name, o.status, o.origin, o.total_amount.toFixed(2), o.tax_amount.toFixed(2)]),
      );
    });

  const exportOrderLines = () =>
    run('lines', async () => {
      const res = await apiClient.get('/api/platform-admin/sales/order-lines', { params: lineParams() });
      const rows: any[] = res.data?.data ?? [];
      if (!rows.length) return alert('No orders to export.');
      downloadCsv(
        `obix_orders_with_items_${slug(storeName || 'all_stores')}_${rangeLabel}.csv`,
        ['Order Number', 'Date', 'Store', 'Customer', 'Status', 'Origin', 'Item', 'Qty', 'Unit', 'Unit Price (INR)', 'Line Subtotal (INR)', 'Tax %', 'Line Tax (INR)', 'Qty Returned', 'Order Total (INR)', 'Order Tax (INR)'],
        rows.map((r) => [r.order_number, fmtDate(r.created_at), r.business_name, r.customer_name, r.status, r.origin, r.product_name, r.quantity, r.unit, r.unit_price, r.subtotal, r.tax_percentage, r.item_tax, r.returned_quantity, r.order_total, r.order_tax]),
      );
    });

  const exportDetail = () => {
    if (!detail) return;
    downloadCsv(
      `obix_order_${slug(detail.order_number)}.csv`,
      ['Order Number', 'Date', 'Store', 'Customer', 'Status', 'Item', 'Qty', 'Unit', 'Unit Price (INR)', 'Subtotal (INR)', 'Tax %', 'Tax (INR)', 'Qty Returned'],
      detail.items.map((i) => [detail.order_number, fmtDate(detail.created_at), detail.business_name, detail.customer_name, detail.status, i.product_name, i.quantity, i.unit, i.unit_price, i.subtotal, i.tax_percentage, i.tax_amount, i.returned_quantity]),
    );
  };

  const exportPrimary = tab === 'stores' ? exportStores : tab === 'items' ? exportItems : exportOrders;
  const primaryKey = tab === 'stores' ? 'stores' : tab === 'items' ? 'items' : 'orders';
  const primaryLabel = tab === 'stores' ? 'Export Store Sales CSV' : tab === 'items' ? 'Export Items Sold CSV' : 'Export Orders CSV';

  const inputCls = 'bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500';
  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-semibold rounded-xl transition ${tab === t ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-secondary text-foreground hover:bg-accent border border-border'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Sales Data — Store-wise Package
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Revenue, items sold and every order per store. Drafts, cancelled and returned orders are excluded from sales totals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={exportPrimary}
            disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting === primaryKey ? 'Exporting...' : primaryLabel}
          </button>
          {tab === 'orders' && (
            <button
              onClick={exportOrderLines}
              disabled={!!exporting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition"
            >
              <Download className="w-4 h-4" />
              {exporting === 'lines' ? 'Exporting...' : 'Export Orders + Items CSV'}
            </button>
          )}
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground text-sm font-medium rounded-xl border border-border transition">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 bg-card p-4 rounded-xl border border-border">
        <div className="flex gap-2">
          <button className={tabCls('stores')} onClick={() => { setTab('stores'); setPage(1); }}>Stores</button>
          <button className={tabCls('items')} onClick={() => { setTab('items'); setPage(1); }}>Items Sold</button>
          <button className={tabCls('orders')} onClick={() => { setTab('orders'); setPage(1); }}>Orders</button>
        </div>
        <label className="text-xs text-muted-foreground flex flex-col gap-1">
          From
          <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={inputCls} />
        </label>
        <label className="text-xs text-muted-foreground flex flex-col gap-1">
          To
          <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={inputCls} />
        </label>
        {tab !== 'stores' && (
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Store
            <select value={storeId} onChange={(e) => { setStoreId(e.target.value); setPage(1); }} className={`${inputCls} max-w-[220px]`}>
              <option value="">All stores</option>
              {stores.map((s) => (
                <option key={s.business_id} value={s.business_id}>{s.business_name}</option>
              ))}
            </select>
          </label>
        )}
        {tab === 'orders' && (
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            Status
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={inputCls}>
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="delivered">Delivered</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
              <option value="returned">Returned</option>
            </select>
          </label>
        )}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <input
            type="text"
            placeholder={tab === 'stores' ? 'Search store...' : tab === 'items' ? 'Search item...' : 'Search order #, customer or store...'}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={`${inputCls} w-full pl-9`}
          />
        </div>
        {(from || to || storeId || status || search) && (
          <button
            onClick={() => { setFrom(''); setTo(''); setStoreId(''); setStatus(''); setSearch(''); setPage(1); }}
            className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground bg-secondary rounded-xl border border-border"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm">{error}</div>}

      {tab === 'stores' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ['Stores', String(storeSummary.stores)],
            ['Orders', String(storeSummary.orders)],
            ['Items Sold', num(storeSummary.itemsSold)],
            ['Revenue', inr(storeSummary.revenue)],
          ].map(([label, value]) => (
            <div key={label} className="bg-card border border-border p-5 rounded-2xl">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
              <div className="text-2xl font-extrabold text-foreground mt-2">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted text-xs font-semibold uppercase text-muted-foreground border-b border-border">
              {tab === 'stores' && (
                <tr>
                  <th className="px-6 py-4">Store</th>
                  <th className="px-6 py-4 text-right">Orders</th>
                  <th className="px-6 py-4 text-right">Items Sold</th>
                  <th className="px-6 py-4 text-right">Revenue</th>
                  <th className="px-6 py-4 text-right">Tax</th>
                  <th className="px-6 py-4 text-right">Avg Order</th>
                  <th className="px-6 py-4"></th>
                </tr>
              )}
              {tab === 'items' && (
                <tr>
                  <th className="px-6 py-4">Item</th>
                  <th className="px-6 py-4">Store</th>
                  <th className="px-6 py-4 text-right">Qty Sold</th>
                  <th className="px-6 py-4 text-right">Returned</th>
                  <th className="px-6 py-4 text-right">Net Qty</th>
                  <th className="px-6 py-4 text-right">Orders</th>
                  <th className="px-6 py-4 text-right">Revenue</th>
                </tr>
              )}
              {tab === 'orders' && (
                <tr>
                  <th className="px-6 py-4">Order #</th>
                  <th className="px-6 py-4">Store</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-right">Date</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600 dark:text-blue-400" />Loading...</td></tr>
              ) : tab === 'stores' ? (
                stores.length === 0 ? <EmptyRow /> : stores.map((s) => (
                  <tr key={s.business_id} className="hover:bg-accent transition">
                    <td className="px-6 py-4 font-medium"><span className="flex items-center gap-1.5"><Store className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />{s.business_name}</span></td>
                    <td className="px-6 py-4 text-right">{s.orders_count}</td>
                    <td className="px-6 py-4 text-right">{num(s.items_sold)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{inr(s.revenue)}</td>
                    <td className="px-6 py-4 text-right">{inr(s.tax)}</td>
                    <td className="px-6 py-4 text-right">{inr(s.avg_order_value)}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button onClick={() => { setStoreId(s.business_id); setTab('items'); setPage(1); }} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mr-3">Items</button>
                      <button onClick={() => { setStoreId(s.business_id); setTab('orders'); setPage(1); }} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">Orders</button>
                    </td>
                  </tr>
                ))
              ) : tab === 'items' ? (
                items.length === 0 ? <EmptyRow /> : items.map((i, idx) => (
                  <tr key={`${i.business_id}-${i.product_name}-${idx}`} className="hover:bg-accent transition">
                    <td className="px-6 py-4 font-medium">{i.product_name}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{i.business_name}</td>
                    <td className="px-6 py-4 text-right">{num(i.quantity_sold)}</td>
                    <td className="px-6 py-4 text-right">{num(i.quantity_returned)}</td>
                    <td className="px-6 py-4 text-right font-semibold">{num(i.net_quantity)}</td>
                    <td className="px-6 py-4 text-right">{i.orders_count}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{inr(i.revenue)}</td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <EmptyRow />
              ) : (
                orders.map((o) => (
                  <tr key={o.id} onClick={() => openDetail(o.id)} className="hover:bg-accent transition cursor-pointer">
                    <td className="px-6 py-4 font-mono font-semibold">#{o.order_number}</td>
                    <td className="px-6 py-4 text-xs">{o.business_name}</td>
                    <td className="px-6 py-4">{o.customer_name}</td>
                    <td className="px-6 py-4 capitalize">{o.status}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">{inr(o.total_amount)}</td>
                    <td className="px-6 py-4 text-right text-xs text-muted-foreground font-mono">{fmtDate(o.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {tab === 'orders' && (
          <div className="px-6 py-4 bg-muted border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>{totalOrders} orders — click a row to see its items</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="flex items-center gap-1 px-3 py-1.5 bg-secondary hover:bg-accent disabled:opacity-40 text-foreground font-semibold rounded-lg"><ChevronLeft className="w-4 h-4" />Previous</button>
              <span>Page {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="flex items-center gap-1 px-3 py-1.5 bg-secondary hover:bg-accent disabled:opacity-40 text-foreground font-semibold rounded-lg">Next<ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { setDetail(null); setDetailLoading(false); }}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <div className="p-12 text-center text-muted-foreground"><RefreshCw className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : (
              <>
                <div className="p-6 border-b border-border flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Order #{detail.order_number}</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {detail.business_name} · {detail.customer_name} · <span className="capitalize">{detail.status}</span> · {fmtDate(detail.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={exportDetail} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl"><FileSpreadsheet className="w-4 h-4" />Export CSV</button>
                    <button onClick={() => setDetail(null)} className="p-2 text-muted-foreground hover:text-foreground bg-secondary rounded-xl border border-border"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <table className="w-full text-left text-sm text-foreground">
                  <thead className="bg-muted text-xs font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3">Item</th>
                      <th className="px-6 py-3 text-right">Qty</th>
                      <th className="px-6 py-3 text-right">Price</th>
                      <th className="px-6 py-3 text-right">Tax</th>
                      <th className="px-6 py-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {detail.items.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No line items on this order.</td></tr>
                    ) : detail.items.map((i) => (
                      <tr key={i.id}>
                        <td className="px-6 py-3">{i.product_name}</td>
                        <td className="px-6 py-3 text-right">{num(i.quantity)}{i.unit ? ` ${i.unit}` : ''}{i.returned_quantity > 0 ? ` (−${num(i.returned_quantity)} ret.)` : ''}</td>
                        <td className="px-6 py-3 text-right">{inr(i.unit_price)}</td>
                        <td className="px-6 py-3 text-right">{inr(i.tax_amount)} <span className="text-xs text-muted-foreground">({num(i.tax_percentage)}%)</span></td>
                        <td className="px-6 py-3 text-right font-semibold">{inr(i.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-6 border-t border-border flex justify-end gap-8 text-sm">
                  <span className="text-muted-foreground">Tax <b className="text-foreground">{inr(detail.tax_amount)}</b></span>
                  <span className="text-muted-foreground">Total <b className="text-emerald-600 dark:text-emerald-400">{inr(detail.total_amount)}</b></span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyRow() {
  return (
    <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No sales data for the selected filters.</td></tr>
  );
}
