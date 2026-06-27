'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { getCurrentUser, getCachedBusinessCategory, setCachedBusinessCategory } from '@/lib/auth';
import { getOptionalModulesForCategory } from '@/lib/business-modules';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { ShoppingCart, IndianRupee, Clock, AlertTriangle, TrendingUp, Package, Sparkles, CalendarClock } from 'lucide-react';

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

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <Card className="ring-slate-200/70 shadow-sm shadow-slate-200/40 hover:shadow-md transition-all duration-200 overflow-hidden">
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
  const [hasInventory, setHasInventory] = useState(false);

  const handleSeedDemoData = async () => {
    if (!businessId) return;
    if (!confirm('Load demo data into every module? This adds sample customers, products, orders, invoices, etc.')) return;
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
    loadDashboard(user.businessId);

    const cachedCategory = getCachedBusinessCategory(user.businessId);
    if (cachedCategory !== null) {
      setHasInventory(getOptionalModulesForCategory(cachedCategory).includes('inventory'));
    }
    apiClient
      .get<{ category: string | null }>(`/api/businesses/${user.businessId}`)
      .then((res) => {
        setCachedBusinessCategory(user.businessId!, res.data.category);
        setHasInventory(getOptionalModulesForCategory(res.data.category).includes('inventory'));
      })
      .catch(() => {});
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
    <AppShell>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <PageHeader
          title="Dashboard"
          description="Here's what's happening with your business today."
          action={
            <Button onClick={handleSeedDemoData} disabled={seeding} variant="outline" className="gap-1.5">
              <Sparkles className="w-4 h-4" />
              {seeding ? 'Loading demo data...' : 'Load Demo Data'}
            </Button>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          <StatCard icon={ShoppingCart} label="Today's Orders" value={String(data.todaysOrders)} tint="bg-blue-50 text-blue-600" />
          <StatCard icon={IndianRupee} label="Today's Sales" value={formatCurrency(data.todaysSales)} tint="bg-emerald-50 text-emerald-600" />
          <StatCard icon={Clock} label="Pending Orders" value={String(data.pendingOrders)} tint="bg-amber-50 text-amber-600" />
          <StatCard icon={AlertTriangle} label="Pending Payments" value={formatCurrency(data.pendingPaymentsAmount)} tint="bg-rose-50 text-rose-600" />
        </div>

        {hasInventory && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="ring-slate-200/70 shadow-sm shadow-slate-200/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <CardTitle>Low Stock</CardTitle>
                </div>
                <CardDescription>Products at or below 10 units</CardDescription>
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
                            p.stock_quantity === 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
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

            <Card className="ring-slate-200/70 shadow-sm shadow-slate-200/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-amber-600" />
                  <CardTitle>Expiring Soon</CardTitle>
                </div>
                <CardDescription>Products expiring within 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                {data.expiringProducts.length === 0 ? (
                  <p className="text-sm text-slate-400">Nothing expiring soon.</p>
                ) : (
                  <div className="space-y-2">
                    {data.expiringProducts.map((p) => (
                      <div key={p.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                        <p className="text-slate-800">{p.name}</p>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="ring-slate-200/70 shadow-sm shadow-slate-200/40">
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

          <Card className="ring-slate-200/70 shadow-sm shadow-slate-200/40">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />
                <CardTitle>Top Products</CardTitle>
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
      </div>
    </AppShell>
  );
}
