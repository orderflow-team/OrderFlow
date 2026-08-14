'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import apiClient from '@/lib/api-client';
import { Link2, Check, X, Loader2 } from 'lucide-react';

interface IncomingRequest {
  id: string;
  myRole: 'retailer' | 'wholesaler';
  counterpartName: string;
}

// Module-level, not state: same "show once per app open" pattern as
// PostLoginUpdateAlert — survives client-side page navigation but resets on a
// real relaunch, so accepting/declining/dismissing doesn't bring it back on
// the next page.
let alertShownThisSession = false;

/**
 * Surfaces incoming OBIX business-connection requests as soon as the app is
 * opened, with Accept/Decline right there — instead of only showing up
 * passively in the "OBIX Business Network" panel on the Inventory page,
 * which someone has to know to go look at.
 */
export function PendingConnectionRequestAlert({ businessId }: { businessId: string | null }) {
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [eligible] = useState(() => !alertShownThisSession);

  useEffect(() => {
    if (!businessId || !eligible) return;
    apiClient
      .get<{ incomingRequests: IncomingRequest[] }>('/api/business-connections', { params: { businessId } })
      .then((res) => {
        if (res.data.incomingRequests.length > 0) {
          setRequests(res.data.incomingRequests);
          alertShownThisSession = true;
        }
      })
      .catch(() => {});
  }, [businessId, eligible]);

  const respond = async (id: string, action: 'accept' | 'reject') => {
    if (!businessId) return;
    setRespondingId(id);
    try {
      await apiClient.post(`/api/business-connections/${id}/${action}`, { businessId });
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // Leave it in the list on failure — they can retry here or handle it
      // later from the Business Network panel.
    } finally {
      setRespondingId(null);
    }
  };

  const open = requests.length > 0 && !dismissed;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && setDismissed(true)}>
      <DialogContent className="sm:max-w-[420px] p-6">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Link2 className="w-5 h-5 text-sky-600" /> OBIX connection request{requests.length > 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 bg-sky-50/80 ring-1 ring-sky-200/60 rounded-xl px-3 py-2.5">
              <p className="text-sm text-slate-700 min-w-0">
                <span className="font-semibold">{r.counterpartName}</span> wants to connect as a{' '}
                {r.myRole === 'retailer' ? 'wholesaler supplying to you' : 'retailer buying from you'}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={respondingId === r.id}
                  onClick={() => respond(r.id, 'accept')}
                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                  aria-label="Accept"
                >
                  {respondingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  disabled={respondingId === r.id}
                  onClick={() => respond(r.id, 'reject')}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 disabled:opacity-50 transition-colors"
                  aria-label="Decline"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
