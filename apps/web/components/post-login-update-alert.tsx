'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNativeAppUpdate } from '@/lib/use-native-app-update';
import { consumeJustLoggedIn } from '@/lib/auth';
import { Sparkles, Download } from 'lucide-react';

/**
 * Surfaces a native APK update the moment someone logs in, rather than
 * relying on them to notice the passive banner in Settings > About. Only
 * fires once per login (via consumeJustLoggedIn) — reopening the app with
 * an existing session doesn't re-show it every time.
 */
export function PostLoginUpdateAlert() {
  const [armed, setArmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { available, latest, installing, error, install } = useNativeAppUpdate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (consumeJustLoggedIn()) setArmed(true);
  }, []);

  const open = armed && available && !dismissed;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && setDismissed(true)}>
      <DialogContent className="sm:max-w-[400px] p-6">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" /> Update available
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Version {latest?.versionName} is ready to install.
          </p>
          {latest?.notes && <p className="text-xs text-slate-400">{latest.notes}</p>}
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setDismissed(true)} disabled={installing}>
            Later
          </Button>
          <Button type="button" onClick={install} disabled={installing} className="gap-1.5">
            <Download className="w-4 h-4" /> {installing ? 'Downloading…' : 'Download & Install'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
