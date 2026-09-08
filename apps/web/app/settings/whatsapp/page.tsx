'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { MessageSquare, QrCode, Printer, CheckCircle2, AlertCircle, RefreshCw, Power, Phone, ExternalLink, Sparkles, Copy } from 'lucide-react';
import { WhatsappCounterStandee } from '@/components/whatsapp-counter-standee';

interface WhatsappSettings {
  whatsappPhoneNumber: string | null;
  whatsappInstanceName: string;
  whatsappEnabled: boolean;
  whatsappConnected: boolean;
  connectionState: string;
}

export default function WhatsappSettingsPage() {
  const { businessId, ready } = useBusiness();
  const [settings, setSettings] = useState<WhatsappSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [standeeOpen, setStandeeOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const loadSettings = async () => {
    if (!businessId) return null;
    try {
      const res = await apiClient.get<WhatsappSettings>('/api/whatsapp/settings');
      setSettings(res.data);
      if (res.data.whatsappPhoneNumber) {
        setPhoneNumber(res.data.whatsappPhoneNumber);
      }
      return res.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load WhatsApp settings');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && businessId) {
      loadSettings();
    }
  }, [ready, businessId]);

  // Auto-refresh settings when tab gains focus
  useEffect(() => {
    const handleFocus = () => {
      if (ready && businessId) loadSettings();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [ready, businessId]);

  // Poll connection state while QR Modal is open to automatically close on successful scan
  useEffect(() => {
    if (!qrModalOpen || !businessId) return;

    const interval = setInterval(async () => {
      const freshSettings = await loadSettings();
      if (freshSettings && (freshSettings.whatsappConnected || freshSettings.connectionState === 'open' || freshSettings.connectionState === 'connecting')) {
        setQrModalOpen(false);
        setQrCodeData(null);
        setPairingCode(null);
        setSuccessMsg('WhatsApp device paired & connected successfully!');
        setTimeout(() => setSuccessMsg(''), 6000);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [qrModalOpen, businessId]);

  const handleToggle = async () => {
    if (!settings) return;
    const newEnabled = !settings.whatsappEnabled;
    setSaving(true);
    try {
      await apiClient.post('/api/whatsapp/toggle', { enabled: newEnabled });
      setSettings({ ...settings, whatsappEnabled: newEnabled });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not update WhatsApp toggle');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await apiClient.post('/api/whatsapp/connect', { phoneNumber });
      if (res.data?.qrData?.base64) {
        setQrCodeData(res.data.qrData.base64);
      } else if (res.data?.qrData?.code) {
        setPairingCode(res.data.qrData.code);
      }
      setQrModalOpen(true);
      await loadSettings();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not connect WhatsApp instance');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      await apiClient.post('/api/whatsapp/disconnect');
      await loadSettings();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not disconnect WhatsApp');
    } finally {
      setSaving(false);
    }
  };

  const formattedPhone = (phoneNumber || settings?.whatsappPhoneNumber || '').replace(/\D/g, '');
  const storeName = settings?.whatsappInstanceName || 'Our Store';
  const directWaUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent('Hi Obix, I want to place an order:')}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directWaUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <PageHeader
          title="WhatsApp Order Manager"
          description="Allow customers to scan your store QR code and place orders directly over WhatsApp with automated bot replies."
        />

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. Integration Status Card */}
        <Card className="rounded-3xl border-slate-200/80 shadow-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-xl text-white">WhatsApp Integration</CardTitle>
                </div>
                <CardDescription className="text-slate-300 text-xs pt-1">
                  Connect your store's WhatsApp number to automatically receive & parse customer orders.
                </CardDescription>
              </div>

              {settings && (
                <div className="flex items-center gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs h-8 px-2.5 gap-1.5"
                    onClick={() => loadSettings()}
                    title="Refresh status from server"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </Button>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${
                      settings.whatsappConnected
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        settings.whatsappConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    {settings.whatsappConnected ? 'Connected & Active' : 'Not Connected'}
                  </span>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs h-9 gap-1.5"
                    onClick={handleToggle}
                    disabled={saving}
                  >
                    <Power className={`w-3.5 h-3.5 ${settings.whatsappEnabled ? 'text-emerald-400' : 'text-slate-400'}`} />
                    {settings.whatsappEnabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Phone Number & Connection Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Store WhatsApp Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="tel"
                    placeholder="e.g. +919876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="pl-10 h-11 rounded-2xl border-slate-200 focus:ring-emerald-500 font-medium"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Include country code (e.g. +91 for India)</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  className="flex-1 h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-md shadow-emerald-200"
                  onClick={handleConnect}
                  disabled={saving || !phoneNumber}
                >
                  <QrCode className="w-4 h-4" />
                  {settings?.whatsappConnected ? 'Reconnect / Refresh QR' : 'Connect (Scan QR)'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50 font-bold shrink-0 px-4"
                  onClick={handleDisconnect}
                  disabled={saving}
                >
                  Logout / Disconnect
                </Button>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              {/* Standee Printer Box */}
              <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-sm">
                    <Printer className="w-4 h-4 text-indigo-600" />
                    <span>Store Counter Standee / Poster</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Generate and print a branded QR code poster for your store counter. Customers scan to order.
                  </p>
                </div>
                <Button
                  type="button"
                  className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2"
                  onClick={() => setStandeeOpen(true)}
                  disabled={!phoneNumber}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print WhatsApp Counter Standee
                </Button>
              </div>

              {/* Direct Deep Link Box */}
              <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-sm">
                    <ExternalLink className="w-4 h-4 text-emerald-600" />
                    <span>Direct WhatsApp Order Link</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Share this link on Instagram, Google Business, or SMS to open WhatsApp ordering directly.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={directWaUrl}
                    className="h-10 rounded-xl bg-white border-slate-200 text-xs font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl px-3 shrink-0"
                    onClick={handleCopyLink}
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Explanatory Card */}
        <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-sky-50/50 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h4 className="font-extrabold text-slate-900 text-base">How WhatsApp AI Ordering Works</h4>
              <ul className="space-y-1.5 text-xs text-slate-600 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Customers scan your counter QR code or send an order list on WhatsApp.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>OBIX AI parses item names, quantities, and customer details automatically.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>The order appears instantly in your OBIX Order List & Android APK.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>An automated confirmation message & bill URL is replied back to the customer.</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* QR Code Connection Dialog */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-6 text-center">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Pair WhatsApp Device</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Open WhatsApp on your phone &gt; Linked Devices &gt; Link a Device, then scan this QR code.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 flex flex-col items-center justify-center space-y-3">
            {qrCodeData ? (
              <img src={qrCodeData} alt="WhatsApp QR" className="w-56 h-56 rounded-2xl border p-2 bg-white shadow-sm" />
            ) : pairingCode ? (
              <div className="p-4 rounded-2xl bg-slate-100 font-mono text-xl font-bold tracking-widest text-slate-800">
                {pairingCode}
              </div>
            ) : (
              <div className="w-56 h-56 rounded-2xl border flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                Loading QR Code...
              </div>
            )}
            <p className="text-xs text-slate-600 font-medium">Keep WhatsApp open while pairing</p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-2xl h-11 border-rose-200 text-rose-600 hover:bg-rose-50 font-bold"
              onClick={async () => {
                setQrModalOpen(false);
                await handleDisconnect();
              }}
              disabled={saving}
            >
              Logout & Reset
            </Button>

            <Button type="button" className="flex-1 rounded-2xl h-11 font-bold" onClick={() => setQrModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Standee Modal */}
      <WhatsappCounterStandee
        isOpen={standeeOpen}
        onClose={() => setStandeeOpen(false)}
        businessName={storeName}
        whatsappPhone={phoneNumber}
      />
    </AppShell>
  );
}
