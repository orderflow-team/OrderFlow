'use client';

import { ScanBarcode, ShieldAlert, CameraOff } from 'lucide-react';
import { useCameraBarcodeScanner } from '@/lib/use-camera-barcode-scanner';

interface CameraScannerViewProps {
  active: boolean;
  onScan: (code: string) => void;
}

/**
 * Live camera viewfinder for barcode scanning. The actual camera image is
 * rendered natively behind the (transparent, while active) WebView — this
 * component only draws the on-screen frame overlay and status messaging.
 */
export function CameraScannerView({ active, onScan }: CameraScannerViewProps) {
  const { status } = useCameraBarcodeScanner(onScan, { enabled: active });

  return (
    <div className="flex-1 min-h-[220px] relative rounded-2xl overflow-hidden bg-slate-900/5">
      {status === 'scanning' && (
        <div className="absolute inset-6 flex items-center justify-center pointer-events-none">
          <div className="relative w-full max-w-xs aspect-[3/2]">
            {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((corner) => (
              <span
                key={corner}
                className={`absolute w-8 h-8 border-emerald-400 ${
                  corner === 'top-left' ? 'top-0 left-0 border-t-4 border-l-4 rounded-tl-xl' :
                  corner === 'top-right' ? 'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl' :
                  corner === 'bottom-left' ? 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl' :
                  'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {status === 'scanning' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/60 text-white text-xs font-medium backdrop-blur-sm">
          <ScanBarcode className="w-3.5 h-3.5" /> Point camera at a barcode
        </div>
      )}

      {(status === 'idle' || status === 'requesting-permission' || status === 'preparing-module') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
          <ScanBarcode className="w-6 h-6 animate-pulse" />
          {status === 'preparing-module' ? 'Preparing scanner…' : 'Starting camera…'}
        </div>
      )}

      {status === 'permission-denied' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6 text-slate-600 text-sm">
          <ShieldAlert className="w-6 h-6 text-rose-500" />
          Camera permission is needed to scan barcodes.
          <span className="text-xs text-slate-400">Enable it in your phone's app settings, then reopen Scan.</span>
        </div>
      )}

      {status === 'unsupported' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6 text-slate-600 text-sm">
          <CameraOff className="w-6 h-6 text-slate-400" />
          Camera scanning isn't available on this device.
        </div>
      )}
    </div>
  );
}
