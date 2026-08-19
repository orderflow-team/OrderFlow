'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Store,
  Activity,
  Package,
  ShieldAlert,
  Rocket,
  Link2,
  Menu,
  X,
  LogOut,
  ArrowLeft,
  Search,
  UserCheck,
  ShoppingCart,
  HeartPulse,
  Bell,
  Sun,
  Moon,
  Radio,
} from 'lucide-react';
import { ObixMark } from '@/components/obix-logo';
import { PostLoginUpdateAlert } from '@/components/post-login-update-alert';

const ADMIN_THEME_KEY = 'admin-theme';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  // Admin UI defaults to light regardless of OS preference — only an explicit
  // toggle (persisted per-browser) switches it to dark.
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setUser(u);
        // Matches the backend's @Roles(SUPER_ADMIN) on platform-admin.controller.ts.
        // 'admin' is deliberately NOT allowed here — it's the role every
        // self-signup business owner gets, not a platform-admin role; letting
        // it through used to route shop owners into a panel where every API
        // call now 403s instead of just sending them to their own dashboard.
        if (u.role !== 'super_admin') {
          router.push('/dashboard');
        }
      } catch (e) {}
    }

    const savedTheme = localStorage.getItem(ADMIN_THEME_KEY);
    if (savedTheme === 'dark') {
      setTheme('dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem(ADMIN_THEME_KEY, next);
  };

  const navItems = [
    {
      name: 'Overview Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
    },
    {
      name: 'Manage User',
      href: '/admin/users',
      icon: Users,
    },
    {
      name: 'Live Users',
      href: '/admin/live-users',
      icon: Radio,
    },
    {
      name: 'Stores',
      href: '/admin/stores',
      icon: Store,
    },
    {
      name: 'Business Network',
      href: '/admin/business-connections',
      icon: Link2,
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
      name: 'Broadcast & Maintenance',
      href: '/admin/notifications',
      icon: Bell,
    },
    {
      name: 'App Releases',
      href: '/admin/releases',
      icon: Rocket,
    },
  ];

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-blue-500 selection:text-white`}>
      {/* Top Bar */}
      <header className="h-16 border-b border-border bg-card backdrop-blur-md sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <ObixMark className="w-9 h-9 shrink-0" />
            <div>
              <div>
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
                  OBIX
                </span>
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Developer Console
                </span>
              </div>
              <span className="text-[9px] tracking-[0.12em] text-muted-foreground font-semibold uppercase">Order Billing Inventory eXperience</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="p-2 text-muted-foreground hover:text-foreground bg-secondary hover:bg-accent rounded-lg border border-border transition"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <Link
            href="/dashboard"
            className="hidden sm:flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary hover:bg-accent px-3 py-1.5 rounded-lg border border-border transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Store Dashboard
          </Link>
          <div className="flex items-center gap-3 pl-3 border-l border-border">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center font-bold text-xs text-white uppercase shadow">
              {user?.full_name?.charAt(0) || 'D'}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-foreground">{user?.full_name || 'Developer Admin'}</div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">{user?.role?.toUpperCase() || 'SUPER_ADMIN'}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-card border-r border-border p-4 transition-transform duration-200 ease-in-out flex flex-col justify-between ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className="space-y-6">
            <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
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
                        ? 'bg-gradient-to-r from-blue-600 to-emerald-500 text-white shadow-lg shadow-blue-600/25'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 transition ${isActive ? 'text-white' : 'text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400'}`} />
                      <span>{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="p-3 bg-muted rounded-xl border border-border flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-foreground">System Mode</div>
                <div className="text-[10px] text-muted-foreground">Full SuperAdmin Permissions</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          {children}
        </main>
      </div>
      <PostLoginUpdateAlert />
    </div>
  );
}
