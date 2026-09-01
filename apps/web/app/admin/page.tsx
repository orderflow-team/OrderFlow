'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  ShoppingCart,
  TrendingUp,
  Activity,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  Zap,
  HeartPulse,
  Bell,
  FileSpreadsheet,
  Cpu,
  Clock,
  CheckCircle,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function AdminOverviewDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [recentSignups, setRecentSignups] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const [resOverview, resHealth] = await Promise.all([
        apiClient.get('/api/platform-admin/overview'),
        apiClient.get('/api/platform-admin/health').catch(() => null),
      ]);

      setStats(resOverview.data.stats);
      setRecentSignups(resOverview.data.recentSignups || []);
      setRecentActivities(resOverview.data.recentActivities || []);
      if (resHealth) setHealth(resHealth.data);
    } catch (err) {
      console.error('Failed to load overview metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const statCards = [
    {
      title: 'Total Registered Users',
      value: loading ? '...' : (stats?.totalUsers ?? 0),
      subtext: loading ? 'Fetching system telemetry...' : `${stats?.activeUsers ?? 0} Active Users`,
      icon: Users,
      color: 'from-blue-600 to-sky-500',
      href: '/admin/users',
    },
    {
      title: 'Total Registered Stores',
      value: loading ? '...' : (stats?.totalStores ?? 0),
      subtext: loading ? 'Fetching system telemetry...' : `${stats?.activeStores ?? 0} Active Stores`,
      icon: Store,
      color: 'from-purple-600 to-pink-600',
      href: '/admin/stores',
    },
    {
      title: 'Global Catalog Products',
      value: loading ? '...' : (stats?.totalProducts ?? 0),
      subtext: 'Across all tenant stores',
      icon: Package,
      color: 'from-emerald-600 to-teal-600',
      href: '/admin/products',
    },
    {
      title: 'Gross Platform Orders',
      value: loading ? '...' : (stats?.totalOrders ?? 0),
      subtext: loading ? 'Fetching financial volume...' : `₹${(stats?.totalRevenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Gross Volume`,
      icon: ShoppingCart,
      color: 'from-amber-600 to-orange-600',
      href: '/admin/orders',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-500/10 via-card to-card border border-border p-6 rounded-2xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
            <Zap className="w-4 h-4" /> OBIX Developer Engine
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Platform Developer Overview
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time multi-tenant telemetry, user data management controls, and system activity logs.
          </p>
        </div>

        <button
          onClick={fetchOverview}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground text-sm font-semibold rounded-xl border border-border transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              href={card.href}
              className="group p-5 bg-card hover:bg-accent border border-border hover:border-blue-500/40 rounded-2xl transition duration-200 shadow-lg relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${card.color} flex items-center justify-center text-white shadow-lg`}>
                  <Icon className="w-5 h-5" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition" />
              </div>
              <div className="text-3xl font-extrabold text-foreground tracking-tight mb-1">
                {loading ? '...' : card.value.toLocaleString()}
              </div>
              <div className="text-xs font-semibold text-foreground">{card.title}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{card.subtext}</div>
            </Link>
          );
        })}
      </div>

      {/* 📈 SaaS Revenue & Subscription Analytics Panel */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 text-white border border-indigo-700/40 p-6 rounded-3xl shadow-xl space-y-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-indigo-800/60 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest">
              <TrendingUp className="w-4 h-4" /> SaaS Subscription Telemetry
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight mt-0.5">
              MRR, ARR & Subscriber Metrics
            </h2>
          </div>
          <span className="bg-indigo-700/60 text-indigo-200 px-3 py-1 rounded-full text-xs font-bold border border-indigo-600/50">
            Conversion Rate: {loading ? '...' : `${stats?.conversionRate ?? 0}%`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <p className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Monthly Recurring Revenue (MRR)</p>
            <p className="text-3xl font-extrabold text-white mt-1">
              ₹{loading ? '...' : (stats?.mrr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-indigo-200 mt-1">Active paid subscriptions</p>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Annualized Run Rate (ARR)</p>
            <p className="text-3xl font-extrabold text-emerald-400 mt-1">
              ₹{loading ? '...' : (stats?.arr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-emerald-200 mt-1">Projected annual volume</p>
          </div>

          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Subscription & Free Trial Status</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="bg-sky-500/20 text-sky-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-sky-500/40">
                ✨ Free Trialing: {stats?.subscriptions?.trialing ?? 0}
              </span>
              <span className="bg-rose-500/20 text-rose-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-rose-500/40">
                ⚠️ Trial Expired: {stats?.subscriptions?.expired ?? 0}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-500/40">
                ✅ Active Paid: {stats?.subscriptions?.active ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Developer Action Shortcuts */}
      <div className="bg-card border border-border p-5 rounded-2xl space-y-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Platform Developer Shortcuts
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/admin/users"
            className="p-3 bg-muted hover:bg-blue-950/40 border border-border hover:border-blue-500/40 rounded-xl transition text-center group"
          >
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 mx-auto mb-1 group-hover:scale-110 transition" />
            <span className="text-xs font-semibold text-foreground block">User Control</span>
          </Link>

          <Link
            href="/admin/stores"
            className="p-3 bg-muted hover:bg-purple-950/40 border border-border hover:border-purple-500/40 rounded-xl transition text-center group"
          >
            <Store className="w-5 h-5 text-purple-600 dark:text-purple-400 mx-auto mb-1 group-hover:scale-110 transition" />
            <span className="text-xs font-semibold text-foreground block">Manage Stores</span>
          </Link>

          <Link
            href="/admin/orders"
            className="p-3 bg-muted hover:bg-emerald-950/40 border border-border hover:border-emerald-500/40 rounded-xl transition text-center group"
          >
            <ShoppingCart className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-1 group-hover:scale-110 transition" />
            <span className="text-xs font-semibold text-foreground block">Live Orders</span>
          </Link>

          <Link
            href="/admin/products"
            className="p-3 bg-muted hover:bg-teal-950/40 border border-border hover:border-teal-500/40 rounded-xl transition text-center group"
          >
            <Package className="w-5 h-5 text-teal-600 dark:text-teal-400 mx-auto mb-1 group-hover:scale-110 transition" />
            <span className="text-xs font-semibold text-foreground block">Global Catalog</span>
          </Link>

          <Link
            href="/admin/health"
            className="p-3 bg-muted hover:bg-rose-950/40 border border-border hover:border-rose-500/40 rounded-xl transition text-center group"
          >
            <HeartPulse className="w-5 h-5 text-rose-600 dark:text-rose-400 mx-auto mb-1 group-hover:scale-110 transition" />
            <span className="text-xs font-semibold text-foreground block">System Health</span>
          </Link>

          <Link
            href="/admin/notifications"
            className="p-3 bg-muted hover:bg-amber-950/40 border border-border hover:border-amber-500/40 rounded-xl transition text-center group"
          >
            <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400 mx-auto mb-1 group-hover:scale-110 transition" />
            <span className="text-xs font-semibold text-foreground block">Broadcast Alert</span>
          </Link>
        </div>
      </div>

      {/* Mini System Health Summary Bar */}
      {health && (
        <div className="bg-card border border-border p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                System Telemetry: <span className="text-emerald-600 dark:text-emerald-400">{health.status}</span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                <span>PostgreSQL Latency: <strong className="text-blue-600 dark:text-blue-400 font-mono">{health.database.latencyMs} ms</strong></span>
                <span>Heap Used: <strong className="text-foreground font-mono">{health.system.memoryUsage.heapUsedMb} MB</strong></span>
              </div>
            </div>
          </div>

          <Link
            href="/admin/health"
            className="px-4 py-2 bg-secondary hover:bg-accent text-foreground text-xs font-semibold rounded-xl border border-border transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <HeartPulse className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Full System Health
          </Link>
        </div>
      )}

      {/* Tables Row: Recent Signups & System Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Registered Users */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-bold text-foreground text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Recent User Signups
            </h3>
            <Link href="/admin/users" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {recentSignups.length === 0 ? (
              <div className="text-muted-foreground text-xs text-center py-6">No recent signups found</div>
            ) : (
              recentSignups.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-xl border border-border hover:border-border transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-xs text-blue-600 dark:text-blue-400">
                      {u.full_name?.charAt(0) || u.email?.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">{u.full_name || 'Unnamed'}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{u.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 capitalize">
                      {u.role?.replace('_', ' ')}
                    </span>
                    <div className="text-[10px] text-muted-foreground mt-1">{u.business_name}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit Logs */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="font-bold text-foreground text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Live Audit & Activity Logs
            </h3>
            <Link href="/admin/activity" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
              View All Logs
            </Link>
          </div>

          <div className="space-y-3">
            {recentActivities.length === 0 ? (
              <div className="text-muted-foreground text-xs text-center py-6">No recent activity logs recorded</div>
            ) : (
              recentActivities.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-xl border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">{log.action}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {log.user?.full_name || log.user?.email || 'System / Admin'}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
