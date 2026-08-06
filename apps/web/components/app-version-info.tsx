'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNativeAppUpdate } from '@/lib/use-native-app-update';
import { Download } from 'lucide-react';

/** Purely informational — lets a user read off their version when reporting an issue. No UI on web (there's no separate "version" there, it's just the site). */
export function AppVersionInfo() {
  const [info, setInfo] = useState<{ native: string; bundle: string } | null>(null);
  const { available, latest, installing, error, install } = useNativeAppUpdate();

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
        <p className="text-sm text-slate-600">
          App version {info.bundle === 'builtin' ? info.native : info.bundle}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">App shell {info.native}</p>

        {available && latest && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-sm font-semibold text-emerald-700">Update available: v{latest.versionName}</p>
            {latest.notes && <p className="text-xs text-slate-500 mt-0.5">{latest.notes}</p>}
            {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
            <Button
              size="sm"
              className="mt-2 gap-1.5"
              onClick={install}
              disabled={installing}
            >
              <Download className="w-3.5 h-3.5" />
              {installing ? 'Downloading…' : 'Download & Install'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
