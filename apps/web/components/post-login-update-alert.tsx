'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNativeAppUpdate } from '@/lib/use-native-app-update';
import { Sparkles, Download } from 'lucide-react';

// Module-level, not state: survives client-side page navigation (this
// component remounts on every route change since there's no persistent
// authenticated layout — see AppShell), but resets on a real app
// relaunch, which is exactly "show once per app open."
let alertShownThisSession = false;

/**
 * Surfaces a native APK update as soon as the app is opened, rather than
 * relying on someone to notice the passive banner in Settings > About.
 * Shows at most once per app session — dismissing it (or installing) won't
 * bring it back on the next page navigation, only a fresh app launch does.
 */
export function PostLoginUpdateAlert() {
  const [dismissed, setDismissed] = useState(false);
  const [eligible] = useState(() => !alertShownThisSession);
  const { available, latest, installing, error, install } = useNativeAppUpdate();

  const open = eligible && available && !dismissed;

  useEffect(() => {
    if (open) alertShownThisSession = true;
  }, [open]);

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
        <DialogFooter className="flex-row items-center gap-3">
          <Button type="button" variant="ghost" onClick={() => setDismissed(true)} disabled={installing} className="flex-1">
            Later
          </Button>
          <Button type="button" onClick={install} disabled={installing} className="flex-1 gap-1.5">
            <Download className="w-4 h-4" /> {installing ? 'Downloading…' : 'Download & Install'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
