'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import apiClient from '@/lib/api-client';
import { getCurrentUser, getCachedBusinessCategory, setCachedBusinessCategory, getCachedInventoryEnabled, setCachedInventoryEnabled, hasRole } from '@/lib/auth';
import { getOptionalModulesForCategory } from '@/lib/business-modules';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { DraftReviewStack } from '@/components/draft-review-stack';
import Link from 'next/link';
import {
  ShoppingCart, IndianRupee, Clock, AlertTriangle, TrendingUp, Package, Sparkles, CalendarClock,
  Users, Receipt, Mic, UserPlus, Plus, Pill, UserRound,
} from 'lucide-react';

interface DashboardData {
  todaysOrders: number;
  todaysSales: number;
  pendingOrders: number;
  deliveredOrders: number;
  pendingPaymentsAmount: number;
  lowStockProducts: Array<{ id: string; name: string; stock_quantity: number }>;
  expiringProducts: Array<{ id: string; name: string; expiry_date: string }>;
  topProducts: Array<{ productId: string; productName: string; totalQuantity: number; totalRevenue: number }>;
  topCustomers: Array<{ customerId: string; customerName: string; orderCount: number; totalSpent: number }>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function getHomeTiles(isPharmacy: boolean, isSalesman: boolean) {
  if (isSalesman) {
    return [
      { href: '/customers', label: 'Clients', icon: Users, bg: 'bg-tile-peach', iconBg: 'bg-tile-peach-icon', fg: 'text-tile-peach-fg' },
      { href: '/orders', label: 'Orders', icon: ShoppingCart, bg: 'bg-tile-sky', iconBg: 'bg-tile-sky-icon', fg: 'text-tile-sky-fg' },
      { href: '/salesman', label: 'Visits', icon: UserRound, bg: 'bg-tile-lavender', iconBg: 'bg-tile-lavender-icon', fg: 'text-tile-lavender-fg' },
    ];
  }
  return [
    { href: '/customers', label: 'Clients', icon: Users, bg: 'bg-tile-peach', iconBg: 'bg-tile-peach-icon', fg: 'text-tile-peach-fg' },
    { href: '/products', label: isPharmacy ? 'Medicines' : 'Products', icon: isPharmacy ? Pill : Package, bg: 'bg-tile-lavender', iconBg: 'bg-tile-lavender-icon', fg: 'text-tile-lavender-fg' },
    { href: '/orders', label: 'Orders', icon: ShoppingCart, bg: 'bg-tile-sky', iconBg: 'bg-tile-sky-icon', fg: 'text-tile-sky-fg' },
    { href: '/billing', label: 'Ledger', icon: Receipt, bg: 'bg-tile-mint', iconBg: 'bg-tile-mint-icon', fg: 'text-tile-mint-fg' },
  ];
}

function HomeTile({ href, label, icon: Icon, bg, iconBg, fg }: ReturnType<typeof getHomeTiles>[number]) {
  return (
    <Link
      href={href}
      className={`${bg} rounded-3xl p-5 flex flex-col items-center justify-center gap-4 aspect-square ring-1 ring-white/70 shadow-[0_10px_25px_-10px_rgba(15,23,42,0.3),inset_0_1px_1px_rgba(255,255,255,0.6)] hover:brightness-[0.98] active:scale-[0.98] transition-all duration-150`}
    >
      <div className={`${iconBg} ${fg} w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm`}>
        <Icon className="w-7 h-7" strokeWidth={2.25} />
      </div>
      <span className="font-bold tracking-wide text-slate-800 uppercase text-sm">{label}</span>
    </Link>
  );
}

function getQuickActions(isPharmacy: boolean, isSalesman: boolean) {
  return [
    {
      href: '/orders?new=1',
      title: 'New Order',
      subtitle: 'Record a sale',
      icon: Plus,
      iconBg: 'bg-tile-peach-icon',
      iconFg: 'text-tile-peach-fg',
      micBg: 'bg-accent-orange',
      onMic: () => window.dispatchEvent(new CustomEvent('open-order-assistant')),
    },
    isSalesman
      ? {
          href: '/salesman',
          title: 'Log Visit',
          subtitle: 'Check in at a shop',
          icon: UserRound,
          iconBg: 'bg-tile-lavender-icon',
          iconFg: 'text-tile-lavender-fg',
          micBg: 'bg-tile-lavender-fg',
        }
      : {
          href: '/products?new=1',
          title: isPharmacy ? 'Add Medicine' : 'Add Product',
          subtitle: isPharmacy ? 'Add to pharmacy stock' : 'Add to inventory',
          icon: isPharmacy ? Pill : Package,
          iconBg: 'bg-tile-lavender-icon',
          iconFg: 'text-tile-lavender-fg',
          micBg: 'bg-tile-lavender-fg',
        },
    {
      href: '/customers?new=1',
      title: 'Add Client',
      subtitle: 'Register shop owner',
      icon: UserPlus,
      iconBg: 'bg-tile-sky-icon',
      iconFg: 'text-tile-sky-fg',
      micBg: 'bg-tile-sky-fg',
    },
  ] as const;
}

function QuickActionRow({ action }: { action: ReturnType<typeof getQuickActions>[number] }) {
  const Icon = action.icon;
  return (
    <div className="flex items-center gap-3 bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm p-3.5">
      <Link href={action.href} className="flex-1 flex items-center gap-3 min-w-0">
        <div className={`${action.iconBg} ${action.iconFg} w-11 h-11 rounded-xl flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{action.title}</p>
          <p className="text-xs text-slate-400 uppercase tracking-wide truncate">{action.subtitle}</p>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => {
          if ('onMic' in action) action.onMic();
        }}
        className={`${action.micBg} w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 hover:brightness-95 active:scale-95 transition-all`}
        aria-label={`Voice ${action.title}`}
      >
        <Mic className="w-5 h-5" />
      </button>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
  href,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: string;
  tint: string;
  href?: string;
}) {
  const cardContent = (
    <CardContent className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs sm:text-sm font-medium text-slate-500 truncate mr-2">{label}</p>
        <div className={`p-1.5 sm:p-2 rounded-lg ${tint} shrink-0`}>
          <Icon className="w-4 h-4 sm:w-4 sm:h-4" />
        </div>
      </div>
      <div className="mt-3 sm:mt-4">
        <p className="text-xl sm:text-2xl font-bold text-slate-800 truncate tracking-tight">{value}</p>
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href} className="block group">
        <Card className="ring-white/50 glass-sheen-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer hover:scale-[1.01] active:scale-[0.99]">
          {cardContent}
        </Card>
      </Link>
    );
  }

  return (
    <Card className="ring-white/50 glass-sheen-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      {cardContent}
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [hasInventory, setHasInventory] = useState(false);
  const [isPharmacy, setIsPharmacy] = useState(false);
  const [isSalesman, setIsSalesman] = useState(false);

  const handleSeedDemoData = async () => {
    if (!businessId) return;
    setShowSeedConfirm(false);
    setSeeding(true);
    try {
      await apiClient.post('/api/dev/seed', {}, { params: { businessId } });
      await loadDashboard(businessId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to seed demo data');
    } finally {
      setSeeding(false);
    }
  };

  const loadDashboard = async (bizId: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get<DashboardData>('/api/reports/dashboard', {
        params: { businessId: bizId },
      });
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const refreshDashboardSilently = async (bizId: string) => {
    try {
      const response = await apiClient.get<DashboardData>('/api/reports/dashboard', {
        params: { businessId: bizId },
      });
      setData(response.data);
    } catch (err) {
      console.error('Silent dashboard refresh failed', err);
    }
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }

    const user = getCurrentUser();
    if (!user?.businessId) {
      router.push('/select-business');
      return;
    }

    setBusinessId(user.businessId);
    setIsSalesman(hasRole('salesman'));
    loadDashboard(user.businessId);

    // Setup periodic polling to track order count changes
    const interval = setInterval(() => {
      if (user.businessId) {
        refreshDashboardSilently(user.businessId);
      }
    }, 5000);

    // Setup event listener to catch instant order mutations from modals/chat assistant
    const handleOrderUpdate = () => {
      if (user.businessId) {
        refreshDashboardSilently(user.businessId);
      }
    };
    window.addEventListener('order-updated', handleOrderUpdate);

    const cachedCategory = getCachedBusinessCategory(user.businessId);
    const cachedInventoryEnabled = getCachedInventoryEnabled(user.businessId);
    if (cachedCategory !== null) {
      setHasInventory(getOptionalModulesForCategory(cachedCategory, cachedInventoryEnabled ?? undefined).includes('inventory'));
      setIsPharmacy(cachedCategory === 'pharmacy');
    }
    apiClient
      .get<{ category: string | null; inventory_enabled: boolean }>(`/api/businesses/${user.businessId}`)
      .then((res) => {
        setCachedBusinessCategory(user.businessId!, res.data.category);
        setCachedInventoryEnabled(user.businessId!, res.data.inventory_enabled);
        setHasInventory(getOptionalModulesForCategory(res.data.category, res.data.inventory_enabled).includes('inventory'));
        setIsPharmacy(res.data.category === 'pharmacy');
      })
      .catch(() => {});

    return () => {
      clearInterval(interval);
      window.removeEventListener('order-updated', handleOrderUpdate);
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  if (!businessId) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-rose-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <>
    <AppShell>
      <div className="p-4 md:p-10 max-w-7xl mx-auto space-y-6 md:space-y-8">
        <PageHeader
          title="Dashboard"
          description="Here's what's happening with your business today."
          action={
            !isSalesman && (
              <Button
                onClick={() => setShowSeedConfirm(true)}
                disabled={seeding}
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white shadow-[0_4px_14px_-2px_rgba(251,146,60,0.5)] ring-1 ring-white/30"
              >
                <Sparkles className="w-4 h-4" />
                <span className="sm:hidden">{seeding ? 'Loading...' : 'Load Data'}</span>
                <span className="hidden sm:inline">{seeding ? 'Loading demo data...' : 'Load Demo Data'}</span>
              </Button>
            )
          }
        />

        <DraftReviewStack businessId={businessId} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-md lg:max-w-none">
          {getHomeTiles(isPharmacy, isSalesman).map((tile) => (
            <HomeTile key={tile.href} {...tile} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {getQuickActions(isPharmacy, isSalesman).map((action) => (
            <QuickActionRow key={action.href} action={action} />
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          <StatCard icon={ShoppingCart} label="Today's Orders" value={String(data.todaysOrders)} tint="bg-tile-sky-icon text-tile-sky-fg" href="/orders" />
          <StatCard icon={IndianRupee} label="Today's Sales" value={formatCurrency(data.todaysSales)} tint="bg-tile-mint-icon text-tile-mint-fg" />
          <StatCard icon={Clock} label="Pending Orders" value={String(data.pendingOrders)} tint="bg-tile-peach-icon text-tile-peach-fg" href="/billing" />
          <StatCard icon={AlertTriangle} label="Pending Payments" value={formatCurrency(data.pendingPaymentsAmount)} tint="bg-tile-lavender-icon text-tile-lavender-fg" href="/billing" />
        </div>

        {hasInventory && !isSalesman && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <CardTitle>{isPharmacy ? 'Low Stock Medicines' : 'Low Stock'}</CardTitle>
                </div>
                <CardDescription>{isPharmacy ? 'Medicines at or below 10 units' : 'Products at or below 10 units'}</CardDescription>
              </CardHeader>
              <CardContent>
                {data.lowStockProducts.length === 0 ? (
                  <p className="text-sm text-slate-400">Nothing low on stock.</p>
                ) : (
                  <div className="space-y-2">
                    {data.lowStockProducts.map((p) => (
                      <div key={p.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                        <p className="text-slate-800">{p.name}</p>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            p.stock_quantity === 0 ? 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20' : 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20'
                          }`}
                        >
                          {p.stock_quantity} left
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-amber-600" />
                  <CardTitle>{isPharmacy ? 'Medicines Expiring Soon' : 'Expiring Soon'}</CardTitle>
                </div>
                <CardDescription>{isPharmacy ? 'Batches expiring within 30 days' : 'Products expiring within 30 days'}</CardDescription>
              </CardHeader>
              <CardContent>
                {data.expiringProducts.length === 0 ? (
                  <p className="text-sm text-slate-400">Nothing expiring soon.</p>
                ) : (
                  <div className="space-y-2">
                    {data.expiringProducts.map((p) => (
                      <div key={p.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                        <p className="text-slate-800">{p.name}</p>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20">
                          {new Date(p.expiry_date).toLocaleDateString([], { month: 'short', day: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {!isSalesman && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="ring-white/50 glass-sheen-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <CardTitle>Top Customers</CardTitle>
              </div>
              <CardDescription>Highest spend in this business</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topCustomers.length === 0 ? (
                <p className="text-sm text-slate-400">No orders yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.topCustomers.map((c) => (
                    <div key={c.customerId} className="flex justify-between items-center text-sm">
                      <div>
                        <p className="font-medium text-slate-800">{c.customerName}</p>
                        <p className="text-slate-400">{c.orderCount} orders</p>
                      </div>
                      <p className="font-semibold text-slate-800">{formatCurrency(c.totalSpent)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="ring-white/50 glass-sheen-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                {isPharmacy ? <Pill className="w-4 h-4 text-emerald-600" /> : <Package className="w-4 h-4 text-emerald-600" />}
                <CardTitle>{isPharmacy ? 'Top Selling Medicines' : 'Top Products'}</CardTitle>
              </div>
              <CardDescription>By quantity sold</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-slate-400">No orders yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.topProducts.map((p) => (
                    <div key={p.productId} className="flex justify-between items-center text-sm">
                      <p className="font-medium text-slate-800">{p.productName}</p>
                      <div className="text-right">
                        <p className="font-medium text-slate-800">{p.totalQuantity} units</p>
                        <p className="text-slate-400">{formatCurrency(p.totalRevenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        )}
      </div>
    </AppShell>

    <Dialog open={showSeedConfirm} onOpenChange={setShowSeedConfirm}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Sparkles className="w-4 h-4 text-amber-500" /> Load Demo Data?
          </DialogTitle>
          <DialogDescription>
            This adds sample customers, products, orders, and invoices to <strong>this business</strong>.
            It&apos;s safe to run more than once — it only fills in whatever&apos;s missing and won&apos;t
            create duplicate catalog items or a second round of demo orders.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setShowSeedConfirm(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSeedDemoData}
            disabled={seeding}
            className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white"
          >
            {seeding ? 'Loading...' : 'Load Demo Data'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
