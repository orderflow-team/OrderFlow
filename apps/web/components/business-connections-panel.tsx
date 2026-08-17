'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { Link2, Check, X, Loader2, RefreshCw } from 'lucide-react';

interface ConnectionSummary {
  id: string;
  status: string;
  myRole: 'retailer' | 'wholesaler';
  initiatedByMe: boolean;
  counterpartBusinessId: string;
  counterpartName: string;
  counterpartPhone: string | null;
  createdAt: string;
}

interface ConnectionsResponse {
  connections: ConnectionSummary[];
  incomingRequests: ConnectionSummary[];
  outgoingRequests: ConnectionSummary[];
}

const ROLE_COPY: Record<'retailer' | 'wholesaler', { verb: string; counterpart: string; placeholder: string }> = {
  retailer: { verb: 'Connect a wholesaler', counterpart: 'wholesaler', placeholder: "Wholesaler's mobile number" },
  wholesaler: { verb: 'Connect a retailer', counterpart: 'retailer', placeholder: "Retailer's mobile number" },
};

/**
 * Embedded on the Suppliers page (role="retailer") and Customers page
 * (role="wholesaler") — lets a business find a real counterpart OBIX
 * business by phone and link accounts, so purchase orders/orders raised
 * against the linked contact auto-sync between both businesses (see
 * business-connections module on the API).
 */
export function BusinessConnectionsPanel({ businessId, role }: { businessId: string; role: 'retailer' | 'wholesaler' }) {
  const [data, setData] = useState<ConnectionsResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [resyncingId, setResyncingId] = useState<string | null>(null);

  const copy = ROLE_COPY[role];

  const load = async () => {
    try {
      const res = await apiClient.get<ConnectionsResponse>('/api/business-connections', { params: { businessId } });
      setData(res.data);
    } catch {
      // Non-critical widget — a failed load just hides the panel's lists.
    }
  };

  useEffect(() => {
    if (businessId) load();
  }, [businessId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    setNotice('');
    try {
      await apiClient.post('/api/business-connections/request', { businessId, targetPhone: phone, role });
      setPhone('');
      setShowForm(false);
      setNotice('Request sent — waiting for them to accept.');
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send connection request');
    } finally {
      setSending(false);
    }
  };

  const respond = async (id: string, action: 'accept' | 'reject') => {
    setRespondingId(id);
    setError('');
    try {
      await apiClient.post(`/api/business-connections/${id}/${action}`, { businessId });
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to ${action} request`);
    } finally {
      setRespondingId(null);
    }
  };

  // Catches up a connection accepted before an order/PO existed to mirror, or
  // one whose mirror otherwise failed to attach — same backfill accept() now
  // runs automatically, just replayable on demand for already-linked pairs.
  const resync = async (id: string) => {
    setResyncingId(id);
    setError('');
    setNotice('');
    try {
      await apiClient.post(`/api/business-connections/${id}/resync`, { businessId });
      setNotice('Checked for missed orders — any found are now synced.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to sync');
    } finally {
      setResyncingId(null);
    }
  };

  const hasAnything = data && (data.connections.length > 0 || data.incomingRequests.length > 0 || data.outgoingRequests.length > 0);

  return (
    <Card className="ring-white/50 glass-sheen-sm border-dashed border-sky-400/30 bg-sky-50/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
            <Link2 className="w-4 h-4 text-sky-600" /> OBIX Business Network
          </p>
          {!showForm && (
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(true)} className="h-8 text-xs font-semibold">
              {copy.verb}
            </Button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSend} className="flex flex-wrap gap-2 items-start">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={copy.placeholder}
              required
              className="h-9 text-sm flex-1 min-w-[180px] bg-white"
            />
            <Button type="submit" size="sm" disabled={sending} className="h-9 text-xs font-semibold">
              {sending ? 'Sending...' : 'Send request'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setError(''); }} className="h-9 text-xs">
              Cancel
            </Button>
          </form>
        )}

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        {notice && <p className="text-xs text-emerald-600 font-medium">{notice}</p>}
        <p className="text-[11px] text-slate-400">
          Both businesses must be on OBIX. Enter the {copy.counterpart}'s registered mobile number — they'll get a request to accept.
        </p>

        {data && data.incomingRequests.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Pending requests</p>
            {data.incomingRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 bg-white/70 rounded-xl px-3 py-2">
                <span className="text-xs text-slate-700 truncate">
                  <span className="font-semibold">{r.counterpartName}</span> wants to connect as a {r.myRole === 'retailer' ? 'wholesaler supplying to you' : 'retailer buying from you'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    disabled={respondingId === r.id}
                    onClick={() => respond(r.id, 'accept')}
                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                    title="Accept"
                  >
                    {respondingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    disabled={respondingId === r.id}
                    onClick={() => respond(r.id, 'reject')}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                    title="Reject"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {data && data.outgoingRequests.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Waiting on them</p>
            {data.outgoingRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 bg-white/50 rounded-xl px-3 py-2">
                <span className="text-xs text-slate-600 truncate">{r.counterpartName}</span>
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-100/80 px-2 py-0.5 rounded-full shrink-0">Pending</span>
              </div>
            ))}
          </div>
        )}

        {data && data.connections.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Linked businesses</p>
            {data.connections.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 bg-white/50 rounded-xl px-3 py-2">
                <span className="text-xs text-slate-700 truncate">
                  {c.counterpartName} <span className="text-slate-400">({c.myRole === 'retailer' ? 'your wholesaler' : 'your retailer'})</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    disabled={resyncingId === c.id}
                    onClick={() => resync(c.id)}
                    title="Check for orders placed before this connection was linked"
                    className="p-1 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 disabled:opacity-50"
                  >
                    {resyncingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">Linked</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasAnything && !showForm && (
          <p className="text-xs text-slate-400">Not connected to any {copy.counterpart}s yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
