'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import apiClient from './api-client';

/**
 * Registers this device for Android push (FCM) once businessId is known, and
 * hands the resulting token to the backend so the existing notification
 * sweep (order/payment reminders, low stock, expiry alerts — see
 * notifications.service.ts) can push to it instantly instead of relying on
 * the in-app bell's 60s poll, which only works while the app is open. A
 * no-op entirely on web — there's no FCM token to register there, same
 * pattern as useNativeAppUpdate.
 *
 * Requires FIREBASE_SERVICE_ACCOUNT configured on the API and a real device
 * (the emulator/dev server has no signed google-services.json wired up) —
 * harmless either way, registration just silently does nothing.
 */
export function usePushNotifications(businessId: string | null) {
  const registeredToken = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !businessId) return;

    let cancelled = false;
    const registrationListener = PushNotifications.addListener('registration', async (token) => {
      if (cancelled) return;
      registeredToken.current = token.value;
      try {
        await apiClient.post('/api/notifications/device-token', {
          businessId,
          token: token.value,
          platform: Capacitor.getPlatform(),
        });
      } catch {
        // Offline or a transient failure — the next app open re-registers anyway.
      }
    });
    const errorListener = PushNotifications.addListener('registrationError', (err) => {
      console.error('[push] registration failed', err.error);
    });

    (async () => {
      const current = await PushNotifications.checkPermissions();
      let granted = current.receive === 'granted';
      if (current.receive === 'prompt') {
        const requested = await PushNotifications.requestPermissions();
        granted = requested.receive === 'granted';
      }
      if (!cancelled && granted) {
        await PushNotifications.register();
      }
    })();

    return () => {
      cancelled = true;
      registrationListener.then((l) => l.remove());
      errorListener.then((l) => l.remove());
    };
  }, [businessId]);

  return {
    // Call on logout so a signed-out device stops receiving another user's
    // (or the same user's next login's) alerts. Best-effort: a token left
    // behind after a failed unregister call just gets pruned server-side the
    // next time a push to it bounces as invalid.
    unregister: async () => {
      if (!Capacitor.isNativePlatform() || !businessId || !registeredToken.current) return;
      try {
        await apiClient.delete('/api/notifications/device-token', { data: { businessId, token: registeredToken.current } });
      } catch {
        // Best-effort, see above.
      }
    },
  };
}
