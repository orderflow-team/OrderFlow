'use client';

import React, { useState, useEffect } from 'react';
import { Link2, Search, RefreshCw, CheckCircle2, Clock, XCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface ConnectionRow {
  id: string;
  status: string;
  retailer_business_id: string;
  retailer_name: string;
  wholesaler_business_id: string;
  wholesaler_name: string;
  initiated_by_business_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Platform-wide view of every business-connections link — before this page
 * existed, support had no way to answer "is my wholesaler actually linked?"
 * or "why is my connection request stuck?" short of a direct DB query.
 * Read-only: accepting/rejecting is still the two businesses' own call, made
 * from their own Business Network panel — this is visibility, not control.
 */
export default function AdminBusinessConnectionsPage() {
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/platform-admin/business-connections', {
        params: { search, status: statusFilter, page, limit },
      });
      setConnections(res.data.data);
      setTotalPages(res.data.meta.totalPages);
      setTotal(res.data.meta.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [search, statusFilter, page, limit]);

  const getStatusBadge = (status: string) => {
    if (status === 'accepted') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3.5 h-3.5" /> Linked
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          <Clock className="w-3.5 h-3.5" /> Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
        <XCircle className="w-3.5 h-3.5" /> Rejected
      </span>
    );
  };

  const initiatorName = (row: ConnectionRow) =>
    row.initiated_by_business_id === row.retailer_business_id ? row.retailer_name : row.wholesaler_name;

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Link2 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            OBIX Business Network
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Every retailer↔wholesaler connection request across the platform — linked, pending, or rejected.
          </p>
        </div>
        <button
          onClick={fetchConnections}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground text-sm font-medium rounded-xl border border-border transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-card p-4 rounded-xl border border-border">
        <div className="relative col-span-1 sm:col-span-2">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by retailer or wholesaler business name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">All Statuses</option>
            <option value="accepted">Linked</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
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

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted text-xs font-semibold uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-6 py-4">Retailer</th>
                <th className="px-6 py-4">Wholesaler</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Requested by</th>
                <th className="px-6 py-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                    Loading connections...
                  </td>
                </tr>
              ) : connections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No business connections found matching criteria.
                  </td>
                </tr>
              ) : (
                connections.map((c) => (
                  <tr key={c.id} className="hover:bg-accent transition">
                    <td className="px-6 py-4 font-medium text-foreground">{c.retailer_name}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{c.wholesaler_name}</td>
                    <td className="px-6 py-4">{getStatusBadge(c.status)}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{initiatorName(c)}</td>
                    <td className="px-6 py-4 text-right text-xs text-muted-foreground font-mono">
                      {new Date(c.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-muted border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              Showing <span className="font-bold text-foreground">{total > 0 ? startRecord : 0}</span> to{' '}
              <span className="font-bold text-foreground">{endRecord}</span> of{' '}
              <span className="font-bold text-foreground">{total}</span> connections
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
