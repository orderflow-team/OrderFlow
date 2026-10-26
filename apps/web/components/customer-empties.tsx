'use client';

import { useCallback, useEffect, useState } from 'react';
import { Droplets } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { isNetworkError, useOfflineStore } from '@/lib/offline-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface PendingEmpties {
  productId: string;
  productName: string;
  pending: number;
}

export interface EmptiesHolder {
  customerId: string;
  customerName: string;
  phone: string | null;
  total: number;
  items: PendingEmpties[];
}

/** "2 Water Jar 20L · 1 Capsule" — what a customer still holds. */
export const describeEmpties = (items: PendingEmpties[]) =>
  items.map((i) => `${i.pending} ${i.productName}`).join(' · ');

/** Small pill for the customer list; renders nothing when the customer holds no empties. */
export function EmptiesBadge({ items }: { items?: PendingEmpties[] }) {
  if (!items || items.length === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-100/80 text-sky-800 text-[10px] font-bold"
      title="Empties this customer still holds"
    >
      <Droplets className="w-3 h-3" /> {describeEmpties(items)}
    </span>
  );
}

/**
 * Customer detail section: what they still hold, plus "Record returned empties". The return is
 * queued in the offline outbox when there is no connection, so a delivery person can record it on
 * the doorstep and it syncs once they are back online.
 */
export function CustomerEmptiesSection({
  businessId,
  customerId,
  onChanged,
}: {
  businessId: string;
  customerId: string;
  onChanged?: () => void;
}) {
  const enqueueContainerReturn = useOfflineStore((s) => s.enqueueContainerReturn);
  const [pending, setPending] = useState<PendingEmpties[]>([]);
  const [returnables, setReturnables] = useState<{ id: string; name: string }[]>([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, products] = await Promise.all([
        apiClient.get<PendingEmpties[]>(`/api/containers/customers/${customerId}`, { params: { businessId } }),
        apiClient.get<{ id: string; name: string; is_returnable?: boolean }[]>('/api/products', { params: { businessId } }),
      ]);
      setPending(p.data);
      const list = products.data.filter((x) => x.is_returnable).map((x) => ({ id: x.id, name: x.name }));
      setReturnables(list);
      setProductId((cur) => cur || p.data[0]?.productId || list[0]?.id || '');
    } catch {
      // Offline or failed: leave whatever is shown; recording a return still queues below.
    }
  }, [businessId, customerId]);

  useEffect(() => {
    setPending([]);
    setProductId('');
    setMessage('');
    setError('');
    load();
  }, [load]);

  const record = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!productId || !(qty > 0)) {
      setError('Pick a product and a quantity above 0.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    const payload = { customerId, productId, quantity: qty };
    try {
      await apiClient.post('/api/containers/returns', { businessId, ...payload });
      setMessage(`Recorded ${qty} returned.`);
      await load();
    } catch (err: any) {
      if (isNetworkError(err)) {
        // Offline: queue it and show the expected balance right away.
        await enqueueContainerReturn(businessId, payload);
        setPending((cur) =>
          cur
            .map((i) => (i.productId === productId ? { ...i, pending: Math.max(0, i.pending - qty) } : i))
            .filter((i) => i.pending > 0),
        );
        setMessage(`Saved offline — ${qty} returned will sync when you are back online.`);
      } else {
        setError(err.response?.data?.message || 'Could not record the return.');
        setSaving(false);
        return;
      }
    }
    setQuantity('1');
    setSaving(false);
    onChanged?.();
  };

  if (pending.length === 0 && returnables.length === 0) return null;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3" data-testid="customer-empties">
      <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
        <Droplets className="w-3.5 h-3.5 text-sky-600" /> Empties
      </p>
      {pending.length === 0 ? (
        <p className="text-sm text-slate-500">No empties pending.</p>
      ) : (
        <ul className="space-y-1">
          {pending.map((i) => (
            <li key={i.productId} className="flex justify-between text-sm">
              <span className="text-slate-700">{i.productName}</span>
              <span className="font-bold text-sky-700">{i.pending} pending</span>
            </li>
          ))}
        </ul>
      )}
      {returnables.length > 0 && (
        <form onSubmit={record} className="flex items-center gap-2 flex-wrap">
          <select
            aria-label="Returned product"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            {returnables.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <Input
            aria-label="Quantity returned"
            type="number"
            inputMode="numeric"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-20"
          />
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving...' : 'Record returned empties'}
          </Button>
        </form>
      )}
      {message && <p className="text-xs text-emerald-700 font-medium">{message}</p>}
      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
    </div>
  );
}
