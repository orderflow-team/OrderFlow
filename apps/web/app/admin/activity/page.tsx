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
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
  Eye,
  Info,
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
  ip_address?: string;
  created_at: string;
}

const ACTION_TYPES = [
  'USER_LOGIN',
  'UPDATE_USER',
  'UPDATE_STORE',
  'SYSTEM_BOOTSTRAP',
  'STORE_CONFIGURED',
];

const formatDateTime = (dateVal: string | Date | undefined | null) => {
  if (!dateVal) return '-';
  let dateStr = typeof dateVal === 'string' ? dateVal : dateVal.toISOString();
  if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateVal);

  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  
  // Filters & Pagination State
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Inspector Modal
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/platform-admin/activity-logs', {
        params: {
          search,
          action: actionFilter,
          page,
          limit,
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
  }, [search, actionFilter, page, limit]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await apiClient.get('/api/platform-admin/activity-logs', {
        params: {
          search,
          action: actionFilter,
          page: 1,
          limit: 500,
        },
      });

      const exportData: LogItem[] = res.data.data;
      if (!exportData || exportData.length === 0) {
        alert('No activity logs found to export.');
        return;
      }

      const headers = ['Log ID', 'Action Event', 'Resource', 'User Name', 'User Email', 'Store Name', 'Metadata', 'IP Address', 'Timestamp'];
      const csvRows = [headers.join(',')];

      exportData.forEach((log) => {
        const row = [
          `"${log.id}"`,
          `"${(log.action || '').replace(/"/g, '""')}"`,
          `"${(log.resource || 'System').replace(/"/g, '""')}"`,
          `"${(log.user?.full_name || 'System Admin').replace(/"/g, '""')}"`,
          `"${(log.user?.email || 'N/A').replace(/"/g, '""')}"`,
          `"${(log.business?.name || 'Platform Wide').replace(/"/g, '""')}"`,
          `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"`,
          `"${log.ip_address || '127.0.0.1'}"`,
          `"${new Date(log.created_at).toLocaleString()}"`,
        ];
        csvRows.push(row.join(','));
      });

      const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `orderflow_activity_logs_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export activity logs:', err);
      alert('Failed to export activity logs.');
    } finally {
      setExporting(false);
    }
  };

  const openLogInspector = (log: LogItem) => {
    setSelectedLog(log);
    setInspectModalOpen(true);
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'USER_LOGIN':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'UPDATE_USER':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'UPDATE_STORE':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'SYSTEM_BOOTSTRAP':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
  };

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalLogs);

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
            Real-time audit trail of all {totalLogs} system activities, logins, store configuration changes, and user management events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition"
          >
            <FileSpreadsheet className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Exporting...' : 'Export Logs CSV'}
          </button>

          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
        {/* Search */}
        <div className="relative col-span-1 sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by action name, user, or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Action Event Filter */}
        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 capitalize"
          >
            <option value="">All Action Events</option>
            {ACTION_TYPES.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
          {actionFilter && (
            <button
              onClick={() => {
                setActionFilter('');
                setPage(1);
              }}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl border border-slate-700"
              title="Clear Action Filter"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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
                <th className="px-6 py-4">Metadata Payload</th>
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
                    No activity logs recorded matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => openLogInspector(log)}
                    className="hover:bg-slate-800/40 cursor-pointer transition"
                  >
                    <td className="px-6 py-4 font-sans font-semibold">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-sans">
                      <div className="text-slate-200 font-medium">{log.user?.full_name || 'System / Admin'}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{log.user?.email || 'system'}</div>
                    </td>

                    <td className="px-6 py-4 font-sans text-slate-300">
                      {log.business?.name || 'Platform Wide'}
                    </td>

                    <td className="px-6 py-4 text-[11px] text-slate-400 max-w-xs truncate font-mono">
                      {log.metadata ? JSON.stringify(log.metadata) : '-'}
                    </td>

                    <td className="px-6 py-4 text-right text-slate-400 font-sans text-xs">
                      {formatDateTime(log.created_at)}
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
              Showing <span className="font-bold text-white">{totalLogs > 0 ? startRecord : 0}</span> to{' '}
              <span className="font-bold text-white">{endRecord}</span> of{' '}
              <span className="font-bold text-white">{totalLogs}</span> activity logs
            </span>

            <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
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
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
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

      {/* Log Inspector Modal */}
      {inspectModalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Activity Log Inspection
                  </h3>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold border mt-0.5 ${getActionBadgeColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Trigger User</span>
                  <span className="font-semibold text-slate-200">{selectedLog.user?.full_name || 'System / Admin'}</span>
                  <span className="block text-[11px] text-slate-400 font-mono">{selectedLog.user?.email || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Associated Store</span>
                  <span className="font-semibold text-slate-200">{selectedLog.business?.name || 'Platform Wide'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">IP Address</span>
                  <span className="font-mono text-slate-300">{selectedLog.ip_address || '127.0.0.1'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold uppercase">Timestamp</span>
                  <span className="font-mono text-slate-300">{formatDateTime(selectedLog.created_at)}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold block mb-1">Payload & Metadata JSON</span>
                <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-emerald-400 font-mono text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setInspectModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
