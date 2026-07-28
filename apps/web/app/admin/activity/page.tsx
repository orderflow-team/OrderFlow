'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  Filter,
  RefreshCw,
  User,
  Store,
  Clock,
  Shield,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface LogItem {
  id: string;
  action: string;
  resource: string;
  user_id: string;
  user?: {
    full_name: string;
    email: string;
  };
  business_id: string;
  business?: {
    name: string;
  };
  metadata: any;
  created_at: string;
}

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/platform-admin/activity-logs', {
        params: {
          search,
          action: actionFilter,
          page,
          limit: 15,
        },
      });
      setLogs(res.data.data);
      setTotalPages(res.data.meta.totalPages);
      setTotalLogs(res.data.meta.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search, actionFilter, page]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="w-7 h-7 text-emerald-400" />
            System & User Activity Logs
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time audit log of system activities, logins, store configuration changes, and user management events.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
        <div className="relative col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by action name, user, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div>
          <button
            onClick={() => {
              setSearch('');
              setActionFilter('');
            }}
            className="w-full py-2 px-3 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/50 transition"
          >
            Clear Search Filters
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Action Event</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Associated Store</th>
                <th className="px-6 py-4">Metadata</th>
                <th className="px-6 py-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-sans">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                    Loading audit trail logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-sans">
                    No activity logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 font-sans font-semibold text-emerald-400">
                      <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs">
                        {log.action}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-sans">
                      <div className="text-slate-200 font-medium">{log.user?.full_name || 'System / Admin'}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{log.user?.email}</div>
                    </td>

                    <td className="px-6 py-4 font-sans text-slate-300">
                      {log.business?.name || 'Platform Wide'}
                    </td>

                    <td className="px-6 py-4 text-[11px] text-slate-400 max-w-xs truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : '-'}
                    </td>

                    <td className="px-6 py-4 text-right text-slate-400">
                      {new Date(log.created_at).toLocaleString()}
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
