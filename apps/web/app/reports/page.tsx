'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { getCachedBusinessCategory, getCachedInventoryEnabled } from '@/lib/auth';
import { ReportTabBar } from './report-tab-bar';
import { PeriodSelector } from './period-selector';
import { OverviewTab } from './overview-tab';
import { CustomersTab } from './customers-tab';
import { ProductsTab } from './products-tab';
import { SuppliersTab } from './suppliers-tab';
import { FinanceTab } from './finance-tab';
import { OperationsTab } from './operations-tab';
import type { AnalyticsPayload, OutstandingCustomer } from './types';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'customers', label: 'Customers' },
  { id: 'products', label: 'Products & Inventory' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'finance', label: 'Finance' },
  { id: 'operations', label: 'Operations' },
];

export default function ReportsPage() {
  const { businessId, ready } = useBusiness();
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [days, setDays] = useState(30);

  const load = useCallback((bizId: string, selectedDays: number) => {
    setLoading(true);
    Promise.all([
      apiClient.get<AnalyticsPayload>('/api/reports/analytics', { params: { businessId: bizId, days: selectedDays } }),
      apiClient.get<OutstandingCustomer[]>('/api/reports/outstanding', { params: { businessId: bizId } }),
    ])
      .then(([analyticsRes, outstandingRes]) => {
        setAnalytics(analyticsRes.data);
        setOutstanding(outstandingRes.data);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load reports'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!ready || !businessId) return;
    load(businessId, days);
  }, [ready, businessId, days, load]);

  if (!ready) return null;

  // Prefer the fresh values the analytics response just computed server-side;
  // fall back to the cached ones only before the first load completes.
  const category = analytics ? analytics.meta.category : (businessId ? getCachedBusinessCategory(businessId) : null);
  const inventoryEnabled = analytics
    ? analytics.meta.inventoryEnabled
    : (businessId ? getCachedInventoryEnabled(businessId) ?? true : true);
  const showExpiry = inventoryEnabled && category !== 'restaurant';
  const isPharmacy = category === 'pharmacy';

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
        <PageHeader title="Analytics" description="Every angle on the business — sales, purchases, customers, products, suppliers, and finance." />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <ReportTabBar tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />
          <PeriodSelector days={days} onChange={setDays} />
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <>
            {activeTab === 'overview' && <OverviewTab analytics={analytics} days={days} inventoryEnabled={inventoryEnabled} showExpiry={showExpiry} isPharmacy={isPharmacy} />}
            {activeTab === 'customers' && <CustomersTab analytics={analytics} outstanding={outstanding} days={days} />}
            {activeTab === 'products' && <ProductsTab analytics={analytics} isPharmacy={isPharmacy} days={days} inventoryEnabled={inventoryEnabled} showExpiry={showExpiry} />}
            {activeTab === 'suppliers' && <SuppliersTab analytics={analytics} days={days} />}
            {activeTab === 'finance' && businessId && (
              <FinanceTab analytics={analytics} businessId={businessId} days={days} onExpenseChanged={() => load(businessId, days)} />
            )}
            {activeTab === 'operations' && <OperationsTab analytics={analytics} days={days} />}
          </>
        )}
      </div>
    </AppShell>
  );
}
