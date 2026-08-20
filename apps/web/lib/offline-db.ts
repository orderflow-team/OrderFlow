import { openDB, type IDBPDatabase } from 'idb';

/**
 * Offline persistence for the counter/billing screen: a per-business cache of
 * the product/category/customer catalog (so the screen can still load and a
 * cart can still be built with zero network), and an outbox of orders/payments
 * created while offline, replayed once connectivity returns.
 */

const DB_NAME = 'orderflow-offline';
const DB_VERSION = 1;
const CACHE_STORE = 'cache';
const OUTBOX_STORE = 'outbox';

export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OutboxOrderItem {
  id: string;
  type: 'order';
  status: OutboxStatus;
  businessId: string;
  clientRequestId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  serverId?: string;
  serverOrderNumber?: string;
  error?: string;
}

export interface OutboxPaymentItem {
  id: string;
  type: 'payment';
  status: OutboxStatus;
  businessId: string;
  clientRequestId: string;
  /** If the payment is for an order that was itself queued offline, this points at that order's local outbox id. */
  dependsOnLocalOrderId?: string;
  payload: Record<string, unknown>;
  createdAt: number;
  serverId?: string;
  error?: string;
}

export type OutboxItem = OutboxOrderItem | OutboxPaymentItem;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE);
        }
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          const store = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
          store.createIndex('status', 'status');
          store.createIndex('businessId', 'businessId');
        }
      },
    });
  }
  return dbPromise;
}

const cacheKey = (businessId: string, name: string) => `${businessId}:${name}`;

export async function getCached<T>(businessId: string, name: string): Promise<T | undefined> {
  try {
    const db = await getDb();
    return await db.get(CACHE_STORE, cacheKey(businessId, name));
  } catch {
    return undefined;
  }
}

export async function setCached<T>(businessId: string, name: string, value: T): Promise<void> {
  try {
    const db = await getDb();
    await db.put(CACHE_STORE, value, cacheKey(businessId, name));
  } catch {
    // Best-effort — a caching failure shouldn't break the live path.
  }
}

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueOutboxItem(
  item:
    | Omit<OutboxOrderItem, 'id' | 'status' | 'createdAt' | 'clientRequestId'>
    | Omit<OutboxPaymentItem, 'id' | 'status' | 'createdAt' | 'clientRequestId'>,
): Promise<OutboxItem> {
  const id = makeId();
  const full = {
    ...item,
    id,
    clientRequestId: id,
    status: 'pending' as OutboxStatus,
    createdAt: Date.now(),
  } as OutboxItem;
  const db = await getDb();
  await db.put(OUTBOX_STORE, full);
  return full;
}

export async function listOutbox(businessId?: string): Promise<OutboxItem[]> {
  try {
    const db = await getDb();
    const all: OutboxItem[] = await db.getAll(OUTBOX_STORE);
    const filtered = businessId ? all.filter((i) => i.businessId === businessId) : all;
    return filtered.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function updateOutboxItem(id: string, patch: Partial<OutboxItem>): Promise<void> {
  const db = await getDb();
  const existing = await db.get(OUTBOX_STORE, id);
  if (!existing) return;
  await db.put(OUTBOX_STORE, { ...existing, ...patch });
}

export async function deleteOutboxItem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(OUTBOX_STORE, id);
}

export async function pendingOutboxCount(businessId?: string): Promise<number> {
  const items = await listOutbox(businessId);
  return items.filter((i) => i.status === 'pending' || i.status === 'failed').length;
}
