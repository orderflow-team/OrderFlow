'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Store,
  Activity,
  Package,
  ShieldAlert,
  Menu,
  X,
  LogOut,
  ArrowLeft,
  Search,
  UserCheck,
  ShoppingCart,
  HeartPulse,
  Bell,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (e) {}
    }
  }, []);

  const navItems = [
    {
      name: 'Overview Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
    },
    {
      name: 'User Control Table',
      href: '/admin/users',
      icon: Users,
      badge: 'All Data',
    },
    {
      name: 'Stores',
      href: '/admin/stores',
      icon: Store,
    },
    {
      name: 'Global Orders Stream',
      href: '/admin/orders',
      icon: ShoppingCart,
    },
    {
      name: 'Global Catalog',
      href: '/admin/products',
      icon: Package,
    },
    {
      name: 'Activity & Audit Logs',
      href: '/admin/activity',
      icon: Activity,
    },
    {
      name: 'System Health & Ping',
      href: '/admin/health',
      icon: HeartPulse,
    },
    {
      name: 'Broadcast Alerts',
      href: '/admin/notifications',
      icon: Bell,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 font-bold text-white text-lg">
              ⚡
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
                OrderFlow
              </span>
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Developer Console
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/50 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Store Dashboard
          </Link>
          <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white uppercase shadow">
              {user?.full_name?.charAt(0) || 'D'}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-slate-200">{user?.full_name || 'Developer Admin'}</div>
              <div className="text-[10px] text-indigo-400 font-mono">{user?.role?.toUpperCase() || 'SUPER_ADMIN'}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-slate-900/90 border-r border-slate-800 p-4 transition-transform duration-200 ease-in-out flex flex-col justify-between ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="space-y-6">
            <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Platform Controls
            </div>
            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/25'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 transition ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'}`} />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-indigo-400'}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/40 flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-indigo-400 flex-shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-slate-200">System Mode</div>
                <div className="text-[10px] text-slate-400">Full SuperAdmin Permissions</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
