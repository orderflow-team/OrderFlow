'use client';

import { useState } from 'react';
import { Printer, Scan, Scale, HardDrive, WifiOff, CheckCircle2, RefreshCw } from 'lucide-react';

const HARDWARE_ITEMS = [
  { label: 'Thermal Printers', sub: '58mm / 80mm ESC/POS USB, BT & LAN', icon: Printer },
  { label: 'Barcode Scanners', sub: '1D & 2D Wireless Laser / USB', icon: Scan },
  { label: 'Weighing Scales', sub: 'USB & Serial Auto Weight Sync', icon: Scale },
  { label: 'Cash Drawers', sub: 'Auto RJ11 Solenoid Kickout', icon: HardDrive },
  { label: 'Offline Sync Mode', sub: 'Local DB Sync on Wi-Fi Outages', icon: WifiOff },
];

export function HardwareBar() {
  const [testingSync, setTestingSync] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const handleTestSync = () => {
    setTestingSync(true);
    setSyncStatus(null);
    setTimeout(() => {
      setTestingSync(false);
      setSyncStatus('✅ USB Thermal Printer (Epson/TVS) & Wireless Scanner Connected!');
    }, 1200);
  };

  return (
    <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-10 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4 border border-emerald-500/20">
          Hardware Ecosystem
        </div>
        <h3 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">
          Works seamlessly with the hardware you already own.
        </h3>
        <p className="text-slate-400 text-base leading-relaxed mb-6">
          No proprietary hardware lock-in. Connect OrderFlow directly to standard USB/Bluetooth thermal receipt printers, wireless barcode scanners, and digital weighing scales in seconds.
        </p>

        {/* Brand Compatibility Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300 mb-8">
          <span className="text-slate-500">Tested Brands:</span>
          {['Epson', 'TVS Electronics', 'Posiflex', 'Sunmi', 'Zebra', 'Honeywell', 'Everycom'].map((brand) => (
            <span key={brand} className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
              {brand}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative z-10">
        {HARDWARE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 hover:bg-slate-800 hover:border-emerald-500/50 transition-all duration-300 group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-1.5 mb-1">
                {item.label}
              </div>
              <div className="text-xs text-slate-400 leading-snug">{item.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 relative z-10">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Driverless WebUSB &amp; WebBluetooth</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Windows, Android &amp; iOS</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTestSync}
            disabled={testingSync}
            className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-emerald-400 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingSync ? 'animate-spin' : ''}`} />
            {testingSync ? 'Testing Hardware...' : 'Simulate Hardware Sync'}
          </button>
        </div>
      </div>

      {syncStatus && (
        <div className="mt-4 p-3 bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-mono border border-emerald-500/30 animate-in fade-in relative z-10">
          {syncStatus}
        </div>
      )}
    </div>
  );
}
