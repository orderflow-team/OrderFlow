'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api-client';
import { formatCurrency } from '@/lib/format-currency';
import { buildCsv, dateRangePreset, downloadCsv, printReport } from '@/lib/report-export';
import { DateRangeBar } from './date-range-bar';

const BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;
type Kind = 'receivable' | 'payable';
type Buckets = Record<(typeof BUCKETS)[number], number>;

interface AgeingParty {
  id: string;
  name: string;
  phone: string | null;
  outstanding: number;
  oldestDueDays: number;
  buckets: Buckets;
}
interface Ageing {
  total: number;
  buckets: Buckets;
  parties: AgeingParty[];
}
interface Ledger {
  party: { id: string; name: string };
  openingBalance: number;
  closingBalance: number;
  currentOutstanding: number;
  entries: { at: string; description: string; reference: string; debit: number; credit: number; balance: number }[];
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export function DuesLedgerTab({ businessId }: { businessId: string }) {
  const [kind, setKind] = useState<Kind>('receivable');
  const [ageing, setAgeing] = useState<Ageing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AgeingParty | null>(null);
  const [range, setRange] = useState(dateRangePreset('fy'));
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    setSelected(null);
    setLedger(null);
    apiClient
      .get<Ageing>('/api/reports/ageing', { params: { businessId, kind } })
      .then((res) => setAgeing(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dues'))
      .finally(() => setLoading(false));
  }, [businessId, kind]);

  const loadLedger = (party: AgeingParty) => {
    setLedgerLoading(true);
    setError('');
    apiClient
      .get<Ledger>('/api/reports/party-ledger', {
        params: { businessId, kind: kind === 'receivable' ? 'customer' : 'supplier', partyId: party.id, ...range },
      })
      .then((res) => setLedger(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load ledger'))
      .finally(() => setLedgerLoading(false));
  };

  const openParty = (party: AgeingParty) => {
    setSelected(party);
    setLedger(null);
    loadLedger(party);
  };

  const label = kind === 'receivable' ? 'Receivable' : 'Payable';
  const ageingHeaders = ['Party', 'Phone', 'Outstanding', ...BUCKETS.map((b) => `${b} days`), 'Oldest (days)'];
  const ageingRows = () =>
    (ageing?.parties ?? []).map((p) => [p.name, p.phone ?? '', p.outstanding, ...BUCKETS.map((b) => p.buckets[b]), p.oldestDueDays]);

  const ledgerHeaders = ['Date', 'Details', 'Reference', 'Debit', 'Credit', 'Balance'];
  const ledgerRows = () => [
    ['', 'Opening balance', '', '', '', ledger?.openingBalance ?? 0],
    ...(ledger?.entries ?? []).map((e) => [fmtDate(e.at), e.description, e.reference, e.debit || '', e.credit || '', e.balance]),
    ['', 'Closing balance', '', '', '', ledger?.closingBalance ?? 0],
  ];

  return (
    <div className="space-y-6">
      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <CardTitle className="text-base">Dues &amp; Ledger</CardTitle>
          <CardDescription>
            {kind === 'receivable' ? 'Customers who owe you' : 'Suppliers you owe'}, aged by bill date. Tap a party for its statement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['receivable', 'payable'] as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold ring-1 transition-colors ${
                  kind === k ? 'ring-emerald-500/30 text-emerald-700 bg-emerald-500/10' : 'ring-white/50 text-slate-700 bg-white/40 hover:bg-white/60'
                }`}
              >
                {k === 'receivable' ? 'Receivable (customers)' : 'Payable (suppliers)'}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" disabled={!ageing?.parties.length} onClick={() => downloadCsv(`${kind}_ageing.csv`, buildCsv(`${label} ageing`, ageingHeaders, ageingRows()))}>CSV</Button>
              <Button variant="outline" disabled={!ageing?.parties.length} onClick={() => printReport(`${label} ageing`, `Total ${ageing?.total}`, ageingHeaders, ageingRows())}>Print / PDF</Button>
            </div>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {loading && <p className="text-sm text-slate-400">Loading...</p>}

          {ageing && !loading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="rounded-2xl bg-white/50 ring-1 ring-white/50 p-3">
                  <p className="text-xs text-slate-500">Total {label.toLowerCase()}</p>
                  <p className="text-lg font-extrabold text-slate-900">{formatCurrency(ageing.total)}</p>
                </div>
                {BUCKETS.map((b) => (
                  <div key={b} className="rounded-2xl bg-white/50 ring-1 ring-white/50 p-3">
                    <p className="text-xs text-slate-500">{b} days</p>
                    <p className={`text-lg font-extrabold ${b === '90+' && ageing.buckets[b] > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{formatCurrency(ageing.buckets[b])}</p>
                  </div>
                ))}
              </div>
              {ageing.parties.length === 0 ? (
                <p className="text-sm text-slate-400">Nothing outstanding.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        {ageingHeaders.map((h) => <th key={h} className="py-2 pr-4 font-semibold whitespace-nowrap">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {ageing.parties.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => openParty(p)}
                          className={`border-t border-white/40 cursor-pointer hover:bg-white/40 ${selected?.id === p.id ? 'bg-emerald-500/5' : ''}`}
                        >
                          <td className="py-2 pr-4 font-semibold">{p.name}</td>
                          <td className="py-2 pr-4">{p.phone}</td>
                          <td className="py-2 pr-4 text-right font-semibold">{formatCurrency(p.outstanding)}</td>
                          {BUCKETS.map((b) => <td key={b} className="py-2 pr-4 text-right">{p.buckets[b] ? formatCurrency(p.buckets[b]) : '–'}</td>)}
                          <td className="py-2 pr-4 text-right">{p.oldestDueDays}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="ring-white/50 glass-sheen-sm">
          <CardHeader>
            <CardTitle className="text-base">Statement — {selected.name}</CardTitle>
            <CardDescription>Opening balance, every bill and payment, closing balance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DateRangeBar
              from={range.from}
              to={range.to}
              onChange={setRange}
              onApply={() => loadLedger(selected)}
              loading={ledgerLoading}
              disabled={!ledger}
              onCsv={() => downloadCsv(`ledger_${selected.name}_${range.from}_to_${range.to}.csv`, buildCsv(`Ledger - ${selected.name}`, ledgerHeaders, ledgerRows()))}
              onPrint={() => printReport(`Ledger - ${selected.name}`, `${range.from} to ${range.to}`, ledgerHeaders, ledgerRows())}
            />
            {ledger && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        {ledgerHeaders.map((h) => <th key={h} className="py-2 pr-4 font-semibold">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-white/40 font-semibold"><td /><td className="py-2 pr-4">Opening balance</td><td /><td /><td /><td className="py-2 pr-4 text-right">{formatCurrency(ledger.openingBalance)}</td></tr>
                      {ledger.entries.map((e, i) => (
                        <tr key={i} className="border-t border-white/40">
                          <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(e.at)}</td>
                          <td className="py-2 pr-4">{e.description}</td>
                          <td className="py-2 pr-4">{e.reference}</td>
                          <td className="py-2 pr-4 text-right">{e.debit ? formatCurrency(e.debit) : ''}</td>
                          <td className="py-2 pr-4 text-right">{e.credit ? formatCurrency(e.credit) : ''}</td>
                          <td className="py-2 pr-4 text-right">{formatCurrency(e.balance)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-white/60 font-extrabold"><td /><td className="py-2 pr-4">Closing balance</td><td /><td /><td /><td className="py-2 pr-4 text-right">{formatCurrency(ledger.closingBalance)}</td></tr>
                    </tbody>
                  </table>
                </div>
                {Math.abs(ledger.closingBalance - ledger.currentOutstanding) > 0.01 && (
                  <p className="text-xs text-amber-700">
                    Current outstanding on file is {formatCurrency(ledger.currentOutstanding)}. It can differ from this statement when balances were adjusted manually
                    {kind === 'payable' ? ' or supplier payments were recorded without a bill' : ' or the period starts mid-way'}.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
