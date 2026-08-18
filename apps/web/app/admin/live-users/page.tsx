'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Radio, RefreshCw, Mail, Store, Shield } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface LiveUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  business_name: string;
  last_active_at: string;
}

const formatAgo = (dateStr: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
};

export default function AdminLiveUsersPage() {
  const [users, setUsers] = useState<LiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState('');
  // Forces the "Xs/m ago" labels to re-render between polls, since last_active_at
  // itself only changes when the next fetch lands.
  const [, setTick] = useState(0);

  const fetchLiveUsers = useCallback(async () => {
    try {
      const res = await apiClient.get<LiveUser[]>('/api/platform-admin/live-users');
      setUsers(res.data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to fetch live users', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveUsers();
    const pollInterval = setInterval(fetchLiveUsers, 10000);
    const tickInterval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(pollInterval);
      clearInterval(tickInterval);
    };
  }, [fetchLiveUsers]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Radio className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            Live Users
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Users with an authenticated request in the last 5 minutes — a recency window, not true logout-aware presence
            (a closed tab still shows here until it ages out).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Last refreshed: <span className="font-mono text-foreground font-bold">{lastRefreshed || '-'}</span>
          </span>
          <button
            onClick={fetchLiveUsers}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground text-sm font-medium rounded-xl border border-border transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Live count KPI */}
      <div className="bg-card border border-border p-6 rounded-2xl backdrop-blur-sm space-y-2 w-full sm:w-64">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active right now</span>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        </div>
        <div className="text-3xl font-extrabold text-foreground">{users.length}</div>
      </div>

      {/* Live users list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted text-xs font-semibold uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Business</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-right">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                    Checking who's active...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    No users currently active.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-accent transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <div>
                          <div className="font-semibold text-foreground">{u.full_name || 'Unnamed User'}</div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      <span className="flex items-center gap-1.5 text-xs">
                        <Store className="w-3.5 h-3.5 text-muted-foreground" /> {u.business_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold capitalize">
                        <Shield className="w-3 h-3" /> {u.role?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatAgo(u.last_active_at)}
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
