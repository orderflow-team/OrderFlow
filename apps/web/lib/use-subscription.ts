'use client';

import { useState, useEffect } from 'react';
import apiClient from './api-client';

export interface SubscriptionData {
  status: 'trialing' | 'active' | 'past_due' | 'expired' | 'canceled';
  planCode: string;
  planName: string;
  trialDaysLeft: number;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  quotas: {
    ordersUsedThisMonth: number;
    maxOrdersPerMonth: number;
    aiScansUsedThisMonth: number;
    maxAiScansPerMonth: number;
    staffUsersCount: number;
    maxStaffUsers: number;
  };
  features: Record<string, boolean>;
}

export function useSubscription() {
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/subscriptions/current');
      setSub(res.data);
    } catch (err) {
      console.error('Failed to fetch subscription in useSubscription hook:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const planCode = sub?.planCode || 'starter';
  const isStarter = planCode === 'starter';
  const isPro = planCode === 'pro';
  const isEnterprise = planCode === 'enterprise';
  const isTrial = sub?.status === 'trialing';
  const isExpired = sub?.status === 'expired' || sub?.status === 'past_due' || sub?.status === 'canceled';

  return {
    sub,
    loading,
    refreshSubscription: fetchSubscription,
    planCode,
    isStarter,
    isPro,
    isEnterprise,
    isTrial,
    isExpired,
  };
}
