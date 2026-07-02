'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { Sparkles, X, Check, PackageSearch } from 'lucide-react';

interface DraftProduct {
  id: string;
  name: string;
  unit: string;
  selling_price: string | number;
  purchase_price: string | number | null;
  tax_percentage: string | number;
  category: string | null;
}

const SWIPE_THRESHOLD = 110;

/**
 * Quick Parchi free-text items get saved instantly as a draft Product
 * (see orders.service.ts:findOrCreateProductFromCustomName) so the order
 * never blocks on catalog admin. This is where the merchant catches up:
 * swipe right to keep it in the catalog (optionally fixing category/price),
 * swipe left to discard a one-off/typo.
 */
export function DraftReviewStack({ businessId }: { businessId: string | null }) {
  const [drafts, setDrafts] = useState<DraftProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [dragX, setDragX] = useState(0);
  const [exiting, setExiting] = useState<'left' | 'right' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dragStartX = useRef<number | null>(null);

  const loadDrafts = (bizId: string) => {
    setLoading(true);
    apiClient
      .get<DraftProduct[]>('/api/products', { params: { businessId: bizId, isDraft: 'true' } })
      .then((res) => setDrafts(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!businessId) return;
    loadDrafts(businessId);
  }, [businessId]);

  const current = drafts[0];

  useEffect(() => {
    setCategory(current?.category || '');
    setSellingPrice(current ? String(current.selling_price) : '');
    setError('');
  }, [current?.id]);

  const advance = () => {
    setDrafts((prev) => prev.slice(1));
    setDragX(0);
    setExiting(null);
    setBusy(false);
  };

  const resetCard = () => {
    setExiting(null);
    setDragX(0);
    setBusy(false);
  };

  const resolveDraft = (action: 'approve' | 'reject') => {
    if (!current || busy) return;
    setBusy(true);
    setExiting(action === 'approve' ? 'right' : 'left');
    setError('');

    // "Discard" can't hard-delete: every draft was created from an order
    // item that still points at this product row, so a DELETE would always
    // fail on the FK constraint (and would corrupt that order's history if
    // it somehow succeeded). Archiving it instead keeps the row valid for
    // the order while hiding it from the catalog and this review queue.
    const request =
      action === 'approve'
        ? apiClient.patch(
            `/api/products/${current.id}`,
            {
              isDraft: false,
              category: category || undefined,
              sellingPrice: sellingPrice ? Number(sellingPrice) : undefined,
            },
            { params: { businessId } },
          )
        : apiClient.patch(
            `/api/products/${current.id}`,
            { isDraft: false, isAvailable: false },
            { params: { businessId } },
          );

    // Only drop the card from the stack once the backend confirms the
    // change — otherwise a failed request would look like it succeeded
    // while the product silently stays a draft.
    request
      .then(() => {
        setTimeout(advance, 180);
      })
      .catch(() => {
        setError("Couldn't save — try again");
        resetCard();
      });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (busy) return;
    dragStartX.current = e.clientX;
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    setDragX(e.clientX - dragStartX.current);
  };
  const handlePointerUp = () => {
    if (dragStartX.current === null) return;
    dragStartX.current = null;
    if (dragX > SWIPE_THRESHOLD) {
      resolveDraft('approve');
    } else if (dragX < -SWIPE_THRESHOLD) {
      resolveDraft('reject');
    } else {
      setDragX(0);
    }
  };

  if (loading || drafts.length === 0) return null;

  const translateX = exiting === 'right' ? 500 : exiting === 'left' ? -500 : dragX;
  const rotate = translateX / 18;

  return (
    <Card className="ring-white/50 glass-sheen-sm overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <p className="text-sm font-semibold text-slate-800">Review Quick Parchi items</p>
          <span className="ml-auto text-xs font-medium text-slate-400">{drafts.length} pending</span>
        </div>

        <div className="relative h-[260px] select-none">
          {drafts.slice(1, 3).reverse().map((d, i) => (
            <div
              key={d.id}
              className="absolute inset-x-0 top-0 rounded-[2rem] border border-white/50 bg-white/20 backdrop-blur-md"
              style={{
                height: '100%',
                transform: `scale(${0.94 + i * 0.03}) translateY(${(1 - i) * 10}px)`,
                zIndex: i,
              }}
            />
          ))}

          <div
            className="absolute inset-x-0 top-0 h-full rounded-[2rem] border border-white/60 bg-white/60 backdrop-blur-3xl backdrop-saturate-150 glass-sheen shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-5 flex flex-col cursor-grab active:cursor-grabbing touch-none"
            style={{
              transform: `translateX(${translateX}px) rotate(${rotate}deg)`,
              transition: dragStartX.current === null ? 'transform 180ms ease-out' : 'none',
              zIndex: 10,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <div
              className="absolute top-4 left-4 px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-700 text-xs font-bold border border-rose-500/30 backdrop-blur-md transition-opacity shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]"
              style={{ opacity: dragX < 0 ? Math.min(-dragX / SWIPE_THRESHOLD, 1) : 0 }}
            >
              DISCARD
            </div>
            <div
              className="absolute top-4 right-4 px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-700 text-xs font-bold border border-emerald-500/30 backdrop-blur-md transition-opacity shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]"
              style={{ opacity: dragX > 0 ? Math.min(dragX / SWIPE_THRESHOLD, 1) : 0 }}
            >
              KEEP
            </div>

            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <PackageSearch className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wide">From a recent order</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-4 truncate">{current?.name}</h3>

            <div className="space-y-3 flex-1">
              <div>
                <label className="text-xs font-medium text-slate-500">Category</label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Medicine, Dairy, Snacks"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Selling price</label>
                <Input
                  type="number"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-center text-xs text-rose-600 mt-3">{error}</p>}

        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => resolveDraft('reject')}
            disabled={busy}
            className="w-14 h-14 rounded-full border border-rose-500/30 bg-rose-500/10 backdrop-blur-md text-rose-600 flex items-center justify-center hover:bg-rose-500/20 transition-all disabled:opacity-50 ring-1 ring-white/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6)]"
            aria-label="Discard"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={() => resolveDraft('approve')}
            disabled={busy}
            className="w-14 h-14 rounded-full border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md text-emerald-600 flex items-center justify-center hover:bg-emerald-500/20 transition-all disabled:opacity-50 ring-1 ring-white/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6)]"
            aria-label="Keep and save"
          >
            <Check className="w-5 h-5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
