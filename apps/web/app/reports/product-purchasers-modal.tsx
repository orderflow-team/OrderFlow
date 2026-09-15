'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/format-currency';
import apiClient from '@/lib/api-client';
import {
  Package,
  Users,
  IndianRupee,
  Calendar,
  Search,
  ExternalLink,
  Phone,
  MessageCircle,
  Loader2,
  Receipt,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  FileText,
  ChevronsUpDown,
} from 'lucide-react';

export interface ProductPurchaserRow {
  orderId: string;
  orderNumber: string | null;
  orderStatus: string;
  purchasedAt: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  invoiceId: string | null;
  invoiceNumber: string | null;
}

export interface ProductPurchasersData {
  product: {
    id: string;
    name: string;
    sku: string | null;
    mrp: number | null;
    sellingPrice: number | null;
    totalQuantity: number;
    totalRevenue: number;
    uniqueCustomerCount: number;
  };
  purchases: ProductPurchaserRow[];
}

interface CustomerGroup {
  customerId: string | null;
  customerKey: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  totalQuantity: number;
  totalAmount: number;
  lastPurchasedAt: string;
  invoices: ProductPurchaserRow[];
}

interface ProductPurchasersModalProps {
  open: boolean;
  onClose: () => void;
  productId: string | null;
  productName?: string;
  businessId: string;
  days?: number;
}

