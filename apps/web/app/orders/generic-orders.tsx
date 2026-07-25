'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/app-shell';
import { ClearModuleButton } from '@/components/clear-module-button';
import { GenericOrderModal, CartItem } from '@/components/generic-order-modal';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { getCachedBusinessCategory } from '@/lib/auth';
import { parseQuantityUnit, canonicalUnitKey } from '@/lib/parse-quantity-unit';
import { getCached, setCached, listOutbox, type OutboxOrderItem } from '@/lib/offline-db';
import { useOfflineStore } from '@/lib/offline-store';
import { buildReceiptHtml, printReceiptHtml } from '@/lib/receipt-template';
import {
  Plus, X, ShoppingCart, FileText, Trash2,
  IndianRupee, CheckCircle2, Clock, Package, Truck, XCircle,
  Pencil, Minus, Check, Search, MapPin, Calendar, AlertCircle, Printer, UserRound, RotateCcw,
  Bot, CloudOff,
} from 'lucide-react';

interface Customer { id: string; name: string; phone?: string; }
interface Product {
  id: string;
  name: string;
  selling_price: string | number;
  unit: string;
  unit_prices?: Record<string, number> | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  prescription_required?: boolean;
}
interface OrderItem {
  id: string;
  quantity: string | number;
  unit_price: string | number;
  subtotal: string | number;
  unit?: string | null;
  product?: Product;
  custom_product_name?: string;
  returned_quantity?: string | number;
}
interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_id?: string;
  status: string;
  total_amount: string | number;
  created_at: string;
  items?: OrderItem[];
  created_by?: { full_name: string | null } | null;
}

const STATUSES = ['draft', 'confirmed', 'packed', 'dispatched', 'delivered', 'paid', 'returned', 'cancelled'];

