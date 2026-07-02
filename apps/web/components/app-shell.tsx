'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  MoreHorizontal,
  Warehouse,
  UtensilsCrossed,
  UserRound,
  Receipt,
  BarChart3,
  LogOut,
  X,
  Bell,
  ChevronDown,
  Store,
  Plus,
  Check,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { getCurrentUser, getCachedBusinessCategory, setCachedBusinessCategory } from '@/lib/auth';
import { getOptionalModulesForCategory, OptionalModule } from '@/lib/business-modules';
import { ChatOrderWidget } from '@/components/chat-order-widget';

const CORE_PRIMARY_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/products', label: 'Products', icon: Package },
];

const CORE_MORE_NAV = [
  { href: '/billing', label: 'Billing', icon: Receipt },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
];

const OPTIONAL_NAV: Record<OptionalModule, { href: string; label: string; icon: typeof Warehouse }> = {
  inventory: { href: '/inventory', label: 'Inventory', icon: Warehouse },
  restaurant: { href: '/restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  salesman: { href: '/salesman', label: 'Salesman', icon: UserRound },
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const NAV_TINTS = [
  { chip: 'bg-tile-peach/50', fg: 'text-tile-peach-fg', activeBg: 'bg-tile-peach/40', ring: 'ring-tile-peach-fg/25' },
  { chip: 'bg-tile-lavender/50', fg: 'text-tile-lavender-fg', activeBg: 'bg-tile-lavender/40', ring: 'ring-tile-lavender-fg/25' },
  { chip: 'bg-tile-sky/50', fg: 'text-tile-sky-fg', activeBg: 'bg-tile-sky/40', ring: 'ring-tile-sky-fg/25' },
  { chip: 'bg-tile-mint/50', fg: 'text-tile-mint-fg', activeBg: 'bg-tile-mint/40', ring: 'ring-tile-mint-fg/25' },
] as const;


interface NotificationItem {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface BusinessOption {
  id: string;
  name: string;
  category: string | null;
}

const NEW_BUSINESS_OPTION = '__new__';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [optionalModules, setOptionalModules] = useState<OptionalModule[] | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [businessName, setBusinessName] = useState<string>('');
  const [businessCategory, setBusinessCategory] = useState<string>('');
  const [myBusinesses, setMyBusinesses] = useState<BusinessOption[]>([]);
  const [switching, setSwitching] = useState(false);
  const [businessMenuOpen, setBusinessMenuOpen] = useState(false);
  const [mobileBusinessMenuOpen, setMobileBusinessMenuOpen] = useState(false);

  // localStorage isn't available during SSR, so getCurrentUser() would return
  // a different value on the server (null) vs. the client's first render
  // (the real id) — a classic hydration mismatch. Reading it inside an effect
  // means the first client render still matches the server (null), and the
  // real value arrives as a normal post-mount update instead.
  const [businessId, setBusinessId] = useState<string | null>(null);
  useEffect(() => {
    setBusinessId(getCurrentUser()?.businessId ?? null);
  }, []);

  useEffect(() => {
    if (!businessId) {
      setOptionalModules(getOptionalModulesForCategory(null));
      return;
    }

    const cached = getCachedBusinessCategory(businessId);
    setOptionalModules(getOptionalModulesForCategory(cached));

    apiClient
      .get<{ name: string; category: string | null }>(`/api/businesses/${businessId}`)
      .then((res) => {
        setBusinessName(res.data.name || '');
        setBusinessCategory(res.data.category || '');
        setCachedBusinessCategory(businessId, res.data.category);
        setOptionalModules(getOptionalModulesForCategory(res.data.category));
      })
      .catch(() => {
        // Keep whatever we had (cached or "show everything") if the lookup fails.
      });
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    apiClient
      .get<BusinessOption[]>('/api/businesses/mine')
      .then((res) => setMyBusinesses(res.data))
      .catch(() => {});
  }, [businessId]);

  const handleSwitchBusiness = (value: string) => {
    setBusinessMenuOpen(false);
    setMobileBusinessMenuOpen(false);
    if (value === NEW_BUSINESS_OPTION) {
      router.push('/select-business');
      return;
    }
    if (value === businessId) return;
    setSwitching(true);
    apiClient
      .post(`/api/businesses/${value}/select`)
      .then((res) => {
        localStorage.setItem('access_token', res.data.access_token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        // Full navigation so every page re-mounts and picks up the new businessId
        window.location.href = '/dashboard';
      })
      .catch(() => setSwitching(false));
  };

  useEffect(() => {
    if (!businessId) return;
    const load = () => {
      apiClient
        .get<NotificationItem[]>('/api/notifications', { params: { businessId, unreadOnly: true } })
        .then((res) => setNotifications(res.data))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [businessId]);

  const markNotificationRead = (id: string) => {
    apiClient.patch(`/api/notifications/${id}/read`, {}, { params: { businessId } }).catch(() => {});
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const moreNav = optionalModules
    ? [...optionalModules.map((m) => OPTIONAL_NAV[m]), ...CORE_MORE_NAV]
    : CORE_MORE_NAV;
    
  const isRestaurant = optionalModules?.includes('restaurant') ?? false;
  
  const allNav = [...CORE_PRIMARY_NAV.map(item => 
    item.href === '/products' && businessCategory === 'restaurant' ? { ...item, label: 'Menu' } : item
  ), ...moreNav];

  // Safety net: if a category-restricted module is hidden, bounce away from its URL.
  useEffect(() => {
    if (!optionalModules) return;
    const hiddenHit = (Object.keys(OPTIONAL_NAV) as OptionalModule[])
      .filter((m) => !optionalModules.includes(m))
      .some((m) => isActive(pathname, OPTIONAL_NAV[m].href));
    if (hiddenHit) {
      router.replace('/dashboard');
    }
  }, [optionalModules, pathname, router]);

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('business_category');
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-50 relative isolate">
      {/* Ambient glass backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-emerald-300/25 blur-3xl" />
        <div className="absolute top-1/3 -left-24 w-72 h-72 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="absolute -bottom-32 right-0 w-96 h-96 rounded-full bg-violet-300/15 blur-3xl" />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-white/60 backdrop-blur-2xl border-r border-white/60 shadow-[8px_0_30px_-20px_rgba(15,23,42,0.25)] flex-col">
        <div className="px-5 py-6 flex flex-col gap-5 border-b border-white/50 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-lg flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/30">
              <ShoppingCart className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-800 tracking-tight">OrderFlow</span>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative ml-auto text-slate-400 hover:text-slate-700 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white">
                  {notifications.length}
                </span>
              )}
            </button>
          </div>
          {businessName && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setBusinessMenuOpen((v) => !v)}
                disabled={switching}
                className={`w-full flex items-center gap-2.5 bg-white/50 hover:bg-white/80 backdrop-blur-md rounded-xl p-3 ring-1 transition-colors disabled:opacity-60 ${
                  businessMenuOpen ? 'ring-emerald-300/70' : 'ring-white/60'
                }`}
              >
                <div className="w-7 h-7 rounded-md bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0">
                  <Store className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold text-slate-800 truncate leading-tight">{businessName}</p>
                  <p className="text-[11px] text-emerald-700 font-bold tracking-wide uppercase truncate">
                    {switching ? 'Switching...' : businessCategory || 'No category'}
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${businessMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {businessMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setBusinessMenuOpen(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-white/80 backdrop-blur-xl ring-1 ring-white/60 rounded-xl p-1.5 shadow-xl shadow-slate-200/60 max-h-72 overflow-y-auto">
                    {myBusinesses.length === 0 && businessId && (
                      <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/50">
                        <Store className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-bold text-slate-800 truncate">{businessName}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wide">{businessCategory || 'No category'}</p>
                        </div>
                        <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      </div>
                    )}
                    {myBusinesses.map((b) => {
                      const active = b.id === businessId;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleSwitchBusiness(b.id)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                            active ? 'bg-emerald-500/10' : 'hover:bg-white/60'
                          }`}
                        >
                          <Store className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-emerald-700' : 'text-slate-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{b.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{b.category || 'No category'}</p>
                          </div>
                          {active && <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                        </button>
                      );
                    })}
                    <div className="my-1 border-t border-white/60" />
                    <button
                      type="button"
                      onClick={() => handleSwitchBusiness(NEW_BUSINESS_OPTION)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-emerald-700 hover:bg-emerald-500/10 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-sm font-bold">Add new business</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {notifOpen && (
          <div className="mx-3 mb-2 bg-white/60 backdrop-blur-md ring-1 ring-white/60 rounded-xl p-3 max-h-64 overflow-y-auto space-y-2">
            {notifications.length === 0 && <p className="text-xs text-slate-400">No new notifications</p>}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
                className="block w-full text-left text-xs text-slate-700 bg-white/70 hover:bg-white rounded-lg p-2 shadow-sm"
              >
                {n.message}
              </button>
            ))}
          </div>
        )}
        <nav className="flex-1 px-3 space-y-1.5 mt-2 overflow-y-auto">
          {allNav.map((item, index) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const tint = NAV_TINTS[index % NAV_TINTS.length];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
                  active
                    ? `${tint.activeBg} backdrop-blur-md ring-1 ${tint.ring} shadow-sm ${tint.fg}`
                    : 'text-slate-600 hover:bg-white/40'
                }`}
              >
                <div
                  className={`${tint.chip} ${tint.fg} backdrop-blur-md w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-[2px_2px_6px_rgba(148,163,184,0.25),-2px_-2px_6px_rgba(255,255,255,0.7)]`}
                >
                  <Icon className="w-4 h-4" strokeWidth={2.25} />
                </div>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-3 m-3 px-3 py-2.5 rounded-2xl text-sm font-bold text-slate-600 hover:bg-rose-500/10 hover:text-rose-600 text-left transition-colors"
        >
          <div className="bg-rose-500/10 text-rose-500 w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4" strokeWidth={2.25} />
          </div>
          Log out
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/60 px-4 py-2 flex flex-col justify-center min-h-[60px]">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-slate-800 tracking-tight">OrderFlow</span>
          <button onClick={logout} className="text-slate-400 hover:text-rose-600 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        {businessName && (
          <button
            onClick={() => setMobileBusinessMenuOpen(true)}
            disabled={switching}
            className="flex items-center gap-1.5 mt-0.5 text-left active:opacity-70 transition-opacity"
          >
            <span className="text-xs font-medium text-slate-700 truncate">{businessName}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider shrink-0">
              {switching ? 'Switching...' : businessCategory}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>
        )}
      </header>

      <main className="flex-1 min-w-0 pt-[60px] pb-16 md:pt-0 md:pb-0">
        <div key={pathname} className="animate-in fade-in duration-150 ease-out">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/70 backdrop-blur-xl border-t border-white/60 flex px-1 py-1">
        {CORE_PRIMARY_NAV.map((item, index) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const label = item.href === '/products' && isRestaurant ? 'Menu' : item.label;
          const tint = NAV_TINTS[index % NAV_TINTS.length];
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 text-xs font-semibold"
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  active
                    ? `${tint.chip} ${tint.fg} shadow-[2px_2px_6px_rgba(148,163,184,0.25),-2px_-2px_6px_rgba(255,255,255,0.7)]`
                    : 'text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              </div>
              <span className={active ? tint.fg : 'text-slate-400'}>{label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 text-xs font-semibold"
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              moreNav.some((item) => isActive(pathname, item.href))
                ? 'bg-slate-900/10 text-slate-700 shadow-[2px_2px_6px_rgba(148,163,184,0.25),-2px_-2px_6px_rgba(255,255,255,0.7)]'
                : 'text-slate-400'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <span className={moreNav.some((item) => isActive(pathname, item.href)) ? 'text-slate-700' : 'text-slate-400'}>
            More
          </span>
        </button>
      </nav>

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4 pb-8 animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-bold text-slate-800">More</span>
              <button onClick={() => setMoreOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {moreNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile "Business" sheet */}
      {mobileBusinessMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileBusinessMenuOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4 pb-8 animate-in slide-in-from-bottom-4 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-bold text-slate-800">Switch Business</span>
              <button onClick={() => setMobileBusinessMenuOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1.5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {myBusinesses.length === 0 && businessId && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <Store className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{businessName}</p>
                    <p className="text-[10px] text-emerald-600 uppercase font-medium">{businessCategory || 'No category'}</p>
                  </div>
                  <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                </div>
              )}
              {myBusinesses.map((b) => {
                const active = b.id === businessId;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setMobileBusinessMenuOpen(false);
                      handleSwitchBusiness(b.id);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                      active ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <Store className={`w-5 h-5 shrink-0 ${active ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${active ? 'text-slate-800' : 'text-slate-700'}`}>{b.name}</p>
                      <p className={`text-[10px] uppercase font-medium ${active ? 'text-emerald-600' : 'text-slate-500'}`}>{b.category || 'No category'}</p>
                    </div>
                    {active && <Check className="w-5 h-5 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
              <div className="my-2 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => {
                  setMobileBusinessMenuOpen(false);
                  handleSwitchBusiness(NEW_BUSINESS_OPTION);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left bg-emerald-50/50 hover:bg-emerald-50 transition-colors text-emerald-600 border border-emerald-100/50"
              >
                <Plus className="w-5 h-5 shrink-0" />
                <span className="text-sm font-bold">Add new business</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <ChatOrderWidget businessId={businessId} businessCategory={businessCategory} />
    </div>
  );
}
