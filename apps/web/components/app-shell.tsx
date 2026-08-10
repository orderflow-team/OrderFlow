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
  Settings,
  UserCog,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import apiClient, { toAbsoluteFileUrl } from '@/lib/api-client';
import { setCached } from '@/lib/offline-db';
import { useOfflineStore, useOfflineSync } from '@/lib/offline-store';
import { getCurrentUser, getCachedBusinessCategory, setCachedBusinessCategory, getCachedInventoryEnabled, setCachedInventoryEnabled, getCachedChatEnabled, setCachedChatEnabled, hasRole } from '@/lib/auth';
import { getOptionalModulesForCategory, getBusinessTerminology, CustomBusinessSettings, OptionalModule } from '@/lib/business-modules';
import { ChatOrderWidget } from '@/components/chat-order-widget';
import { PostLoginUpdateAlert } from '@/components/post-login-update-alert';
import { ObixMark } from '@/components/obix-logo';

const CORE_PRIMARY_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/products', label: 'Products', icon: Package },
];

const CORE_MORE_NAV = [
  { href: '/billing', label: 'Billing', icon: Receipt },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const BILLING_NAV = CORE_MORE_NAV[0];
const REPORTS_NAV = CORE_MORE_NAV[1];
const STAFF_NAV = { href: '/staff', label: 'Staff', icon: UserCog };

const OPTIONAL_NAV: Record<OptionalModule, { href: string; label: string; icon: typeof Warehouse }> = {
  inventory: { href: '/inventory', label: 'Inventory', icon: Warehouse },
  restaurant: { href: '/restaurant', label: 'Kitchen', icon: UtensilsCrossed },
  salesman: { href: '/salesman', label: 'Salesman', icon: UserRound },
  expenses: { href: '/billing', label: 'Purchases', icon: Receipt },
  staff: { href: '/staff', label: 'Staff', icon: UserCog },
  loyalty: { href: '/customers', label: 'Loyalty', icon: Users },
  attendance: { href: '/staff', label: 'Attendance', icon: UserCog },
  commissions: { href: '/staff', label: 'Commissions', icon: UserCog },
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Human-readable badge for whichever login is active — lets anyone glance at the header and tell which staff account is signed in. */
const ROLE_BADGE: Record<string, string> = {
  admin: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
  waiter: 'Waiter',
  kitchen_staff: 'Cook',
  delivery_person: 'Delivery',
  accountant: 'Accountant',
  salesman: 'Salesman',
  guest: 'Guest',
};

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
  logo_url: string | null;
}

const NEW_BUSINESS_OPTION = '__new__';

/** Business icon: the uploaded logo when set, otherwise the generic store glyph. */
function BusinessAvatar({ logoUrl, size, active }: { logoUrl?: string | null; size: string; active?: boolean }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={toAbsoluteFileUrl(logoUrl) ?? undefined} alt="" className={`${size} rounded-full object-cover shrink-0 bg-white ring-1 ring-slate-200/70`} />;
  }
  return <Store className={`${size} shrink-0 ${active ? 'text-sky-700' : 'text-slate-400'}`} />;
}