const STATUS_META: Record<string, { color: string; icon: typeof Clock }> = {
  draft:      { color: 'bg-orange-500/10 text-orange-700 ring-1 ring-orange-500/20',  icon: Clock },
  confirmed:  { color: 'bg-blue-500/10 text-blue-700 ring-1 ring-blue-500/20',     icon: CheckCircle2 },
  packed:     { color: 'bg-indigo-500/10 text-indigo-700 ring-1 ring-indigo-500/20', icon: Package },
  dispatched: { color: 'bg-purple-500/10 text-purple-700 ring-1 ring-purple-500/20', icon: Truck },
  delivered:  { color: 'bg-teal-500/10 text-teal-700 ring-1 ring-teal-500/20', icon: CheckCircle2 },
  paid:       { color: 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20', icon: IndianRupee },
  returned:   { color: 'bg-yellow-500/10 text-yellow-700 ring-1 ring-yellow-500/20', icon: RotateCcw },
  cancelled:  { color: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20',     icon: XCircle },
  queued:     { color: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20',  icon: CloudOff },
  sync_failed: { color: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20',   icon: AlertCircle },
};

const STATUS_BAR_COLOR: Record<string, string> = {
  draft: 'bg-orange-500',
  confirmed: 'bg-blue-500',
  packed: 'bg-indigo-500',
  dispatched: 'bg-purple-500',
  delivered: 'bg-teal-500',
  paid: 'bg-emerald-500',
  returned: 'bg-yellow-500',
  cancelled: 'bg-rose-500',
  queued: 'bg-amber-500',
  sync_failed: 'bg-rose-500',
};

/** Turns a still-unsynced outbox order into an Order-shaped row so it stays visible in the list (and survives a page refresh) until it syncs. */
function syntheticOrderFromOutbox(item: OutboxOrderItem, productsById: Map<string, Product>): Order {
  const payload = item.payload as {
    customerId?: string;
    customerName?: string;
    items: { productId?: string; customProductName?: string; unit?: string; quantity: number; unitPrice: number }[];
  };
  const items: OrderItem[] = payload.items.map((it, idx) => ({
    id: `${item.id}-${idx}`,
    quantity: it.quantity,
    unit_price: it.unitPrice,
    subtotal: it.quantity * it.unitPrice,
    unit: it.unit,
    product: it.productId ? productsById.get(it.productId) : undefined,
    custom_product_name: it.customProductName,
  }));
  return {
    id: item.id,
    order_number: 'Queued…',
    customer_name: payload.customerName || 'Walk-in',
    customer_id: payload.customerId,
    status: item.status === 'failed' ? 'sync_failed' : 'queued',
    total_amount: items.reduce((sum, it) => sum + Number(it.subtotal), 0),
    created_at: new Date(item.createdAt).toISOString(),
    items,
  };
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { color: 'bg-slate-500/10 text-slate-600 ring-1 ring-slate-500/20', icon: Clock };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full backdrop-blur-sm ${meta.color}`}>
      {status}
    </span>
  );
}

export function GenericOrders() {
  const { businessId, ready } = useBusiness();
  const isPharmacy = businessId ? getCachedBusinessCategory(businessId) === 'pharmacy' : false;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW' | 'UNPAID' | 'PAID'>('ALL');
  const enqueueOrder = useOfflineStore((s) => s.enqueueOrder);

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowForm(true);
  }, [searchParams]);

  useEffect(() => {
    const handleOpen = () => setShowForm(true);
    window.addEventListener('open-new-form', handleOpen);
    return () => window.removeEventListener('open-new-form', handleOpen);
  }, []);

  // Drawer state
  const [drawerOrder, setDrawerOrder] = useState<Order | null>(null);
  const [drawerStatus, setDrawerStatus] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Credit'>('Cash');

  // Return-selection state — lets the user pick how many units of each item to return
  const [returnMode, setReturnMode] = useState(false);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [returning, setReturning] = useState(false);

  const returnRemaining = (item: OrderItem) => Number(item.quantity) - Number(item.returned_quantity || 0);

  // Edit-items state
  type EditLine = {
    name: string; qty: string; price: string; productId?: string; unit?: string;
    originalUnit?: string; originalPrice?: string; unitPrices?: Record<string, number> | null;
  };
  const [editMode, setEditMode] = useState(false);
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  /** Prepends any not-yet-synced offline sales so they stay visible (and survive a refresh) until the sync engine lands them. */
  const withQueuedOrders = async (bizId: string, baseOrders: Order[]): Promise<Order[]> => {
    const [outbox, cachedProducts] = await Promise.all([
      listOutbox(bizId),
      getCached<Product[]>(bizId, 'products'),
    ]);
    const productsById = new Map((cachedProducts || []).map((p) => [p.id, p]));
    const queued = outbox
      .filter((item): item is OutboxOrderItem => item.type === 'order' && item.status !== 'synced')
      .map((item) => syntheticOrderFromOutbox(item, productsById))
      .reverse();
    return [...queued, ...baseOrders];
  };

  const load = async (bizId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [ordersRes, customersRes] = await Promise.all([
        apiClient.get<Order[]>('/api/orders', { params: { businessId: bizId } }),
        apiClient.get<Customer[]>('/api/customers', { params: { businessId: bizId } }),
      ]);
      setCached(bizId, 'orders', ordersRes.data);
      setCached(bizId, 'customers', customersRes.data);
      setOrders(await withQueuedOrders(bizId, ordersRes.data));
      setCustomers(customersRes.data);

      setDrawerOrder((currentDrawer) => {
        if (!currentDrawer) return null;
        const updated = ordersRes.data.find((o) => o.id === currentDrawer.id);
        if (updated) {
          setDrawerStatus(updated.status);
          return updated;
        }
        return currentDrawer;
      });
    } catch (err: any) {
      // Network failure — fall back to the last-cached orders/customers instead
      // of blanking the screen, so the counter stays usable offline.
      if (!err.response) {
        const [cachedOrders, cachedCustomers] = await Promise.all([
          getCached<Order[]>(bizId, 'orders'),
          getCached<Customer[]>(bizId, 'customers'),
        ]);
        if (cachedOrders || cachedCustomers) {
          setOrders(await withQueuedOrders(bizId, cachedOrders || []));
          setCustomers(cachedCustomers || []);
          return;
        }
      }
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && businessId) load(businessId);
  }, [ready, businessId]);

  useEffect(() => {
    const handleOrderUpdated = () => {
      if (ready && businessId) {
        load(businessId, true); // Silent reload on background order updates
      }
    };
    window.addEventListener('order-updated', handleOrderUpdated);
    return () => window.removeEventListener('order-updated', handleOrderUpdated);
  }, [ready, businessId]);

  const openDrawer = async (o: Order) => {
    setDrawerOrder(o);
    setDrawerStatus(o.status);
    setDeleteConfirm(false);
    setInvoiceId(null);
    setEditMode(false);
    setPaymentMethod('Cash');
    setReturnMode(false);
    setReturnQty({});
    // A queued/sync_failed order's id is only a local outbox uuid — don't let
    // the AI chat assistant latch onto it as "the order being edited", since
    // any edit it sends would 404 against the server.
    if (typeof window !== 'undefined' && o.status !== 'queued' && o.status !== 'sync_failed') {
      window.dispatchEvent(new CustomEvent('set-active-order-id', { detail: { id: o.id, orderNumber: o.order_number } }));
    }
    // Check for existing invoice
    if (businessId) {
      try {
        const res = await apiClient.get<{ id: string }[]>('/api/billing/invoices', {
          params: { businessId, orderId: o.id },
        });
        if (res.data.length > 0) setInvoiceId(res.data[0].id);
      } catch {
        // no invoice yet
      }
    }
  };

  const closeDrawer = () => {
    setDrawerOrder(null);
    setDeleteConfirm(false);
    setPaymentMethod('Cash');
    setReturnMode(false);
    setReturnQty({});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('set-active-order-id', { detail: { id: null } }));
    }
  };

  const handleStatusSave = async () => {
    if (!businessId || !drawerOrder) return;
    setStatusSaving(true);
    try {
      await apiClient.patch(`/api/orders/${drawerOrder.id}/status`, { status: drawerStatus }, { params: { businessId } });
      setDrawerOrder({ ...drawerOrder, status: drawerStatus });
      setOrders((prev) => prev.map((o) => o.id === drawerOrder.id ? { ...o, status: drawerStatus } : o));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusSaving(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!businessId || !drawerOrder) return;
    setStatusSaving(true);
    try {
      const amount = Number(drawerOrder.total_amount);
      // Create payment BEFORE marking paid so the service sees the original status
      // and correctly posts the debit to outstanding_amount
      if (amount > 0) {
        await apiClient.post('/api/billing/payments', {
          businessId,
          orderId: drawerOrder.id,
          customerId: drawerOrder.customer_id || undefined,
          amount,
          paymentMethod,
        });
      }
      await apiClient.patch(`/api/orders/${drawerOrder.id}/status`, { status: 'paid' }, { params: { businessId } });
      setDrawerOrder({ ...drawerOrder, status: 'paid' });
      setDrawerStatus('paid');
      setOrders((prev) => prev.map((o) => o.id === drawerOrder.id ? { ...o, status: 'paid' } : o));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to mark as paid');
    } finally {
      setStatusSaving(false);
    }
  };

  const startReturn = () => {
    if (!drawerOrder) return;
    setReturnMode(true);
    // Default every item to its full remaining quantity — matches the old "return everything" behavior;
    // the user can then dial individual items down (or to 0) with the stepper.
    const initial: Record<string, number> = {};
    (drawerOrder.items ?? []).forEach((i) => {
      const remaining = returnRemaining(i);
      if (remaining > 0) initial[i.id] = remaining;
    });
    setReturnQty(initial);
  };

  const cancelReturn = () => {
    setReturnMode(false);
    setReturnQty({});
  };

  const setItemReturnQty = (item: OrderItem, qty: number) => {
    const clamped = Math.max(0, Math.min(qty, returnRemaining(item)));
    setReturnQty((prev) => ({ ...prev, [item.id]: clamped }));
  };

  const returnUnitsSelected = Object.values(returnQty).reduce((sum, q) => sum + q, 0);

  const confirmReturn = async () => {
    if (!businessId || !drawerOrder) return;
    const items = Object.entries(returnQty)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ id: itemId, quantity }));
    if (items.length === 0) return;

    const totalRemaining = (drawerOrder.items ?? []).reduce((sum, i) => sum + returnRemaining(i), 0);
    const isFull = returnUnitsSelected >= totalRemaining;
    if (!confirm(
      isFull
        ? 'Are you sure you want to return this order and process the refund? This will restore stock and adjust customer ledger.'
        : `Return ${returnUnitsSelected} unit(s) and process the refund? This will restore stock and adjust customer ledger.`
    )) {
      return;
    }
    setReturning(true);
    try {
      const res = await apiClient.post<Order>(`/api/orders/${drawerOrder.id}/return`, { items }, { params: { businessId } });
      setDrawerOrder(res.data);
      setDrawerStatus(res.data.status);
      setOrders((prev) => prev.map((o) => o.id === drawerOrder.id ? { ...o, status: res.data.status, total_amount: res.data.total_amount } : o));
      setReturnMode(false);
      setReturnQty({});
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to return order');
    } finally {
      setReturning(false);
    }
  };

  const orderBucket = (status: string): 'NEW' | 'UNPAID' | 'PAID' | null => {
    if (status === 'draft') return 'NEW';
    if (status === 'paid') return 'PAID';
    if (status === 'cancelled' || status === 'returned') return null;
    return 'UNPAID';
  };

  const quickSetStatus = async (order: Order, status: string) => {
    if (!businessId) return;
    try {
      await apiClient.patch(`/api/orders/${order.id}/status`, { status }, { params: { businessId } });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
      if (drawerOrder?.id === order.id) {
        setDrawerOrder({ ...drawerOrder, status });
        setDrawerStatus(status);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update status');
    }
  };

  const quickMarkPaid = async (order: Order) => {
    if (!businessId) return;
    try {
      const amount = Number(order.total_amount);
      if (amount > 0) {
        await apiClient.post('/api/billing/payments', {
          businessId,
          orderId: order.id,
          customerId: order.customer_id || undefined,
          amount,
          paymentMethod: 'Cash',
        });
      }
      await apiClient.patch(`/api/orders/${order.id}/status`, { status: 'paid' }, { params: { businessId } });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'paid' } : o)));
      if (drawerOrder?.id === order.id) {
        setDrawerOrder({ ...drawerOrder, status: 'paid' });
        setDrawerStatus('paid');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to mark as paid');
    }
  };

  const quickInvoice = async (order: Order) => {
    if (!businessId) return;
    try {
      const existing = await apiClient.get<{ id: string }[]>('/api/billing/invoices', { params: { businessId, orderId: order.id } });
      if (existing.data.length > 0) {
        router.push(`/billing/invoices/${existing.data[0].id}`);
        return;
      }
      const created = await apiClient.post<{ id: string }>(`/api/billing/invoices/from-order/${order.id}`, {}, { params: { businessId } });
      if (created.data?.id) router.push(`/billing/invoices/${created.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to open invoice');
    }
  };

  const handleGenerateInvoice = async () => {
    if (!businessId || !drawerOrder) return;
    if (invoiceId) { router.push(`/billing/invoices/${invoiceId}`); return; }
    setInvoiceLoading(true);
    try {
      const res = await apiClient.post<{ id: string }>(
        `/api/billing/invoices/from-order/${drawerOrder.id}`,
        {},
        { params: { businessId } },
      );
      const newId = res.data?.id;
      setInvoiceId(newId || null);
      if (newId) router.push(`/billing/invoices/${newId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!businessId || !drawerOrder) return;
    try {
      await apiClient.delete(`/api/orders/${drawerOrder.id}`, { params: { businessId } });
      setOrders((prev) => prev.filter((o) => o.id !== drawerOrder.id));
      closeDrawer();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete order');
    }
  };

  const startEdit = () => {
    if (!drawerOrder?.items) return;
    setEditLines(
      drawerOrder.items.map((i) => {
        const unit = i.unit || i.product?.unit || '';
        return {
          name: i.product?.name || i.custom_product_name || '',
          qty: String(Number(i.quantity)),
          price: String(Number(i.unit_price)),
          productId: i.product?.id,
          unit,
          originalUnit: unit,
          originalPrice: String(Number(i.unit_price)),
          unitPrices: i.product?.unit_prices,
        };
      }),
    );
    setEditMode(true);
  };

  const updateLine = (idx: number, field: keyof EditLine, value: string) => {
    setEditLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  // Mirrors the cart's unit-change pricing: use a saved per-unit price if one
  // exists on the product, otherwise fall back to proportional conversion
  // between mass units (g/kg) or volume units (ml/L).
  const updateLineUnit = (idx: number, newUnit: string) => {
    setEditLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;

      const originalUnit = l.originalUnit || l.unit || 'pcs';
      const originalPrice = l.originalPrice !== undefined ? Number(l.originalPrice) : Number(l.price);
      let newPrice = originalPrice;

      const savedPrice = l.unitPrices?.[canonicalUnitKey(newUnit)];
      if (savedPrice !== undefined) {
        newPrice = savedPrice;
      } else {
        const normalize = (u: string) => {
          const lower = (u || '').toLowerCase();
          if (lower === 'gram' || lower === 'g' || lower === 'gm' || lower === 'gms') return 'g';
          if (lower === 'kg' || lower === 'kilo' || lower === 'kgs' || lower === 'kilogram') return 'kg';
          if (lower === 'litre' || lower === 'l' || lower === 'ltr' || lower === 'liters') return 'L';
          if (lower === 'ml' || lower === 'mls' || lower === 'millilitre') return 'ml';
          return lower;
        };

        const parsedOriginal = parseQuantityUnit(originalUnit) || { quantity: 1, unit: originalUnit };
        const parsedNew = parseQuantityUnit(newUnit) || { quantity: 1, unit: newUnit };
        const normOriginal = normalize(parsedOriginal.unit);
        const normNew = normalize(parsedNew.unit);
        const isMass = (u: string) => u === 'kg' || u === 'g';
        const isVol = (u: string) => u === 'L' || u === 'ml';

        if (normOriginal && normNew && ((isMass(normOriginal) && isMass(normNew)) || (isVol(normOriginal) && isVol(normNew)))) {
          let pricePerBasicUnit = originalPrice / parsedOriginal.quantity;
          if (normOriginal === 'kg' || normOriginal === 'L') pricePerBasicUnit /= 1000;
          let finalPrice = pricePerBasicUnit * parsedNew.quantity;
          if (normNew === 'kg' || normNew === 'L') finalPrice *= 1000;
          newPrice = finalPrice;
        }
      }

      return { ...l, unit: newUnit, price: parseFloat(newPrice.toFixed(4)).toString() };
    }));
  };

  const addEditLine = () => setEditLines((prev) => [...prev, { name: '', qty: '1', price: '0' }]);

  const removeEditLine = (idx: number) => setEditLines((prev) => prev.filter((_, i) => i !== idx));

  const saveEditLines = async () => {
    if (!businessId || !drawerOrder) return;
    const valid = editLines.filter((l) => l.name.trim() && Number(l.qty) > 0);
    if (valid.length === 0) return;

    // Verify all items have a unit
    const hasItemWithoutUnit = valid.some(line => !line.unit || !line.unit.trim());
    if (hasItemWithoutUnit) {
      setError('Please specify a unit for all items.');
      return;
    }

    setEditSaving(true);
    setError('');
    try {
      const res = await apiClient.put<Order>(`/api/orders/${drawerOrder.id}/items`, {
        items: valid.map((l) => ({
          productId: l.productId,
          customProductName: l.productId ? undefined : l.name.trim(),
          unit: l.unit,
          quantity: Number(l.qty),
          unitPrice: Number(l.price),
        })),
      }, { params: { businessId } });
      const updated = { ...drawerOrder, items: res.data.items, total_amount: res.data.total_amount };
      setDrawerOrder(updated);
      setOrders((prev) => prev.map((o) => o.id === drawerOrder.id ? { ...o, total_amount: res.data.total_amount } : o));
      setEditMode(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save changes');
    } finally {
      setEditSaving(false);
    }
  };

  const handleCreate = async (cartItems: CartItem[], customerId: string, customerName: string, phone?: string, patientName?: string, doctorName?: string) => {
    if (!businessId) return;
    setSaving(true);
    setError('');
    const selectedCustomer = customers.find((c) => c.id === customerId);
    const resolvedCustomerName = selectedCustomer?.name || customerName || 'Walk-in';
    const orderPayload = {
      businessId,
      customerId: customerId || undefined,
      customerName: resolvedCustomerName,
      phone: phone || undefined,
      patientName: patientName || undefined,
      doctorName: doctorName || undefined,
      orderType: 'regular',
      items: cartItems.map((it) => ({
        productId: it.product.id.startsWith('draft-') ? undefined : it.product.id,
        customProductName: it.product.id.startsWith('draft-') ? it.product.name : undefined,
        // Always record the unit actually shown/priced in the cart — not just
        // for draft items — so editing the order later sees the same packaging
        // (e.g. "100g") instead of falling back to the product's base unit.
        unit: it.product.unit,
        quantity: Number(it.quantity),
        unitPrice: Number(it.product.selling_price),
      })),
    };

    const receiptItems = cartItems.map((it) => ({
      name: it.product.name,
      quantity: it.quantity,
      unit: it.product.unit,
      unitPrice: Number(it.product.selling_price),
      subtotal: it.quantity * Number(it.product.selling_price),
    }));
    const totalAmount = receiptItems.reduce((sum, it) => sum + it.subtotal, 0);
    const printReceipt = async (orderNumber: string, createdAt: string, queued: boolean) => {
      const business = await getCached(businessId, 'business-profile');
      printReceiptHtml(
        buildReceiptHtml({
          business: business as any,
          orderNumber,
          createdAt,
          customerName: resolvedCustomerName,
          items: receiptItems,
          totalAmount,
          queued,
        }),
      );
    };

    try {
      const res = await apiClient.post('/api/orders', orderPayload);
      setShowForm(false);
      await printReceipt(res.data.order_number, res.data.created_at || new Date().toISOString(), false);
      load(businessId);
    } catch (err: any) {
      if (!err.response) {
        // Offline — queue the sale instead of losing it, print from what we know locally.
        await enqueueOrder(businessId, orderPayload);
        setShowForm(false);
        await printReceipt('Queued…', new Date().toISOString(), true);
        load(businessId, true);
      } else {
        setError(err.response?.data?.message || 'Failed to create order');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  // A queued/sync_failed row is just a local placeholder — its id is an
  // outbox uuid, not a real order id, so payment/edit/invoice/delete/return
  // actions (which PATCH/DELETE by id) would just 404 against the server.
  const isUnsyncedOrder = drawerOrder?.status === 'queued' || drawerOrder?.status === 'sync_failed';

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'ALL' && orderBucket(o.status) !== statusFilter) return false;
    if (search.trim() && !o.customer_name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  // Rail stats (desktop-only side panel) — derived from data already loaded above, no extra API calls
  const activeOrders = orders.filter((o) => o.status !== 'cancelled');
  const todayStr = new Date().toDateString();
  const todaysSales = activeOrders
    .filter((o) => new Date(o.created_at).toDateString() === todayStr)
    .reduce((sum, o) => sum + Number(o.total_amount), 0);
  const pendingOrders = orders.filter((o) => orderBucket(o.status) === 'UNPAID');
  const pendingAmount = pendingOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const statusCounts = STATUSES
    .map((status) => ({ status, count: orders.filter((o) => o.status === status).length }))
    .filter((s) => s.count > 0);
  const maxStatusCount = Math.max(1, ...statusCounts.map((s) => s.count));

  return (
    <AppShell>
      <div className="p-4 md:p-10 max-w-3xl lg:max-w-6xl mx-auto">
      <div className="lg:flex lg:gap-6 lg:items-start">
      <div className="lg:flex-1 lg:min-w-0 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Orders</h1>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="gap-1.5 bg-accent-orange hover:brightness-95 text-white">
              <Plus className="w-4 h-4" /> New Order
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              getCachedBusinessCategory(businessId || '') === 'restaurant'
                ? 'Search by guest name, table # or order ID...'
                : getCachedBusinessCategory(businessId || '') === 'pharmacy'
                ? 'Search by patient name, prescription or Rx #...'
                : getCachedBusinessCategory(businessId || '') === 'wholesale'
                ? 'Search by dealer name, PO # or invoice ID...'
                : 'Search by customer name, phone # or order ID...'
            }
            className="w-full h-11 pl-10 pr-4 rounded-full bg-white/40 backdrop-blur-md ring-1 ring-white/50 glass-sheen-sm text-sm placeholder:text-slate-400 outline-none focus:ring-accent-orange/40"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {(['ALL', 'NEW', 'UNPAID', 'PAID'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 h-9 rounded-full text-xs font-bold uppercase tracking-wide shrink-0 transition-colors ${
                statusFilter === f ? 'bg-accent-orange text-white shadow-sm' : 'bg-white/40 backdrop-blur-md ring-1 ring-white/50 text-slate-500'
              }`}
            >
              {f}
            </button>
          ))}
          {businessId && <ClearModuleButton module="orders" businessId={businessId} />}
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {businessId && showForm && (
          <GenericOrderModal
            businessId={businessId}
            isOpen={showForm}
            customers={customers}
            onClose={() => setShowForm(false)}
            onSubmit={handleCreate}
            onCustomerCreated={(c) => setCustomers((prev) => (prev.some((existing) => existing.id === c.id) ? prev : [c, ...prev]))}
          />
        )}

        {loading ? (
          <p className="p-10 text-center text-slate-400 text-sm">Loading...</p>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm">
            <div className="w-24 h-24 bg-tile-peach rounded-full flex items-center justify-center mb-6">
              <ShoppingCart className="w-10 h-10 text-tile-peach-fg" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">No active orders</h2>
            <p className="text-slate-500 mb-8 text-sm">{isPharmacy ? 'Add medicines to create a new order' : 'Add items to create a new order'}</p>
            <Button onClick={() => setShowForm(true)} className="bg-accent-orange hover:brightness-95 text-white gap-2 px-6 h-11 shadow-sm">
              <Plus className="w-4 h-4" /> New Order
            </Button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <p className="p-10 text-center text-slate-400 text-sm">No orders match this filter.</p>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((o) => {
              const bucket = orderBucket(o.status);
              return (
                <div key={o.id} className={`bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm shadow-sm p-3.5 space-y-3 transition-all hover:bg-white/50 active:scale-[0.99] cursor-pointer ${o.status === 'returned' ? 'opacity-40 hover:opacity-60' : ''}`}>
                  <button onClick={() => openDrawer(o)} className="w-full flex items-start gap-3 text-left cursor-pointer">
                    <div className="w-11 h-11 rounded-xl bg-tile-peach text-tile-peach-fg flex items-center justify-center shrink-0 font-bold text-sm">
                      {o.customer_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{o.customer_name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        {o.created_by?.full_name ? (
                          <span className="flex items-center gap-1 truncate"><UserRound className="w-3 h-3 shrink-0" />{o.created_by.full_name}</span>
                        ) : (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />&mdash;</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(o.created_at).toLocaleDateString('en-IN', { month: 'short', day: '2-digit', year: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={o.status} />
                      <p className="font-black text-accent-orange text-base mt-1">&#8377;{Number(o.total_amount).toFixed(2)}</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    {o.status !== 'returned' && o.status !== 'cancelled' && (['NEW', 'UNPAID', 'PAID'] as const).map((b) => {
                      const active = bucket === b;
                      const BucketIcon = b === 'NEW' ? Clock : b === 'UNPAID' ? AlertCircle : CheckCircle2;
                      return (
                        <button
                          key={b}
                          onClick={() => (b === 'PAID' ? quickMarkPaid(o) : quickSetStatus(o, b === 'NEW' ? 'draft' : 'confirmed'))}
                          className={`flex-1 flex items-center justify-center gap-1 h-8 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors ${
                            active ? 'bg-accent-orange text-white' : 'bg-white/40 backdrop-blur-md ring-1 ring-white/50 text-slate-500'
                          }`}
                        >
                          <BucketIcon className="w-3 h-3" />
                          {b}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => quickInvoice(o)}
                      className={`w-8 h-8 rounded-full bg-tile-sky text-tile-sky-fg flex items-center justify-center shrink-0 hover:brightness-95 transition-all ${o.status === 'returned' || o.status === 'cancelled' ? 'ml-auto' : ''}`}
                      aria-label="Invoice"
                      title="Generate Invoice"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rail — desktop-only quick stats & status breakdown */}
      <aside className="hidden lg:block w-72 shrink-0 space-y-4 sticky top-10 self-start">
        <div className="bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm shadow-sm p-5 space-y-3.5">
          <h3 className="text-sm font-bold text-slate-800">Quick stats</h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Today's sales</span>
            <span className="text-sm font-bold text-emerald-600">₹{todaysSales.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Pending payments</span>
            <span className="text-sm font-bold text-accent-orange">₹{pendingAmount.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Total orders</span>
            <span className="text-sm font-bold text-slate-800">{orders.length}</span>
          </div>
        </div>

        {statusCounts.length > 0 && (
          <div className="bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm shadow-sm p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Status breakdown</h3>
            <div className="space-y-2.5">
              {statusCounts.map(({ status, count }) => (
                <div key={status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 capitalize">{status}</span>
                    <span className="font-semibold text-slate-800">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-900/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${STATUS_BAR_COLOR[status] || 'bg-slate-400'}`}
                      style={{ width: `${(count / maxStatusCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
      </div>
      </div>

      {/* ── Order Detail Drawer ── */}
      {drawerOrder && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={closeDrawer} />

          {/* Panel: bottom sheet on mobile, right panel on desktop */}
          <div className="fixed z-50 bg-white/60 backdrop-blur-2xl backdrop-saturate-150 flex flex-col
            inset-x-0 bottom-0 rounded-t-2xl max-h-[92dvh]
            md:inset-x-auto md:inset-y-0 md:right-0 md:rounded-none md:rounded-l-2xl md:w-[420px] md:max-h-none md:h-full
            shadow-2xl">

            {/* Drag handle – mobile */}
            <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-white/40 flex items-start justify-between gap-4">
              <div>
                <p className="font-bold text-slate-800 text-base">{drawerOrder.order_number}</p>
                <p className="text-sm text-slate-500 mt-0.5">{drawerOrder.customer_name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(drawerOrder.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
                {drawerOrder.created_by?.full_name && (
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <UserRound className="w-3 h-3" /> Placed by {drawerOrder.created_by.full_name}
                  </p>
                )}
              </div>
              <button onClick={closeDrawer} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/40 hover:bg-white/60 backdrop-blur-sm transition-colors shrink-0">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 text-rose-700 text-xs font-semibold ring-1 ring-rose-500/20">
                  {error}
                </div>
              )}

              {/* Total */}
              <div className="bg-emerald-500/10 backdrop-blur-sm ring-1 ring-emerald-500/20 rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-emerald-700 font-medium">Order Total</span>
                <span className="text-xl font-black text-emerald-700">₹{Number(drawerOrder.total_amount).toFixed(2)}</span>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items</p>
                  {!editMode && !isUnsyncedOrder && drawerOrder.status !== 'returned' && drawerOrder.status !== 'cancelled' ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('open-order-assistant'));
                          }
                        }}
                        className="flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-700"
                      >
                        <Bot className="w-3.5 h-3.5" /> Edit with AI
                      </button>
                      <button onClick={startEdit} className="flex items-center gap-1 text-xs text-emerald-600 font-medium hover:text-emerald-700">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    </div>
                  ) : editMode ? (
                    <div className="flex gap-2">
                      <button onClick={() => setEditMode(false)} className="text-xs text-slate-500 font-medium hover:text-slate-700">Cancel</button>
                      <button onClick={saveEditLines} disabled={editSaving} className="flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-700 disabled:opacity-50">
                        <Check className="w-3 h-3" />{editSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  ) : null}
                </div>

                {!editMode ? (
                  <div className="rounded-2xl bg-white/30 backdrop-blur-md ring-1 ring-white/50 overflow-hidden">
                    {(drawerOrder.items ?? []).map((item, idx) => {
                      const details: string[] = [];
                      if (item.product?.batch_number) details.push(`Batch: ${item.product.batch_number}`);
                      if (item.product?.expiry_date) details.push(`Exp: ${new Date(item.product.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`);
                      const remaining = returnRemaining(item);
                      const alreadyReturned = Number(item.returned_quantity || 0) > 0;
                      const qty = returnQty[item.id] || 0;
                      return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-0 ${returnMode && qty > 0 ? 'bg-amber-500/10' : ''} ${remaining === 0 ? 'opacity-50' : ''}`}
                      >
                        {returnMode && (
                          <div className="shrink-0 mr-3">
                            {remaining === 0 ? (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Returned</span>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-white/60 ring-1 ring-white/60 rounded-lg px-1.5 py-1">
                                <button
                                  type="button"
                                  onClick={() => setItemReturnQty(item, qty - 1)}
                                  disabled={qty <= 0}
                                  className="w-5 h-5 flex items-center justify-center rounded text-amber-700 hover:bg-amber-500/10 disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-5 text-center text-xs font-bold text-slate-800">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => setItemReturnQty(item, qty + 1)}
                                  disabled={qty >= remaining}
                                  className="w-5 h-5 flex items-center justify-center rounded text-amber-700 hover:bg-amber-500/10 disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate flex items-center gap-1.5">
                            {item.product?.name || item.custom_product_name || 'Unknown'}
                            {item.product?.prescription_required && (
                              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20">
                                Rx
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">
                            ×{Number(item.quantity)} · ₹{Number(item.unit_price).toFixed(2)} each
                            {alreadyReturned && remaining > 0 && ` · ${Number(item.returned_quantity)} already returned`}
                          </p>
                          {details.length > 0 && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{details.join('  •  ')}</p>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-800 ml-3 shrink-0">₹{Number(item.subtotal).toFixed(2)}</p>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editLines.map((line, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-white/30 backdrop-blur-sm ring-1 ring-white/40 rounded-xl p-2">
                        <div className="flex-1 min-w-0">
                          <input
                            value={line.name}
                            onChange={(e) => updateLine(idx, 'name', e.target.value)}
                            placeholder="Item name"
                            className="w-full text-sm font-medium text-slate-800 bg-transparent outline-none placeholder:text-slate-400 mb-1"
                          />
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-white/40 backdrop-blur-sm ring-1 ring-white/50 rounded-lg px-2 py-1">
                              <button onClick={() => updateLine(idx, 'qty', String(Math.max(1, Number(line.qty) - 1)))} className="text-slate-400 hover:text-slate-600">
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                value={line.qty}
                                onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                                className="w-8 text-center text-sm font-semibold text-slate-800 bg-transparent outline-none"
                              />
                              <button onClick={() => updateLine(idx, 'qty', String(Number(line.qty) + 1))} className="text-slate-400 hover:text-slate-600">
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <input
                              value={line.unit || ''}
                              onChange={(e) => updateLineUnit(idx, e.target.value)}
                              list="edit-unit-options"
                              placeholder="Unit"
                              className={`w-14 bg-white/40 backdrop-blur-sm ring-1 rounded-lg px-1.5 py-1 text-xs text-slate-600 outline-none transition-all ${
                                (!line.unit || !line.unit.trim())
                                  ? 'ring-rose-400 focus:ring-rose-500'
                                  : 'ring-white/50 focus:ring-emerald-500'
                              }`}
                            />
                            <div
                              className={`flex items-center gap-1 bg-white/40 backdrop-blur-sm ring-1 rounded-lg px-2 py-1 transition-all ${
                                (!line.unit || !line.unit.trim())
                                  ? 'ring-slate-200 opacity-50 cursor-not-allowed'
                                  : 'ring-white/50 focus-within:ring-emerald-500'
                              }`}
                              title={(!line.unit || !line.unit.trim()) ? "Enter unit first" : undefined}
                            >
                              <span className="text-slate-400 text-xs">₹</span>
                              <input
                                value={line.price}
                                onChange={(e) => updateLine(idx, 'price', e.target.value)}
                                onFocus={(e) => e.target.select()}
                                type="number"
                                min="0"
                                disabled={!line.unit || !line.unit.trim()}
                                className="w-16 text-sm font-semibold text-slate-800 bg-transparent outline-none disabled:text-slate-400"
                              />
                            </div>
                            <span className="text-xs text-slate-400 ml-auto">
                              ₹{(Number(line.qty) * Number(line.price)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => removeEditLine(idx)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button onClick={addEditLine} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add item
                    </button>
                    <datalist id="edit-unit-options">
                      <option value="pcs" />
                      <option value="kg" />
                      <option value="g" />
                      <option value="100g" />
                      <option value="250g" />
                      <option value="500g" />
                      <option value="L" />
                      <option value="ml" />
                      <option value="100ml" />
                      <option value="250ml" />
                      <option value="500ml" />
                      <option value="box" />
                      <option value="pkt" />
                    </datalist>
                  </div>
                )}
              </div>

              {/* Status */}
              {!isUnsyncedOrder && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Update Status</p>
                  <div className="flex gap-2">
                    <select
                      value={drawerStatus}
                      onChange={(e) => setDrawerStatus(e.target.value)}
                      disabled={drawerOrder.status === 'returned' || drawerOrder.status === 'cancelled'}
                      className="flex-1 h-10 rounded-xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 px-3 text-sm font-medium text-slate-700 capitalize disabled:opacity-50"
                    >
                      {STATUSES.filter(s => s !== 'returned').map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Button
                      onClick={handleStatusSave}
                      disabled={statusSaving || drawerStatus === drawerOrder.status}
                      className="h-10 bg-slate-800/85 backdrop-blur-md hover:bg-slate-800/95 text-white"
                    >
                      {statusSaving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="shrink-0 px-5 py-4 border-t border-white/40 space-y-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {isUnsyncedOrder ? (
                <p className="text-xs text-amber-700 bg-amber-500/10 ring-1 ring-amber-500/20 rounded-2xl px-4 py-3 text-center font-medium">
                  {drawerOrder.status === 'sync_failed'
                    ? "Sync failed — check the sidebar's sync status for details, or try again once you're back online."
                    : "This sale hasn't synced yet — payment, editing, invoicing, and returns unlock once it syncs automatically."}
                </p>
              ) : (
                <>
              {/* Mark as Paid */}
              {drawerOrder.status !== 'paid' && drawerOrder.status !== 'cancelled' && drawerOrder.status !== 'returned' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['Cash', 'UPI', 'Bank Transfer', 'Credit'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`h-8 rounded-lg text-xs font-semibold transition-colors ${
                          paymentMethod === m
                            ? 'bg-emerald-500/85 backdrop-blur-md ring-1 ring-white/30 text-white'
                            : 'bg-white/40 backdrop-blur-sm ring-1 ring-white/50 text-slate-600 hover:bg-white/60'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <Button
                    onClick={handleMarkPaid}
                    disabled={statusSaving}
                    className="w-full h-11 gap-2"
                  >
                    <IndianRupee className="w-4 h-4" />
                    Mark as Paid · {paymentMethod}
                  </Button>
                </div>
              )}

              {/* Return & Refund Order */}
              {['confirmed', 'packed', 'dispatched', 'delivered', 'paid'].includes(drawerOrder.status) && (
                returnMode ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={cancelReturn}
                      disabled={returning}
                      variant="outline"
                      className="flex-1 h-11"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={confirmReturn}
                      disabled={returning || returnUnitsSelected === 0}
                      className="flex-1 h-11 gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {returning ? 'Processing…' : `Return Selected (${returnUnitsSelected})`}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={startReturn}
                    disabled={statusSaving}
                    variant="outline"
                    className="w-full h-11 gap-2 border-amber-500 text-amber-700 hover:bg-amber-50 hover:text-amber-800 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-amber-500" />
                    Return & Refund Order
                  </Button>
                )
              )}

              {/* Invoice */}
              <Button
                onClick={handleGenerateInvoice}
                disabled={invoiceLoading}
                variant="outline"
                className="w-full h-11 gap-2"
              >
                <FileText className="w-4 h-4" />
                {invoiceLoading ? 'Generating…' : invoiceId ? 'View Invoice' : 'Generate Invoice'}
              </Button>

              {/* Delete */}
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl text-rose-500 hover:bg-rose-500/10 active:bg-rose-500/15 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Order
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 h-11 rounded-xl bg-white/40 backdrop-blur-sm ring-1 ring-white/50 text-slate-600 text-sm font-medium hover:bg-white/60 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 h-11 rounded-xl bg-rose-500/85 backdrop-blur-md ring-1 ring-white/30 text-white text-sm font-semibold hover:bg-rose-500/95 transition-colors"
                  >
                    Confirm Delete
                  </button>
                </div>
              )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
