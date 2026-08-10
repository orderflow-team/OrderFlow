'use client';

import { Capacitor } from '@capacitor/core';
import { Pencil, Camera } from 'lucide-react';

/**
 * Manual/Scan pill toggle for a product form — same look and mechanics as the
 * Browse/Scan toggle in generic-order-modal.tsx (New Order), so scanning feels
 * consistent everywhere in the app. Renders nothing on web: camera scanning
 * needs the native WebView bridge (see use-camera-barcode-scanner.ts).
 */
export function ManualOrScanToggle({ scanMode, onChange }: { scanMode: boolean; onChange: (scanMode: boolean) => void }) {
  if (!Capacitor.isNativePlatform()) return null;

  return (
    <div className="shrink-0 flex justify-center mb-1">
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/50 ring-1 ring-white/60 backdrop-blur-md">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            !scanMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Pencil className="w-3.5 h-3.5" /> Manual
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            scanMode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Camera className="w-3.5 h-3.5" /> Scan
        </button>
      </div>
    </div>
  );
}
