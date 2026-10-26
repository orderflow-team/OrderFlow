'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { describeEmpties, type EmptiesHolder } from '@/components/customer-empties';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { useReturnables } from '@/lib/use-returnables';

/** "Who holds empties" — customers with containers still out, most first, so the owner knows who to chase. */
export default function EmptiesReportPage() {
  const { businessId, ready } = useBusiness();
  const returnablesEnabled = useReturnables();
  const [holders, setHolders] = useState<EmptiesHolder[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready || !businessId) return;
    apiClient
      .get<EmptiesHolder[]>('/api/containers/report', { params: { businessId } })
      .then((res) => setHolders(res.data))
      .catch(() => setError('Could not load the empties report.'));
  }, [ready, businessId]);

  const total = (holders ?? []).reduce((s, h) => s + h.total, 0);

  return (
    <AppShell>
      <div className="p-4 md:p-10 max-w-3xl mx-auto space-y-6">
        <PageHeader title="Empties" description="Customers who still hold returnable containers." />
        {!returnablesEnabled && ready && (
          <p className="text-sm text-slate-500">
            Returnable containers are switched off for this business. Turn them on under Settings → business setup.
          </p>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {holders && (
          <>
            <p className="text-sm text-slate-600">
              <span className="font-bold text-slate-800">{total}</span> empties out with{' '}
              <span className="font-bold text-slate-800">{holders.length}</span> customer{holders.length === 1 ? '' : 's'}
            </p>
            {holders.length === 0 ? (
              <p className="text-sm text-slate-500">Nobody is holding empties right now.</p>
            ) : (
              <ul className="space-y-2">
                {holders.map((h) => (
                  <li key={h.customerId} className="flex items-center justify-between gap-3 bg-white/70 rounded-2xl ring-1 ring-white/50 p-3.5">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{h.customerName}</p>
                      <p className="text-xs text-slate-500 truncate">{describeEmpties(h.items)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {h.phone && (
                        <a href={`tel:${h.phone}`} className="text-xs font-semibold text-sky-700">
                          {h.phone}
                        </a>
                      )}
                      <span className="text-sm font-bold text-sky-700">{h.total}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <Link href="/customers" className="text-sm font-semibold text-sky-700">
          ← Customers
        </Link>
      </div>
    </AppShell>
  );
}
