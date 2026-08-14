'use client';

import { useCallback, useState } from 'react';
import apiClient from '@/lib/api-client';

type ConnectionStatus = 'none' | 'pending' | 'accepted' | 'rejected';

interface PhoneMatch {
  businessId: string;
  name: string;
}

/**
 * Checks a phone number against real OBIX businesses (GET /api/business-connections/check-phone)
 * and lets the caller send a connection request right from wherever the number was
 * typed — Supplier/Customer forms, placing an order — instead of only from the
 * dedicated Business Network panel. Mirrors the phone-lookup logic already used
 * there (business-connections-panel.tsx / business-connections.service.ts) but as a
 * lightweight nudge rather than a search flow.
 */
export function useObixPhoneMatch(businessId: string | null) {
  const [match, setMatch] = useState<PhoneMatch | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none');
  const [checking, setChecking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const check = useCallback(
    async (phone: string) => {
      if (!businessId || phone.replace(/\D/g, '').length < 10) {
        setMatch(null);
        setConnectionStatus('none');
        return;
      }
      setChecking(true);
      try {
        const res = await apiClient.get<{ match: PhoneMatch | null; connectionStatus: ConnectionStatus }>(
          '/api/business-connections/check-phone',
          { params: { businessId, phone } },
        );
        setMatch(res.data.match);
        setConnectionStatus(res.data.connectionStatus);
      } catch {
        // Non-critical nudge — a failed check just means no banner shows.
        setMatch(null);
        setConnectionStatus('none');
      } finally {
        setChecking(false);
      }
    },
    [businessId],
  );

  const connect = useCallback(
    async (role: 'retailer' | 'wholesaler', phone: string) => {
      if (!businessId) return;
      setConnecting(true);
      setError('');
      try {
        await apiClient.post('/api/business-connections/request', { businessId, targetPhone: phone, role });
        setConnectionStatus('pending');
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to send connection request');
      } finally {
        setConnecting(false);
      }
    },
    [businessId],
  );

  const dismiss = useCallback(() => {
    setMatch(null);
    setConnectionStatus('none');
    setError('');
  }, []);

  return { match, connectionStatus, checking, connecting, error, check, connect, dismiss };
}
