'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Root error boundary — catches any render/render-time error not already
// handled locally, so a bug in one screen shows a recoverable "Something
// went wrong" state instead of a blank white screen (the previous behavior,
// with no boundary anywhere in the app).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-full flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/20 flex items-center justify-center text-rose-600">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-800">Something went wrong</h1>
        <p className="text-sm text-slate-500 max-w-xs">
          This screen hit an unexpected error. You can try again, or go back and retry the action.
        </p>
      </div>
      <Button onClick={reset} className="gap-1.5">
        <RotateCcw className="w-4 h-4" />
        Try again
      </Button>
    </div>
  );
}
