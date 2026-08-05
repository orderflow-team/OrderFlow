'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Purely informational — lets a user read off their version when reporting an issue. No UI on web (there's no separate "version" there, it's just the site). */
export function AppVersionInfo() {
  const [info, setInfo] = useState<{ native: string; bundle: string } | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    CapacitorUpdater.current()
      .then(({ bundle, native }) => setInfo({ native, bundle: bundle.version }))
      .catch(() => {});
  }, []);

  if (!info) return null;

  return (
    <Card className="ring-white/50 glass-sheen-sm">
      <CardHeader>
        <CardTitle className="text-base">About</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">App version {info.native}</p>
        {info.bundle !== 'builtin' && info.bundle !== info.native && (
          <p className="text-xs text-slate-400 mt-0.5">Update {info.bundle} installed</p>
        )}
      </CardContent>
    </Card>
  );
}
