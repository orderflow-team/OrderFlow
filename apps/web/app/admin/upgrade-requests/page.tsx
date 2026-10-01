'use client';

import React, { useEffect, useState } from 'react';
import { Crown, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface UpgradeRequestRow {
  id: string;
  business_id: string;
  business_name: string;
  business_phone: string | null;
  requested_by_email: string | null;
  plan_code: string;
  plan_name: string | null;
  billing_cycle: 'monthly' | 'yearly';
  price_monthly_inr: string | null;
  price_yearly_inr: string | null;
  created_at: string;
}

/**
 * Shops can't activate a paid plan themselves (there's no payment gateway).
 * They send an upgrade request from Settings → Subscription; once the shop has
 * paid (UPI/cash), approve it here to activate the plan for one billing cycle.
 */
export default function AdminUpgradeRequestsPage() {
  const [requests, setRequests] = useState<UpgradeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<UpgradeRequestRow[]>('/api/subscriptions/upgrade-requests');
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setNotice(err.response?.data?.message || 'Could not load upgrade requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const amountFor = (r: UpgradeRequestRow) => {
    const raw = r.billing_cycle === 'yearly' ? r.price_yearly_inr : r.price_monthly_inr;
    return raw ? `₹${Number(raw).toLocaleString('en-IN')}/${r.billing_cycle === 'yearly' ? 'year' : 'month'}` : '—';
  };

  const resolve = async (r: UpgradeRequestRow, action: 'approve' | 'reject') => {
    const question =
      action === 'approve'
        ? `Activate ${r.plan_name || r.plan_code} (${r.billing_cycle}) for ${r.business_name}? Only approve after the payment of ${amountFor(r)} has been received.`
        : `Reject the upgrade request from ${r.business_name}?`;
    if (!confirm(question)) return;
    setBusyId(r.id);
    setNotice('');
    try {
      await apiClient.post(`/api/subscriptions/upgrade-requests/${r.id}/${action}`);
      setNotice(
        action === 'approve'
          ? `${r.business_name} is now on ${r.plan_name || r.plan_code}.`
          : `Rejected the request from ${r.business_name}.`,
      );
      await fetchRequests();
    } catch (err: any) {
      setNotice(err.response?.data?.message || `Could not ${action} the request.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Crown className="w-7 h-7 text-amber-500" />
            Upgrade Requests
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Shops waiting for a paid plan. Approve only after you&apos;ve received their payment.
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground text-sm font-medium rounded-xl border border-border transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {notice && (
        <div className="bg-card border border-border text-foreground px-4 py-3 rounded-xl text-sm">{notice}</div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="px-4 py-3 font-semibold">Shop</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Amount due</th>
              <th className="px-4 py-3 font-semibold">Requested</th>
              <th className="px-4 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {!loading && requests.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No pending upgrade requests.
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-semibold text-foreground">{r.business_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[r.business_phone, r.requested_by_email].filter(Boolean).join(' · ') || '—'}
                  </div>
                </td>
                <td className="px-4 py-3 text-foreground">
                  {r.plan_name || r.plan_code} <span className="text-muted-foreground">({r.billing_cycle})</span>
                </td>
                <td className="px-4 py-3 tabular-nums text-foreground">{amountFor(r)}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => resolve(r, 'approve')}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => resolve(r, 'reject')}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent text-foreground border border-border text-xs font-semibold disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
