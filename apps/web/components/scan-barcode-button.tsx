'use client';

import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ScanBarcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CameraScannerView } from '@/components/camera-scanner-view';

/**
 * Trigger + dialog for scanning a barcode with the device camera (native app
 * only — camera scanning needs the native WebView bridge, same gate as
 * CameraScannerView's other caller in generic-order-modal.tsx). Renders
 * nothing on web, since there's no camera scanning story there; hardware
 * scanner-guns (see use-barcode-scanner.ts) work on web already and are
 * unaffected by this component.
 */
export function ScanBarcodeButton({ onScan, label = 'Scan Barcode' }: { onScan: (code: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);

  if (!Capacitor.isNativePlatform()) return null;

  return (
    <>
      <Button type="button" variant="outline" className="h-11 gap-1.5" onClick={() => setOpen(true)}>
        <ScanBarcode className="h-4 w-4" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px] p-6">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl">Scan Barcode</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <CameraScannerView
              active={open}
              onScan={(code) => {
                setOpen(false);
                onScan(code);
              }}
            />
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