export function AppShell({ children, hideNavigation = false }: { children: React.ReactNode; hideNavigation?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [optionalModules, setOptionalModules] = useState<OptionalModule[] | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [businessName, setBusinessName] = useState<string>('');
  const [businessCategory, setBusinessCategory] = useState<string>('');
  const [businessLogoUrl, setBusinessLogoUrl] = useState<string | null>(null);
  const [customSettings, setCustomSettings] = useState<CustomBusinessSettings | null>(null);
  const [myBusinesses, setMyBusinesses] = useState<BusinessOption[]>([]);
  const [switching, setSwitching] = useState(false);
  const [businessMenuOpen, setBusinessMenuOpen] = useState(false);
  const [mobileBusinessMenuOpen, setMobileBusinessMenuOpen] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);

  // localStorage isn't available during SSR, so getCurrentUser() would return
  // a different value on the server (null) vs. the client's first render
  // (the real id) — a classic hydration mismatch. Reading it inside an effect
  // means the first client render still matches the server (null), and the
  // real value arrives as a normal post-mount update instead.
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isSalesmanRole, setIsSalesmanRole] = useState(false);
  const [isCookRole, setIsCookRole] = useState(false);
  const [isCashierRole, setIsCashierRole] = useState(false);
  const [isWaiterRole, setIsWaiterRole] = useState(false);
  const [isAccountantRole, setIsAccountantRole] = useState(false);
  const [isDeliveryRole, setIsDeliveryRole] = useState(false);
  // Tri-state (null = "not yet resolved") rather than a plain boolean: these
  // gate "redirect away if NOT allowed" effects below, and a false default
  // would bounce a legitimate admin/manager away for the one tick before
  // hasRole() resolves on mount.
  const [canManageStaff, setCanManageStaff] = useState<boolean | null>(null);
  const [canViewReports, setCanViewReports] = useState<boolean | null>(null);
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }
    setBusinessId(getCurrentUser()?.businessId ?? null);
    setIsSalesmanRole(hasRole('salesman'));
    setIsCookRole(hasRole('kitchen_staff'));
    setIsCashierRole(hasRole('cashier'));
    setIsWaiterRole(hasRole('waiter'));
    setIsAccountantRole(hasRole('accountant'));
    setIsDeliveryRole(hasRole('delivery_person'));
    const role = getCurrentUser()?.role || 'owner';
    setUserRole(role);
    setCanManageStaff(hasRole('admin', 'manager', 'super_admin'));
    setCanViewReports(hasRole('admin', 'manager', 'accountant', 'super_admin'));
  }, []);

  useOfflineSync(businessId);
  const isOnline = useOfflineStore((s) => s.isOnline);
  const pendingCount = useOfflineStore((s) => s.pendingCount);
  const syncing = useOfflineStore((s) => s.syncing);
  const syncNow = useOfflineStore((s) => s.syncNow);

  useEffect(() => {
    if (!businessId) {
      // Leave optionalModules at its initial `null` rather than setting the
      // no-category fallback here — the "hiddenHit" safety net below treats
      // null as "not resolved yet" and skips, but a concrete (salesman/restaurant/
      // inventory-less) fallback would make it fire and bounce the user to
      // /dashboard before the real, businessId-aware modules list loads just
      // a render later.
      setChatEnabled(true);
      return;
    }

    const cached = getCachedBusinessCategory(businessId);
    const cachedInventoryEnabled = getCachedInventoryEnabled(businessId);
    const cachedChatEnabled = getCachedChatEnabled(businessId);
    setOptionalModules(getOptionalModulesForCategory(cached, cachedInventoryEnabled ?? undefined));
    setChatEnabled(cachedChatEnabled ?? true);

    apiClient
      .get<{ name: string; category: string | null; logo_url: string | null; upi_qr_url?: string | null; inventory_enabled: boolean; ai_chat_enabled?: boolean; address?: string | null; phone?: string | null; gst_number?: string | null; custom_settings?: CustomBusinessSettings }>(`/api/businesses/${businessId}`)
      .then((res) => {
        setBusinessName(res.data.name || '');
        setBusinessCategory(res.data.category || '');
        setBusinessLogoUrl(res.data.logo_url || null);
        setCustomSettings(res.data.custom_settings || null);
        const isChatEnabled = res.data.ai_chat_enabled !== false && res.data.custom_settings?.modules?.ai_assistant !== false;
        setCachedChatEnabled(businessId, isChatEnabled);
        setChatEnabled(isChatEnabled);
        setOptionalModules(getOptionalModulesForCategory(res.data.category, res.data.inventory_enabled, res.data.custom_settings));
        // Cached so the client-side receipt renderer can print a business
        // header (name/address/GSTIN/logo/UPI QR) even with zero network.
        setCached(businessId, 'business-profile', {
          name: res.data.name,
          address: res.data.address,
          phone: res.data.phone,
          gst_number: res.data.gst_number,
          logo_url: res.data.logo_url,
          upi_qr_url: res.data.upi_qr_url,
          custom_settings: res.data.custom_settings,
        });
      })
      .catch(() => {
        // Keep whatever we had (cached or "show everything") if the lookup fails.
      });
  }, [businessId]);

  const [broadcastAnnouncement, setBroadcastAnnouncement] = useState<any>(null);
  const [dismissedAlert, setDismissedAlert] = useState(false);

  useEffect(() => {
    apiClient
      .get('/api/platform-admin/announcement')
      .then((res) => {
        if (res.data?.active) {
          setBroadcastAnnouncement(res.data);
        }
      })
      .catch(() => {});
  }, []);

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
        // Full navigation so every page re-mounts and picks up the new businessId.
        // Target "/" (not "/dashboard" directly) — Capacitor's local WebViewAssetLoader
        // only reliably resolves the root path for a hard navigation; root page.tsx's
        // own logic then client-side-routes to the right destination once it loads.
        window.location.href = '/';
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

  // A salesman logs into the SAME business as the owner (products/customers
  // are literally the same rows — no sync needed) but only gets a working
  // slice of the app: placing orders and logging visits, not admin tools.
  // A cook gets even less — nothing but the KOT screen, no dashboard even.
  // Cashier/waiter/accountant/delivery person are similarly restricted to
  // the one or two pages their backend @Roles() guards actually let them hit
  // — all of which are already folded into primaryNavBase below, so moreNav
  // stays empty for them (nothing left to put in a "More" sheet).
  const moreNav = (isSalesmanRole || isCookRole || isWaiterRole || isDeliveryRole || isCashierRole || isAccountantRole)
    ? []
    : optionalModules
      ? [...optionalModules.map((m) => OPTIONAL_NAV[m]), ...CORE_MORE_NAV, ...(canManageStaff ? [STAFF_NAV] : [])]
      : [...CORE_MORE_NAV, ...(canManageStaff ? [STAFF_NAV] : [])];

  const terminology = getBusinessTerminology(customSettings);

  const primaryNavBase = isCookRole
    ? [{ ...OPTIONAL_NAV.restaurant, label: 'KOTs' }]
    : isWaiterRole
      ? [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }, { href: '/orders', label: terminology.ordersLabel, icon: ShoppingCart }, { ...OPTIONAL_NAV.restaurant, label: 'Tables' }]
      : isSalesmanRole
        ? [
            { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/orders', label: terminology.ordersLabel, icon: ShoppingCart },
            { href: '/customers', label: terminology.customersLabel, icon: Users },
            OPTIONAL_NAV.salesman,
          ]
        : isCashierRole
          ? [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }, { href: '/orders', label: terminology.ordersLabel, icon: ShoppingCart }, BILLING_NAV]
          : isAccountantRole
            ? [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }, REPORTS_NAV, BILLING_NAV]
            : isDeliveryRole
              ? [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }, { href: '/orders', label: terminology.ordersLabel, icon: ShoppingCart }]
              : [
                  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                  { href: '/orders', label: terminology.ordersLabel, icon: ShoppingCart },
                  { href: '/customers', label: terminology.customersLabel, icon: Users },
                  { href: '/products', label: terminology.productsLabel, icon: Package },
                ];

  const rawAllNav = [
    ...primaryNavBase.map((item) => {
      if (item.href === '/products') {
        if (customSettings?.terminology?.productsLabel) return { ...item, label: customSettings.terminology.productsLabel };
        if (businessCategory === 'restaurant') return { ...item, label: 'Menu' };
        if (businessCategory === 'pharmacy') return { ...item, label: 'Medicines' };
      }
      if (item.href === '/orders' && customSettings?.terminology?.ordersLabel) {
        return { ...item, label: customSettings.terminology.ordersLabel };
      }
      if (item.href === '/customers' && customSettings?.terminology?.customersLabel) {
        return { ...item, label: customSettings.terminology.customersLabel };
      }
      return item;
    }),
    ...moreNav.map((item) => {
      if (item.href === '/staff' && customSettings?.terminology?.staffLabel) {
        return { ...item, label: customSettings.terminology.staffLabel };
      }
      if (item.href === '/salesman') {
        if (customSettings?.terminology?.staffLabel) {
          return { ...item, label: `${customSettings.terminology.staffLabel} Field` };
        }
        return { ...item, label: 'Field Mode' };
      }
      return item;
    }),
  ];

  // Strictly filter and deduplicate navigation items according to customSettings.modules for all 12 modules
  const seenHrefs = new Set<string>();
  const allNav = rawAllNav.filter((item) => {
    if (!item?.href) return false;

    if (customSettings?.modules) {
      if (item.href === '/products' && customSettings.modules.products === false) return false;
      if (item.href === '/orders' && customSettings.modules.orders === false) return false;
      if (item.href === '/billing' && customSettings.modules.billing === false && customSettings.modules.expenses === false) return false;
      if (item.href === '/reports' && customSettings.modules.reports === false) return false;
      if (item.href === '/staff' && customSettings.modules.staff === false) return false;
      if (item.href === '/restaurant' && customSettings.modules.restaurant === false) return false;
      if (item.href === '/salesman' && customSettings.modules.salesman === false) return false;
      if (item.href === '/inventory' && customSettings.modules.inventory === false) return false;
    }

    if (seenHrefs.has(item.href)) {
      return false;
    }
    seenHrefs.add(item.href);
    return true;
  });

  // Safety net: if a standalone optional module is hidden, bounce away from its URL.
  useEffect(() => {
    if (!optionalModules) return;
    const standaloneModules: OptionalModule[] = ['inventory', 'restaurant', 'salesman'];
    const hiddenHit = standaloneModules
      .filter((m) => !optionalModules.includes(m))
      .some((m) => isActive(pathname, OPTIONAL_NAV[m].href));
    if (hiddenHit) {
      router.replace('/dashboard');
    }
  }, [optionalModules, pathname, router]);

  // Safety net: a salesman-role user has no admin tools — bounce away from
  // Products/Billing/Reports/Inventory even if they hit the URL directly.
  // Exception: a single invoice's own page (/billing/invoices/:id) is where the
  // Orders drawer sends them to print/share it — same page every other role uses.
  useEffect(() => {
    if (!isSalesmanRole) return;
    if (pathname.startsWith('/billing/invoices/')) return;
    const adminOnlyPaths = ['/products', '/billing', '/reports', '/inventory'];
    if (adminOnlyPaths.some((p) => isActive(pathname, p))) {
      router.replace('/dashboard');
    }
  }, [isSalesmanRole, pathname, router]);

  // Safety net: a cook's only permitted surface is the KOT screen — bounce
  // away from literally everything else, even the dashboard.
  useEffect(() => {
    if (!isCookRole) return;
    if (!isActive(pathname, '/restaurant')) {
      router.replace('/restaurant');
    }
  }, [isCookRole, pathname, router]);

  // Safety net: a cashier only has Dashboard/Orders/Billing.
  useEffect(() => {
    if (!isCashierRole) return;
    const allowedPaths = ['/dashboard', '/orders', '/billing'];
    if (!allowedPaths.some((p) => isActive(pathname, p))) {
      router.replace('/billing');
    }
  }, [isCashierRole, pathname, router]);

  // Safety net: a waiter only has Dashboard/Orders/Tables (restaurant module).
  useEffect(() => {
    if (!isWaiterRole) return;
    const allowedPaths = ['/dashboard', '/orders', '/restaurant'];
    if (!allowedPaths.some((p) => isActive(pathname, p))) {
      router.replace('/restaurant');
    }
  }, [isWaiterRole, pathname, router]);

  // Safety net: an accountant only has Dashboard/Reports/Billing.
  useEffect(() => {
    if (!isAccountantRole) return;
    const allowedPaths = ['/dashboard', '/reports', '/billing'];
    if (!allowedPaths.some((p) => isActive(pathname, p))) {
      router.replace('/reports');
    }
  }, [isAccountantRole, pathname, router]);

  // Safety net: a delivery person only has Dashboard/Orders.
  useEffect(() => {
    if (!isDeliveryRole) return;
    const allowedPaths = ['/dashboard', '/orders'];
    if (!allowedPaths.some((p) => isActive(pathname, p))) {
      router.replace('/orders');
    }
  }, [isDeliveryRole, pathname, router]);

  // Safety net: Reports is Admin/Manager/Accountant only.
  useEffect(() => {
    if (canViewReports !== false) return;
    if (isActive(pathname, '/reports')) {
      router.replace('/dashboard');
    }
  }, [canViewReports, pathname, router]);

  // Safety net: Staff management is Admin/Manager only.
  useEffect(() => {
    if (canManageStaff !== false) return;
    if (isActive(pathname, '/staff')) {
      router.replace('/dashboard');
    }
  }, [canManageStaff, pathname, router]);

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('business_category');
    localStorage.removeItem('business_inventory_enabled');
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-50 relative isolate">
      {/* Dynamic Theme Color Accent Ambient Glass Backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className={`absolute -top-40 -left-40 w-[32rem] h-[32rem] rounded-full blur-3xl transition-all duration-700 ${
          customSettings?.branding?.themeColor === 'sky' ? 'bg-sky-300/45' :
          customSettings?.branding?.themeColor === 'violet' ? 'bg-violet-300/45' :
          customSettings?.branding?.themeColor === 'amber' ? 'bg-amber-300/45' :
          customSettings?.branding?.themeColor === 'rose' ? 'bg-rose-300/45' :
          customSettings?.branding?.themeColor === 'slate' ? 'bg-slate-400/45' :
          'bg-emerald-300/45'
        }`} />
        <div className="absolute top-1/3 -left-24 w-96 h-96 rounded-full bg-cyan-300/35 blur-3xl" />
        <div className="absolute -bottom-32 right-0 w-[32rem] h-[32rem] rounded-full bg-slate-300/35 blur-3xl" />
      </div>

      {/* Desktop sidebar */}
      {!hideNavigation && (
        <aside className="hidden md:flex w-64 bg-white/30 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/50 glass-sheen-sm flex-col m-3 mr-0 rounded-[2rem]">
        <div className="px-5 py-6 flex flex-col gap-5 border-b border-white/40 mb-2">
          <div className="flex items-center gap-2">
            <ObixMark className="w-8 h-8 shrink-0" />
            <span className="flex flex-col leading-none">
              <span className="text-lg font-bold text-slate-800 tracking-tight">OBIX</span>
              <span className="text-[8px] tracking-[0.12em] text-slate-500 font-semibold uppercase mt-0.5">Order Billing Inventory eXperience</span>
            </span>
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
                className={`w-full flex items-center gap-2.5 bg-white/35 hover:bg-white/55 backdrop-blur-md rounded-full p-3 ring-1 glass-sheen-sm transition-colors disabled:opacity-60 ${
                  businessMenuOpen ? 'ring-sky-300/70' : 'ring-white/50'
                }`}
              >
                {businessLogoUrl ? (
                  <BusinessAvatar logoUrl={businessLogoUrl} size="w-7 h-7" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-700 flex items-center justify-center shrink-0">
                    <Store className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold text-slate-800 truncate leading-tight">{businessName}</p>
                  <p className="text-[11px] font-bold tracking-wide uppercase truncate">
                    <span className="text-sky-700">{switching ? 'Switching...' : businessCategory || 'No category'}</span>
                    {userRole && ROLE_BADGE[userRole] && (
                      <>
                        <span className="text-slate-300 mx-1">&middot;</span>
                        <span className="text-emerald-700">{ROLE_BADGE[userRole]}</span>
                      </>
                    )}
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${businessMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {businessMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setBusinessMenuOpen(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-white shadow-xl ring-1 ring-slate-200/50 rounded-3xl p-1.5 max-h-72 overflow-y-auto">
                    {myBusinesses.length === 0 && businessId && (
                      <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-2xl bg-slate-50">
                        <BusinessAvatar logoUrl={businessLogoUrl} size="w-3.5 h-3.5" active />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-bold text-slate-800 truncate">{businessName}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wide">{businessCategory || 'No category'}</p>
                        </div>
                        <Check className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                      </div>
                    )}
                    {myBusinesses.map((b) => {
                      const active = b.id === businessId;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleSwitchBusiness(b.id)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-left transition-colors ${
                            active ? 'bg-sky-500/15' : 'hover:bg-slate-50'
                          }`}
                        >
                          <BusinessAvatar logoUrl={b.logo_url} size="w-3.5 h-3.5" active={active} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{b.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{b.category || 'No category'}</p>
                          </div>
                          {active && <Check className="w-3.5 h-3.5 text-sky-700 shrink-0" />}
                        </button>
                      );
                    })}
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={() => handleSwitchBusiness(NEW_BUSINESS_OPTION)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl text-left text-sky-700 hover:bg-sky-50 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-sm font-bold">Add new business</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {businessId && (isOnline === false || pendingCount > 0) && (
            <button
              type="button"
              onClick={() => isOnline && pendingCount > 0 && !syncing && syncNow(businessId)}
              disabled={!isOnline || pendingCount === 0 || syncing}
              title={isOnline && pendingCount > 0 ? 'Click to sync now' : undefined}
              className={`w-full flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold ring-1 transition-colors disabled:cursor-default ${
                !isOnline
                  ? 'bg-slate-500/10 text-slate-600 ring-slate-400/30'
                  : 'bg-amber-500/10 text-amber-700 ring-amber-500/30 hover:bg-amber-500/20 cursor-pointer'
              }`}
            >
              {!isOnline ? (
                <CloudOff className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
              )}
              <span className="truncate">
                {!isOnline ? 'Offline — sales are queued locally' : `${pendingCount} pending sync`}
              </span>
            </button>
          )}
        </div>
        {notifOpen && (
          <div className="mx-3 mb-2 bg-white shadow-lg ring-1 ring-slate-200/50 rounded-2xl p-3 max-h-64 overflow-y-auto space-y-2">
            {notifications.length === 0 && <p className="text-xs text-slate-400">No new notifications</p>}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
                className="block w-full text-left text-xs text-slate-700 bg-white/60 hover:bg-white/80 rounded-xl p-2"
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${
                  active
                    ? `${tint.activeBg} backdrop-blur-md ring-1 ${tint.ring} glass-sheen-sm ${tint.fg}`
                    : 'text-slate-600 hover:bg-white/35'
                }`}
              >
                <div
                  className={`${tint.chip} ${tint.fg} backdrop-blur-md w-9 h-9 rounded-full flex items-center justify-center shrink-0 glass-sheen-sm`}
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
          className="flex items-center gap-3 m-3 px-3 py-2.5 rounded-full text-sm font-bold text-slate-600 hover:bg-rose-500/10 hover:text-rose-600 text-left transition-colors"
        >
          <div className="bg-rose-500/15 text-rose-500 w-9 h-9 rounded-full flex items-center justify-center shrink-0 glass-sheen-sm">
            <LogOut className="w-4 h-4" strokeWidth={2.25} />
          </div>
          Log out
        </button>
      </aside>
      )}

      {/* Mobile top bar */}
      {!hideNavigation && (
        <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-white/25 backdrop-blur-2xl backdrop-saturate-150 border-b border-white/50 shadow-[0_4px_30px_-5px_rgba(0,0,0,0.1)] px-4 py-2 flex flex-col justify-center min-h-[60px]">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-slate-800 tracking-tight">OBIX</span>
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
            <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider shrink-0">
              {switching ? 'Switching...' : businessCategory}
            </span>
            {userRole && ROLE_BADGE[userRole] && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider shrink-0">
                  {ROLE_BADGE[userRole]}
                </span>
              </>
            )}
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>
        )}
      </header>
      )}

      <main className={`flex-1 min-w-0 ${hideNavigation ? 'pt-0 pb-0' : 'pt-[60px] pb-16 md:pt-0 md:pb-0'}`}>
        {broadcastAnnouncement?.active && broadcastAnnouncement?.message && !dismissedAlert && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between border-b shadow-sm ${
              broadcastAnnouncement.type === 'critical'
                ? 'bg-rose-600 text-white border-rose-700'
                : broadcastAnnouncement.type === 'warning'
                ? 'bg-amber-500 text-slate-950 border-amber-600'
                : 'bg-indigo-600 text-white border-indigo-700'
            }`}
          >
            <div className="flex items-center gap-2 max-w-5xl mx-auto flex-1">
              <span className="text-sm">
                {broadcastAnnouncement.type === 'critical' ? '🚨' : broadcastAnnouncement.type === 'warning' ? '⚠️' : '📢'}
              </span>
              <span><strong>Platform Notification:</strong> {broadcastAnnouncement.message}</span>
            </div>
            <button
              onClick={() => setDismissedAlert(true)}
              className="p-1 hover:bg-black/10 rounded-lg transition ml-2"
              title="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div key={pathname} className="animate-in fade-in duration-150 ease-out">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      {!hideNavigation && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/25 backdrop-blur-2xl backdrop-saturate-150 border-t border-white/50 shadow-[0_-4px_30px_-5px_rgba(0,0,0,0.1)] flex px-1 py-1 pb-[env(safe-area-inset-bottom)]">
        {primaryNavBase.map((item, index) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const label =
            item.href === '/products' && businessCategory === 'restaurant'
              ? 'Menu'
              : item.href === '/products' && businessCategory === 'pharmacy'
                ? 'Medicines'
                : item.label;
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
        {moreNav.length > 0 && (
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
        )}
      </nav>
      )}

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white/60 backdrop-blur-3xl backdrop-saturate-150 ring-1 ring-white/50 glass-sheen-sm rounded-t-[2.5rem] p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-4 duration-200">
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
                    className="flex flex-col items-center justify-center gap-2 py-4 rounded-3xl bg-white/40 backdrop-blur-xl ring-1 ring-white/50 glass-sheen-sm text-slate-800 hover:bg-white/60 transition-all"
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
          <div className="absolute bottom-0 inset-x-0 bg-white shadow-2xl border-t border-slate-100 rounded-t-[2.5rem] p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-4 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-bold text-slate-800">Switch Business</span>
              <button onClick={() => setMobileBusinessMenuOpen(false)} className="text-slate-500 hover:text-slate-700 bg-white/50 ring-1 ring-white/50 p-1.5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {myBusinesses.length === 0 && businessId && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-sky-500/10 ring-1 ring-sky-500/20">
                  <BusinessAvatar logoUrl={businessLogoUrl} size="w-5 h-5" active />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{businessName}</p>
                    <p className="text-[10px] text-sky-700 uppercase font-medium">{businessCategory || 'No category'}</p>
                  </div>
                  <Check className="w-5 h-5 text-sky-700 shrink-0" />
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
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
                      active ? 'bg-sky-500/15 ring-1 ring-sky-500/25' : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <BusinessAvatar logoUrl={b.logo_url} size="w-5 h-5" active={active} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${active ? 'text-slate-800' : 'text-slate-700'}`}>{b.name}</p>
                      <p className={`text-[10px] uppercase font-medium ${active ? 'text-sky-700' : 'text-slate-500'}`}>{b.category || 'No category'}</p>
                    </div>
                    {active && <Check className="w-5 h-5 text-sky-700 shrink-0" />}
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
                className="w-full flex items-center gap-3 p-3 rounded-2xl text-left bg-sky-50 hover:bg-sky-100 transition-all text-sky-700"
              >
                <Plus className="w-5 h-5 shrink-0" />
                <span className="text-sm font-bold">Add new business</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {!hideNavigation && (chatEnabled ? (
        <ChatOrderWidget businessId={businessId} businessCategory={businessCategory} />
      ) : (
        ['/orders', '/products', '/customers'].includes(pathname) && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-new-form'))}
            aria-label="Add New"
            className="fixed z-50 w-14 h-14 rounded-full bg-emerald-500/85 backdrop-blur-md ring-1 ring-white/30 glass-sheen-sm hover:bg-emerald-500/95 text-white shadow-lg shadow-emerald-900/30 flex items-center justify-center transition-all duration-200 bottom-20 right-4 md:bottom-6 md:right-6 scale-100 opacity-100"
          >
            <Plus className="w-6 h-6 animate-in zoom-in duration-200" />
          </button>
        )
      ))}
      <PostLoginUpdateAlert />
    </div>
  );
}
