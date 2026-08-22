import { create } from 'zustand';
import { useEffect } from 'react';
import apiClient from '@/lib/api-client';
import {
  enqueueOutboxItem,
  listOutbox,
  updateOutboxItem,
  deleteOutboxItem,
  type OutboxItem,
} from '@/lib/offline-db';

/** True when an axios error has no `response` — i.e. the request never reached the server (offline, DNS, timeout). */
export function isNetworkError(err: any): boolean {
  return !err?.response;
}

/**
 * Quick reachability probe against the API's public health endpoint — the
 * real signal for whether we can actually talk to the server.
 * `navigator.onLine` (used for the initial/event-driven state below) only
 * reflects whether SOME network interface has link, which is notoriously
 * unreliable in Android WebViews: it can read false with a perfectly
 * working connection (the reported "offline while network is connected"
 * bug), or true on a Wi-Fi network with no real internet. Short timeout so
 * a genuinely dead connection still resolves quickly rather than hanging
 * the offline banner in a stuck "checking" state.
 */
export async function probeApiReachable(): Promise<boolean> {
  try {
    await apiClient.get('/health', { timeout: 6000 });
    return true;
  } catch {
    return false;
  }
}

interface OfflineState {
  isOnline: boolean;
  syncing: boolean;
  pendingCount: number;
  items: OutboxItem[];
  setOnline: (online: boolean) => void;
  refresh: (businessId: string) => Promise<void>;
  enqueueOrder: (businessId: string, payload: Record<string, unknown>) => Promise<OutboxItem>;
  enqueuePayment: (
    businessId: string,
    payload: Record<string, unknown> & { orderId?: string },
    localOrderId?: string,
  ) => Promise<OutboxItem>;
  syncNow: (businessId: string) => Promise<void>;
  /** Removes a queued/failed item permanently — e.g. a sale the user has given up on retrying. Also drops any queued payment that depended on a discarded order, since it can never resolve. */
  discardItem: (businessId: string, id: string) => Promise<void>;
  /** Clears a failed item's error and re-runs the sync pass, which will pick it back up. */
  retryItem: (businessId: string, id: string) => Promise<void>;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  pendingCount: 0,
  items: [],

  setOnline: (online) => set({ isOnline: online }),

  refresh: async (businessId: string) => {
    const items = await listOutbox(businessId);
    const pendingCount = items.filter((i) => i.status === 'pending' || i.status === 'failed').length;
    set({ items, pendingCount });
  },

  enqueueOrder: async (businessId, payload) => {
    const item = await enqueueOutboxItem({ type: 'order', businessId, payload });
    await get().refresh(businessId);
    return item;
  },

  enqueuePayment: async (businessId, payload, localOrderId) => {
    const { orderId, ...rest } = payload;
    const item = await enqueueOutboxItem({
      type: 'payment',
      businessId,
      dependsOnLocalOrderId: localOrderId,
      payload: localOrderId ? rest : { ...rest, orderId },
    });
    await get().refresh(businessId);
    return item;
  },

  syncNow: async (businessId: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (get().syncing) return;
    set({ syncing: true });
    try {
      const items = await listOutbox(businessId);
      const localToServerOrderId = new Map<string, string>();
      for (const item of items) {
        if (item.status === 'synced' || item.status === 'syncing') {
          if (item.type === 'order' && item.serverId) localToServerOrderId.set(item.id, item.serverId);
          continue;
        }

        // A payment for an order that itself hasn't synced yet — skip until the order lands.
        if (item.type === 'payment' && item.dependsOnLocalOrderId && !localToServerOrderId.has(item.dependsOnLocalOrderId)) {
          continue;
        }

        await updateOutboxItem(item.id, { status: 'syncing' });
        try {
          if (item.type === 'order') {
            const res = await apiClient.post('/api/orders', {
              ...item.payload,
              clientRequestId: item.clientRequestId,
            });
            await updateOutboxItem(item.id, {
              status: 'synced',
              serverId: res.data.id,
              serverOrderNumber: res.data.order_number,
            });
            localToServerOrderId.set(item.id, res.data.id);
          } else {
            const resolvedOrderId =
              (item.payload.orderId as string | undefined) ||
              (item.dependsOnLocalOrderId ? localToServerOrderId.get(item.dependsOnLocalOrderId) : undefined);
            if (!resolvedOrderId) {
              await updateOutboxItem(item.id, { status: 'pending' });
              continue;
            }
            const res = await apiClient.post('/api/billing/payments', {
              ...item.payload,
              orderId: resolvedOrderId,
              clientRequestId: item.clientRequestId,
            });
            await updateOutboxItem(item.id, { status: 'synced', serverId: res.data.id });
          }
        } catch (err: any) {
          if (isNetworkError(err)) {
            // Connection dropped again mid-sync — leave it pending and stop this pass.
            await updateOutboxItem(item.id, { status: 'pending' });
            break;
          }
          await updateOutboxItem(item.id, {
            status: 'failed',
            error: err.response?.data?.message || 'Failed to sync — needs attention',
          });
        }
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('order-updated'));
      }
    } finally {
      set({ syncing: false });
      await get().refresh(businessId);
    }
  },

  discardItem: async (businessId: string, id: string) => {
    const items = await listOutbox(businessId);
    const dependents = items.filter((i) => i.type === 'payment' && i.dependsOnLocalOrderId === id);
    await Promise.all([id, ...dependents.map((d) => d.id)].map((itemId) => deleteOutboxItem(itemId)));
    await get().refresh(businessId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('order-updated'));
    }
  },

  retryItem: async (businessId: string, id: string) => {
    await updateOutboxItem(id, { status: 'pending', error: undefined });
    await get().refresh(businessId);
    await get().syncNow(businessId);
  },
}));

/** Wire window online/offline events to the store and auto-sync whenever connectivity returns. */
export function useOfflineSync(businessId: string | null) {
  const refresh = useOfflineStore((s) => s.refresh);
  const setOnline = useOfflineStore((s) => s.setOnline);
  const syncNow = useOfflineStore((s) => s.syncNow);

  useEffect(() => {
    if (!businessId) return;
    refresh(businessId);

    const handleOnline = () => {
      setOnline(true);
      syncNow(businessId);
    };
    // The browser's 'offline' event (and navigator.onLine generally) is
    // unreliable in Android WebViews — it can fire even with a perfectly
    // working connection. Verify with a real request before trusting it and
    // showing the offline banner, rather than believing it outright.
    const handleOffline = () => {
      probeApiReachable().then((reachable) => {
        setOnline(reachable);
        if (reachable) syncNow(businessId);
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Progressive enhancement: ask the browser to wake the SW's `sync` event
    // once connectivity returns, for the case where the tab itself is backgrounded.
    // Safari has no Background Sync support at all, so the online/offline
    // listeners above remain the reliable, universal path.
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then((reg) => (reg as any).sync?.register('sync-outbox'))
        .catch(() => {});
    }

    if (navigator.onLine) {
      syncNow(businessId);
    } else {
      // navigator.onLine can read false right from mount even when the
      // connection is actually fine — same unreliability as handleOffline
      // above, so verify before showing "offline" here too.
      probeApiReachable().then((reachable) => {
        setOnline(reachable);
        if (reachable) syncNow(businessId);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [businessId, refresh, setOnline, syncNow]);
}