export function ProductPurchasersModal({
  open,
  onClose,
  productId,
  productName: initialProductName,
  businessId,
  days,
}: ProductPurchasersModalProps) {
  const router = useRouter();
  const [data, setData] = useState<ProductPurchasersData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !productId || !businessId) {
      setData(null);
      setError('');
      setSearch('');
      setExpandedKeys(new Set());
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError('');

    apiClient
      .get<ProductPurchasersData>('/api/reports/product-purchasers', {
        params: {
          businessId,
          productId,
          days: days || undefined,
        },
      })
      .then((res) => {
        if (isMounted) {
          setData(res.data);
          // Expand all customer cards by default for quick inspection
          const keys = new Set<string>();
          if (res.data?.purchases) {
            for (const p of res.data.purchases) {
              const k = p.customerId || (p.customerPhone ? `phone_${p.customerPhone}` : `name_${p.customerName}`);
              keys.add(k);
            }
          }
          setExpandedKeys(keys);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.response?.data?.message || 'Failed to load customer purchases');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [open, productId, businessId, days]);

  // Group purchase transactions by customer
  const customerGroups = useMemo(() => {
    if (!data?.purchases || data.purchases.length === 0) return [];

    const query = search.toLowerCase().trim();
    const map = new Map<string, CustomerGroup>();

    for (const p of data.purchases) {
      const key = p.customerId || (p.customerPhone ? `phone_${p.customerPhone}` : `name_${p.customerName}`);
      let group = map.get(key);
      if (!group) {
        group = {
          customerId: p.customerId,
          customerKey: key,
          customerName: p.customerName || 'Walk-in Customer',
          customerPhone: p.customerPhone,
          customerEmail: p.customerEmail,
          totalQuantity: 0,
          totalAmount: 0,
          lastPurchasedAt: p.purchasedAt,
          invoices: [],
        };
        map.set(key, group);
      }

      group.totalQuantity += p.quantity;
      group.totalAmount += p.totalAmount;
      if (new Date(p.purchasedAt) > new Date(group.lastPurchasedAt)) {
        group.lastPurchasedAt = p.purchasedAt;
      }
      group.invoices.push(p);
    }

    let list = Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);

    if (query) {
      list = list
        .map((group) => {
          const customerMatch =
            group.customerName.toLowerCase().includes(query) ||
            (group.customerPhone && group.customerPhone.includes(query)) ||
            (group.customerEmail && group.customerEmail.toLowerCase().includes(query));

          const matchingInvoices = group.invoices.filter(
            (inv) =>
              (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(query)) ||
              (inv.orderNumber && inv.orderNumber.toLowerCase().includes(query)) ||
              inv.orderId.toLowerCase().includes(query)
          );

          if (customerMatch) {
            return group;
          }
          if (matchingInvoices.length > 0) {
            return {
              ...group,
              invoices: matchingInvoices,
            };
          }
          return null;
        })
        .filter(Boolean) as CustomerGroup[];
    }

    return list;
  }, [data?.purchases, search]);

  const toggleCustomer = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (expandedKeys.size === customerGroups.length) {
      setExpandedKeys(new Set());
    } else {
      setExpandedKeys(new Set(customerGroups.map((g) => g.customerKey)));
    }
  };

  const handleGoToInvoice = (purchase: ProductPurchaserRow) => {
    onClose();
    if (purchase.invoiceId) {
      router.push(`/billing/invoices/view?id=${encodeURIComponent(purchase.invoiceId)}`);
    } else if (purchase.orderNumber || purchase.orderId) {
      router.push(`/orders?search=${encodeURIComponent(purchase.orderNumber || purchase.orderId)}`);
    } else {
      router.push('/orders');
    }
  };

  const displayName = data?.product?.name || initialProductName || 'Product Purchase History';

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl rounded-3xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-start justify-between gap-4 pr-6">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <Package className="w-5 h-5" />
                </div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white truncate">
                  {displayName}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Buyers list and their invoice breakdown
                {days ? ` for the last ${days} day${days !== 1 ? 's' : ''}` : ''}.
              </DialogDescription>
            </div>
          </div>

          {/* Metrics summary bar */}
          {data?.product && (
            <div className="grid grid-cols-3 gap-2.5 mt-4">
              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
                  <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />
                  <span>Total Sold</span>
                </div>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {data.product.totalQuantity} <span className="text-xs font-normal text-slate-400">units</span>
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Total Revenue</span>
                </div>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {formatCurrency(data.product.totalRevenue)}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
                  <Users className="w-3.5 h-3.5 text-purple-500" />
                  <span>Total Customers</span>
                </div>
                <p className="text-base font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                  {data.product.uniqueCustomerCount} <span className="text-xs font-normal text-slate-400">buyers</span>
                </p>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Search Bar & Controls */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by customer name, phone, or invoice #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>

          {customerGroups.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAll}
              className="h-9 px-3 rounded-xl text-xs font-semibold shrink-0 gap-1.5 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>{expandedKeys.size === customerGroups.length ? 'Collapse All' : 'Expand All'}</span>
            </Button>
          )}

          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 font-medium shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        {/* Hierarchical Customer List with Invoices inside */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[260px] max-h-[55vh]">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              <p className="text-xs font-medium">Loading customer purchase records & invoices...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-500 text-xs">
              <p>{error}</p>
            </div>
          ) : customerGroups.length === 0 ? (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <Users className="w-9 h-9 mx-auto stroke-1 opacity-60" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {search ? 'No matching customers or invoices found' : 'No purchases found for this product'}
              </p>
              <p className="text-xs text-slate-400">
                {search ? 'Try searching with another keyword or clear search.' : 'Sales made in this period will appear here.'}
              </p>
            </div>
          ) : (
            customerGroups.map((group, idx) => {
              const isExpanded = expandedKeys.has(group.customerKey);
              const cleanPhone = group.customerPhone?.replace(/[^0-9]/g, '');

              const lastDateObj = new Date(group.lastPurchasedAt);
              const lastDateFormatted = !isNaN(lastDateObj.getTime())
                ? lastDateObj.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '';

              return (
                <div
                  key={group.customerKey}
                  className="rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden transition-all"
                >
                  {/* Customer Card Header (Click to Expand / Collapse Invoices) */}
                  <div
                    onClick={() => toggleCustomer(group.customerKey)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 text-indigo-700 dark:text-indigo-300 font-bold text-sm flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-800/60 shadow-xs">
                        {group.customerName.charAt(0).toUpperCase() || 'C'}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {group.customerName}
                          </p>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 shrink-0">
                            {group.invoices.length} {group.invoices.length === 1 ? 'Invoice' : 'Invoices'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          {group.customerPhone && (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{group.customerPhone}</span>
                              {cleanPhone && (
                                <a
                                  href={`https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-600 hover:text-emerald-500 p-0.5"
                                  title="Chat on WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          )}
                          {lastDateFormatted && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>Last buy: {lastDateFormatted}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Summary Totals for this Customer */}
                    <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                      <div className="text-left sm:text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {group.totalQuantity} <span className="text-xs font-normal text-slate-400">units</span>
                        </p>
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(group.totalAmount)}
                        </p>
                      </div>

                      <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Nested Invoices List */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 p-3 sm:p-4 space-y-2.5">
                      <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
                        Invoices containing this product ({group.invoices.length})
                      </p>

                      <div className="space-y-2">
                        {group.invoices.map((inv) => {
                          const dateObj = new Date(inv.purchasedAt);
                          const dateFormatted = !isNaN(dateObj.getTime())
                            ? dateObj.toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'Recent';
                          const timeFormatted = !isNaN(dateObj.getTime())
                            ? dateObj.toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '';

                          return (
                            <div
                              key={inv.orderId + (inv.invoiceId || '')}
                              className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 group/inv transition-all"
                            >
                              {/* Invoice details */}
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                                    <span>
                                      {inv.invoiceNumber
                                        ? `Invoice #${inv.invoiceNumber}`
                                        : `Order #${inv.orderNumber || inv.orderId.slice(0, 8)}`}
                                    </span>
                                  </div>

                                  {inv.orderStatus && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 capitalize">
                                      {inv.orderStatus}
                                    </span>
                                  )}

                                  <span className="text-[11px] text-slate-400">
                                    · {dateFormatted} {timeFormatted && `(${timeFormatted})`}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                                  <span>
                                    <strong className="text-slate-900 dark:text-white font-semibold">
                                      {inv.quantity} units
                                    </strong>{' '}
                                    @ {formatCurrency(inv.unitPrice)}
                                  </span>
                                  <span className="text-slate-300 dark:text-slate-700">|</span>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    Total: {formatCurrency(inv.totalAmount)}
                                  </span>
                                </div>
                              </div>

                              {/* Button to view invoice */}
                              <div className="shrink-0 flex justify-end">
                                <Button
                                  type="button"
                                  onClick={() => handleGoToInvoice(inv)}
                                  size="sm"
                                  className="h-8 px-3 rounded-lg font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
                                >
                                  <Receipt className="w-3.5 h-3.5" />
                                  <span>View Invoice</span>
                                  <ExternalLink className="w-3 h-3 opacity-70" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
