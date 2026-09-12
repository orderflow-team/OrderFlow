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
import {
  MessageSquare,
  QrCode,
  Printer,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Power,
  Phone,
  ExternalLink,
  Sparkles,
  Copy,
  Loader2,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [standeeOpen, setStandeeOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const loadSettings = async (showRefreshSpinner = false) => {
    if (!businessId) return null;
    if (showRefreshSpinner) setIsRefreshing(true);
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
      if (showRefreshSpinner) setIsRefreshing(false);
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
      if (freshSettings && (freshSettings.whatsappConnected || freshSettings.connectionState === 'open' || freshSettings.connectionState === 'connected')) {
        setQrModalOpen(false);
        setQrCodeData(null);
        setPairingCode(null);
        setIsConnecting(false);
        setSuccessMsg('WhatsApp device paired & connected successfully!');
        setTimeout(() => setSuccessMsg(''), 6000);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [qrModalOpen, businessId]);

  const handleToggle = async () => {
    if (!settings) return;
    const newEnabled = !settings.whatsappEnabled;
    setIsToggling(true);
    try {
      await apiClient.post('/api/whatsapp/toggle', { enabled: newEnabled });
      setSettings({ ...settings, whatsappEnabled: newEnabled });
      setSuccessMsg(newEnabled ? 'WhatsApp ordering enabled' : 'WhatsApp ordering disabled');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not update WhatsApp toggle');
    } finally {
      setIsToggling(false);
    }
  };

  const handleConnect = async () => {
    if (!phoneNumber) {
      setError('Please enter your store WhatsApp phone number first.');
      return;
    }
    setIsConnecting(true);
    setError('');
    setQrCodeData(null);
    setPairingCode(null);
    // Open modal immediately so the user gets instant visual feedback
    setQrModalOpen(true);
    try {
      const res = await apiClient.post('/api/whatsapp/connect', { phoneNumber }, { timeout: 10000 });
      if (res.data?.qrData?.base64) {
        setQrCodeData(res.data.qrData.base64);
      } else if (res.data?.qrData?.code) {
        setPairingCode(res.data.qrData.code);
      } else {
        throw new Error('Evolution API did not return a QR code. Please check that Evolution API is running on port 8080.');
      }
      await loadSettings();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Could not connect WhatsApp instance. Please ensure Evolution API is running.');
      setQrModalOpen(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setError('');
    try {
      await apiClient.post('/api/whatsapp/disconnect');
      setQrCodeData(null);
      setPairingCode(null);
      setQrModalOpen(false);
      await loadSettings();
      setSuccessMsg('WhatsApp disconnected successfully.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not disconnect WhatsApp');
    } finally {
      setIsDisconnecting(false);
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
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError('')}
              className="text-xs text-rose-500 hover:text-rose-700 font-bold px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2 font-semibold shadow-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. Integration Status Card */}
        <Card className="rounded-3xl border-slate-200/80 shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-xl text-white font-black tracking-tight">WhatsApp Integration</CardTitle>
                </div>
                <CardDescription className="text-slate-300 text-xs pt-1">
                  Connect your store's WhatsApp number to automatically receive & parse customer orders.
                </CardDescription>
              </div>

              {settings && (
                <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs h-8 px-3 gap-1.5"
                    onClick={() => loadSettings(true)}
                    disabled={isRefreshing}
                    title="Refresh status from server"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>{isRefreshing ? 'Checking...' : 'Refresh'}</span>
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
                    className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs h-8 px-3 gap-1.5"
                    onClick={handleToggle}
                    disabled={isToggling}
                  >
                    {isToggling ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <Power className={`w-3.5 h-3.5 ${settings.whatsappEnabled ? 'text-emerald-400' : 'text-slate-400'}`} />
                    )}
                    {settings.whatsappEnabled ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-7 space-y-6">
            {/* Phone Number & Connection Action Bar */}
            <div className="space-y-4">
              <div className="space-y-1.5 max-w-lg">
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
                <p className="text-[11px] text-slate-500">Include country code (e.g. +91 for India, +1 for US)</p>
              </div>

              {/* Action Buttons Row - Spaced and Responsive */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  type="button"
                  className="h-11 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-md shadow-emerald-200/60 active:scale-[0.99] transition-all"
                  onClick={handleConnect}
                  disabled={isConnecting || isDisconnecting || !phoneNumber}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Generating QR Code...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      <span>{settings?.whatsappConnected ? 'Reconnect / Refresh QR' : 'Connect (Scan QR)'}</span>
                    </>
                  )}
                </Button>

                {settings?.whatsappConnected && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-5 rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 font-bold gap-2 active:scale-[0.99] transition-all"
                    onClick={handleDisconnect}
                    disabled={isConnecting || isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                        <span>Disconnecting...</span>
                      </>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Logout / Disconnect</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5 border-t border-slate-100">
              {/* Standee Printer Box */}
              <div className="p-5 rounded-3xl bg-slate-50/80 border border-slate-200/80 space-y-3 flex flex-col justify-between hover:border-indigo-200 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-sm">
                    <Printer className="w-4 h-4 text-indigo-600" />
                    <span>Store Counter Standee / Poster</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Generate and print a branded QR code poster for your store counter. Customers scan to order.
                  </p>
                </div>
                <Button
                  type="button"
                  className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2 shadow-sm"
                  onClick={() => setStandeeOpen(true)}
                  disabled={!phoneNumber}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print WhatsApp Counter Standee
                </Button>
              </div>

              {/* Direct Deep Link Box */}
              <div className="p-5 rounded-3xl bg-slate-50/80 border border-slate-200/80 space-y-3 flex flex-col justify-between hover:border-emerald-200 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-sm">
                    <ExternalLink className="w-4 h-4 text-emerald-600" />
                    <span>Direct WhatsApp Order Link</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Share this link on Instagram, Google Business, or SMS to open WhatsApp ordering directly.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={directWaUrl}
                    className="h-10 rounded-xl bg-white border-slate-200 text-xs font-mono select-all"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl px-3 shrink-0 hover:bg-slate-100"
                    onClick={handleCopyLink}
                    title="Copy direct WhatsApp order link"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Explanatory Card */}
        <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-gradient-to-r from-emerald-50/60 via-teal-50/40 to-sky-50/60 p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <span>How WhatsApp AI Ordering Works</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                  Automated
                </span>
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Customers scan your counter QR code or send an order list on WhatsApp starting with <b>"Hi Obix"</b>.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>OBIX AI automatically parses item names, quantities, and customer details.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>The order appears instantly in your OBIX Order List & Android POS.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>An automated confirmation message & status updates are sent back to the customer.</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* QR Code Connection Dialog */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-7 text-center">
          <DialogHeader className="space-y-1.5">
            <div className="mx-auto p-3 rounded-2xl bg-emerald-50 text-emerald-600 w-fit mb-1 border border-emerald-100">
              <QrCode className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">Pair WhatsApp Device</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Open WhatsApp on your phone &gt; <b>Linked Devices</b> &gt; <b>Link a Device</b>, then scan this QR code.
            </DialogDescription>
          </DialogHeader>

          <div className="my-5 flex flex-col items-center justify-center">
            {qrCodeData ? (
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-md inline-block">
                  <img src={qrCodeData} alt="WhatsApp QR" className="w-60 h-60 rounded-xl" />
                </div>
                <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 py-1.5 px-3 rounded-full border border-emerald-200/60">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Waiting for scan... (Auto-closes when connected)</span>
                </div>
              </div>
            ) : pairingCode ? (
              <div className="space-y-3">
                <div className="p-6 rounded-2xl bg-slate-100 font-mono text-2xl font-black tracking-widest text-slate-800 border">
                  {pairingCode}
                </div>
                <p className="text-xs text-slate-500">Enter this code in WhatsApp &gt; Link with phone number</p>
              </div>
            ) : (
              <div className="w-64 h-64 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 flex flex-col items-center justify-center p-6 space-y-3 animate-pulse">
                <Loader2 className="w-9 h-9 animate-spin text-emerald-600" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700">Generating QR Code...</p>
                  <p className="text-[11px] text-slate-400">Connecting to Evolution API gateway</p>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-500 font-medium mt-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Keep WhatsApp open on your phone during pairing</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-2xl h-11 border-slate-200 text-slate-600 hover:bg-slate-100 font-bold"
              onClick={() => setQrModalOpen(false)}
            >
              Close
            </Button>

            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-2xl h-11 border-rose-200 text-rose-600 hover:bg-rose-50 font-bold gap-1.5"
              onClick={async () => {
                setQrModalOpen(false);
                await handleDisconnect();
              }}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>Logout & Reset</span>
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

