'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import apiClient, { toAbsoluteFileUrl } from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { getCurrentUser } from '@/lib/auth';
import { CONTACT_URL } from '@/lib/mailer-client';
import { AlertTriangle, Trash2, ImageUp, Mail, CheckCircle2, Sliders, Bell, ChevronDown, Crown } from 'lucide-react';
import { CustomBusinessWizard } from '@/components/custom-business-wizard';
import { AppVersionInfo } from '@/components/app-version-info';

const NOTIFICATION_TYPES: { key: string; label: string; description: string }[] = [
  { key: 'order_reminder', label: 'Order reminders', description: 'An order has sat confirmed/packed/dispatched for over 24h without moving.' },
  { key: 'payment_reminder', label: 'Payment reminders', description: "A customer's outstanding balance hasn't been chased in over 7 days." },
  { key: 'low_stock', label: 'Low stock alerts', description: 'A product has dropped to or below its reorder point.' },
  { key: 'expiry_alert', label: 'Expiry alerts', description: 'A batch is expiring within 30 days.' },
];

const CATEGORY_LABELS: Record<string, string> = {
  grocery: 'Grocery Store',
  restaurant: 'Restaurant',
  pharmacy: 'Pharmacy',
  wholesale: 'Wholesale',
  salesman: 'Salesman Order Collection',
  others: 'Others',
};

interface BusinessProfile {
  name: string;
  category: string | null;
  phone: string | null;
  address: string | null;
  gst_number: string | null;
  drug_license_number_1: string | null;
  drug_license_number_2: string | null;
  logo_url: string | null;
  upi_qr_url: string | null;
  inventory_enabled: boolean;
  ai_chat_enabled: boolean;
  allow_orders_beyond_stock: boolean;
  custom_settings: Record<string, any> | null;
  notification_preferences: Record<string, boolean> | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const { businessId, ready } = useBusiness();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteAllError, setDeleteAllError] = useState('');
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: 'others',
    phone: '',
    address: '',
    gstNumber: '',
    drugLicenseNumber1: '',
    drugLicenseNumber2: '',
    logoUrl: '',
    upiQrUrl: '',
    termsAndConditions: '',
    paperSize: '3inch' as '2inch' | '3inch' | 'a4',
    inventoryEnabled: true,
    aiChatEnabled: true,
    allowOrdersBeyondStock: true,
  });
  // Held raw so saving termsAndConditions doesn't clobber wizard-set toggles
  // (showLogoOnReceipt, paperSize, etc.) — businesses.service.ts replaces
  // custom_settings wholesale, not a deep merge.
  const [customSettings, setCustomSettings] = useState<Record<string, any> | null>(null);
  // Which line-item columns each invoice/receipt format prints. Item name and
  // Amount aren't included — every format's totals row is laid out assuming
  // those two always appear, so they're not optional. Defaults to everything
  // on, matching current behavior for any business that hasn't touched this.
  const [invoiceColumns, setInvoiceColumns] = useState({
    gstInvoice: { hsn: true, qty: true, mrp: true, price: true, gst: true },
    cashMemo: { qty: true, batch: true, expiry: true },
    a4Receipt: { hsn: true, unit: true, price: true },
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [upiQrUploading, setUpiQrUploading] = useState(false);
  const [upiQrError, setUpiQrError] = useState('');
  const [showCustomWizard, setShowCustomWizard] = useState(false);

  const handleWizardComplete = async (wizardData: any) => {
    if (!businessId) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.patch(`/api/businesses/${businessId}`, {
        name: wizardData.name,
        category: 'others',
        inventoryEnabled: wizardData.inventoryEnabled,
        currency: wizardData.currency,
        timezone: wizardData.timezone,
        address: wizardData.address,
        phone: wizardData.phone,
        gstNumber: wizardData.gstNumber,
        customSettings: wizardData.customSettings,
      });
      setShowCustomWizard(false);
      window.dispatchEvent(new Event('business-profile-updated'));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update custom business settings');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [supportCategory, setSupportCategory] = useState('others');
  const [supportMessage, setSupportMessage] = useState('');
  const [sendingSupport, setSendingSupport] = useState(false);
  const [supportError, setSupportError] = useState('');
  const [supportSent, setSupportSent] = useState(false);

  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({});
  const [savingNotificationType, setSavingNotificationType] = useState<string | null>(null);
  const [notificationPrefsError, setNotificationPrefsError] = useState('');
  const [notificationTypesExpanded, setNotificationTypesExpanded] = useState(false);
  const [modulesExpanded, setModulesExpanded] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [invoiceColumnsExpanded, setInvoiceColumnsExpanded] = useState(false);

  useEffect(() => {
    if (!ready || !businessId) return;

    // Named so it can be re-run from the event listener below — handleSubmit/
    // handleWizardComplete/handleLogoUpload/handleLogoRemove all used to
    // force a window.location.reload() after saving, purely to get this
    // same fetch to re-run with fresh data. That reload had a real side
    // effect: it remounts the root layout's SplashGif, replaying the
    // app-launch animation on every settings save or logo upload.
    // Dispatching the event instead re-fetches in place, no reload.
    const fetchSettings = () => {
      apiClient
        .get<BusinessProfile>(`/api/businesses/${businessId}`)
        .then((res) => {
          setForm({
            name: res.data.name || '',
            category: res.data.category || 'others',
            phone: res.data.phone || '',
            address: res.data.address || '',
            gstNumber: res.data.gst_number || '',
            drugLicenseNumber1: res.data.drug_license_number_1 || '',
            drugLicenseNumber2: res.data.drug_license_number_2 || '',
            logoUrl: res.data.logo_url || '',
            upiQrUrl: res.data.upi_qr_url || '',
            termsAndConditions: res.data.custom_settings?.receipt?.termsAndConditions || '',
            paperSize: res.data.custom_settings?.receipt?.paperSize || '3inch',
            inventoryEnabled: res.data.inventory_enabled,
            aiChatEnabled: res.data.ai_chat_enabled !== false,
            allowOrdersBeyondStock: res.data.allow_orders_beyond_stock !== false,
          });
          setCustomSettings(res.data.custom_settings || null);
          const savedCols = res.data.custom_settings?.invoiceColumns;
          setInvoiceColumns({
            gstInvoice: { hsn: true, qty: true, mrp: true, price: true, gst: true, ...savedCols?.gstInvoice },
            cashMemo: { qty: true, batch: true, expiry: true, ...savedCols?.cashMemo },
            a4Receipt: { hsn: true, unit: true, price: true, ...savedCols?.a4Receipt },
          });
          setNotificationPrefs(res.data.notification_preferences || {});
          setSupportCategory(res.data.category || 'others');
          if (!res.data.phone) setProfileExpanded(true); // required field missing — don't make it hunt for the section
        })
        .catch((err: any) => setError(err.response?.data?.message || 'Failed to load business settings'))
        .finally(() => setLoading(false));
    };

    fetchSettings();
    window.addEventListener('business-profile-updated', fetchSettings);
    return () => window.removeEventListener('business-profile-updated', fetchSettings);
  }, [ready, businessId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    if (!form.phone.trim()) {
      setProfileExpanded(true); // the phone field lives in the collapsed section — surface it
      setError('Phone number is required — add it below before saving.');
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await apiClient.patch(`/api/businesses/${businessId}`, {
        name: form.name,
        category: form.category,
        phone: form.phone || undefined,
        address: form.address || undefined,
        gstNumber: form.gstNumber || undefined,
        drugLicenseNumber1: form.drugLicenseNumber1 || undefined,
        drugLicenseNumber2: form.drugLicenseNumber2 || undefined,
        inventoryEnabled: form.inventoryEnabled,
        aiChatEnabled: form.aiChatEnabled,
        allowOrdersBeyondStock: form.allowOrdersBeyondStock,
        customSettings: {
          ...customSettings,
          receipt: {
            ...customSettings?.receipt,
            termsAndConditions: form.termsAndConditions || undefined,
            paperSize: form.paperSize,
          },
          invoiceColumns,
        },
      });
      // Nav visibility (Inventory link, dashboard widgets) is cached client-side —
      // tell AppShell to re-fetch so it picks up the change immediately,
      // without a full page reload (which used to replay the app-launch
      // splash video every time settings were saved).
      window.dispatchEvent(new Event('business-profile-updated'));
      setSaved(true);
      setSaving(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save settings');
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !businessId) return;

    setLogoUploading(true);
    setLogoError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post<BusinessProfile>(`/api/businesses/${businessId}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((prev) => ({ ...prev, logoUrl: res.data.logo_url || '' }));
      // AppShell's business fetch is cached client-side — tell it to
      // re-fetch so the sidebar logo updates immediately, without a full
      // page reload (which used to replay the app-launch splash video).
      window.dispatchEvent(new Event('business-profile-updated'));
    } catch (err: any) {
      setLogoError(err.response?.data?.message || 'Failed to upload logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    if (!businessId) return;
    setLogoUploading(true);
    setLogoError('');
    try {
      await apiClient.delete(`/api/businesses/${businessId}/logo`);
      setForm((prev) => ({ ...prev, logoUrl: '' }));
      window.dispatchEvent(new Event('business-profile-updated'));
    } catch (err: any) {
      setLogoError(err.response?.data?.message || 'Failed to remove logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleUpiQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !businessId) return;

    setUpiQrUploading(true);
    setUpiQrError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post<BusinessProfile>(`/api/businesses/${businessId}/upi-qr`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((prev) => ({ ...prev, upiQrUrl: res.data.upi_qr_url || '' }));
    } catch (err: any) {
      setUpiQrError(err.response?.data?.message || 'Failed to upload UPI QR code');
    } finally {
      setUpiQrUploading(false);
    }
  };

  const handleUpiQrRemove = async () => {
    if (!businessId) return;
    setUpiQrUploading(true);
    setUpiQrError('');
    try {
      await apiClient.delete(`/api/businesses/${businessId}/upi-qr`);
      setForm((prev) => ({ ...prev, upiQrUrl: '' }));
    } catch (err: any) {
      setUpiQrError(err.response?.data?.message || 'Failed to remove UPI QR code');
    } finally {
      setUpiQrUploading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSaved(false);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }
    setChangingPassword(true);
    try {
      await apiClient.post('/auth/password/change', {
        currentPassword: passwordForm.currentPassword || undefined,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordSaved(true);
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleToggleNotificationType = async (type: string, nextEnabled: boolean) => {
    if (!businessId) return;
    const previous = notificationPrefs;
    const next = { ...notificationPrefs, [type]: nextEnabled };
    setNotificationPrefs(next); // optimistic — reverted below on failure
    setSavingNotificationType(type);
    setNotificationPrefsError('');
    try {
      await apiClient.patch(`/api/businesses/${businessId}`, { notificationPreferences: next });
    } catch (err: any) {
      setNotificationPrefs(previous);
      setNotificationPrefsError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSavingNotificationType(null);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingSupport(true);
    setSupportError('');
    setSupportSent(false);
    const user = getCurrentUser();
    try {
      const res = await fetch(CONTACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user?.fullName || form.name || 'OBIX User',
          email: user?.email || '',
          businessCategory: supportCategory,
          message: supportMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to send message');
      setSupportSent(true);
      setSupportMessage('');
    } catch (err: any) {
      setSupportError(err.message || 'Failed to send message');
    } finally {
      setSendingSupport(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!businessId) return;
    setDeletingAll(true);
    setDeleteAllError('');
    try {
      await apiClient.delete('/api/dev/clear-all', { params: { businessId } });
      router.push('/dashboard');
    } catch (err: any) {
      setDeleteAllError(err.response?.data?.message || 'Failed to delete data');
      setDeletingAll(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!businessId) return;
    setDeletingAccount(true);
    setDeleteAccountError('');
    try {
      await apiClient.delete(`/api/businesses/${businessId}`, { data: { confirmName: deleteAccountConfirmText } });
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      router.push('/login');
    } catch (err: any) {
      setDeleteAccountError(err.response?.data?.message || 'Failed to delete account');
      setDeletingAccount(false);
    }
  };

  if (!ready) return null;

  return (
    <>
    <AppShell>
      <div className="p-6 md:p-10 pb-28 md:pb-24 max-w-2xl lg:max-w-5xl mx-auto">
      <div className="lg:flex lg:gap-6 lg:items-start">
      <div className="lg:flex-1 lg:min-w-0 space-y-8">
        <PageHeader title="Settings" description="Manage your business profile, subscription plans, and modules." />

        {/* Subscription & Billing Quick Banner */}
        <div 
          onClick={() => router.push('/settings/subscription')}
          className="cursor-pointer bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-indigo-700/50 hover:border-indigo-400 transition flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-yellow-400 text-indigo-950 rounded-2xl font-bold shadow-md">
              <Crown className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-extrabold flex items-center gap-2">
                Orderflow Subscription & Billing
                <span className="text-xs font-semibold bg-indigo-700 text-indigo-100 px-2.5 py-0.5 rounded-full">
                  Manage Tier
                </span>
              </h3>
              <p className="text-xs text-indigo-200 mt-0.5">
                View 30-day trial status, usage quotas (Orders, AI Scans, Staff), and upgrade plans.
              </p>
            </div>
          </div>
          <Button size="sm" className="bg-yellow-400 hover:bg-yellow-300 text-indigo-950 font-bold shrink-0">
            View Plans
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : showCustomWizard ? (
          <CustomBusinessWizard
            initialName={form.name}
            onComplete={handleWizardComplete}
            onCancel={() => setShowCustomWizard(false)}
            loading={saving}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Others Category 6-Step Builder Launcher Card */}
            {form.category === 'others' && (
              <Card className="ring-emerald-400/40 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-300/50 shadow-md">
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-sm">
                      <Sliders className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Others Category 6-Step Workspace Builder</h4>
                      <p className="text-xs text-slate-600">Re-configure all 6 steps: Identity, Modules, Security, Thermal Receipts, 20 Presets & Attributes</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setShowCustomWizard(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 h-10 rounded-xl shrink-0 shadow-sm"
                  >
                    Launch 6-Step Wizard
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <CardTitle className="text-base">Business profile</CardTitle>
              </CardHeader>
              <CardContent>
                <button
                  type="button"
                  onClick={() => setProfileExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/35 backdrop-blur-md rounded-2xl border border-transparent ring-1 ring-white/50 hover:bg-white/45 transition-colors text-sm font-medium text-slate-700"
                >
                  <span className="truncate">
                    {form.name || 'Add your business details'}
                    {form.category && <span className="text-slate-400 font-normal"> · {CATEGORY_LABELS[form.category]}</span>}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${profileExpanded ? 'rotate-180' : ''}`} />
                </button>

                {profileExpanded && (
                <div className="space-y-4 mt-2">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Logo</label>
                  <p className="text-xs text-slate-500 mb-2">Shown on invoices and PDFs. PNG, JPG, WEBP or GIF up to 5MB.</p>
                  <div className="flex items-center gap-4">
                    {form.logoUrl ? (
                      <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-white/35 backdrop-blur-md ring-1 ring-white/50 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={toAbsoluteFileUrl(form.logoUrl) ?? undefined} alt="Business logo" className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={handleLogoRemove}
                          disabled={logoUploading}
                          className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 shadow-md transition-colors disabled:opacity-50"
                          title="Remove logo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-white/60 bg-white/25 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer hover:bg-white/35 transition-colors">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleLogoUpload}
                          disabled={logoUploading}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <ImageUp className="w-5 h-5 text-slate-400 mb-1" />
                        <span className="text-[10px] font-medium text-slate-500">
                          {logoUploading ? 'Uploading...' : 'Upload'}
                        </span>
                      </label>
                    )}
                    {logoError && <p className="text-xs text-rose-600 font-medium">{logoError}</p>}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">UPI QR Code</label>
                  <p className="text-xs text-slate-500 mb-2">Shown in the Bank Details section of A4 receipts, with a "Click to pay" badge. PNG, JPG, WEBP or GIF up to 5MB.</p>
                  <div className="flex items-center gap-4">
                    {form.upiQrUrl ? (
                      <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-white/35 backdrop-blur-md ring-1 ring-white/50 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={toAbsoluteFileUrl(form.upiQrUrl) ?? undefined} alt="UPI QR code" className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={handleUpiQrRemove}
                          disabled={upiQrUploading}
                          className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 shadow-md transition-colors disabled:opacity-50"
                          title="Remove UPI QR code"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-white/60 bg-white/25 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer hover:bg-white/35 transition-colors">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleUpiQrUpload}
                          disabled={upiQrUploading}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <ImageUp className="w-5 h-5 text-slate-400 mb-1" />
                        <span className="text-[10px] font-medium text-slate-500">
                          {upiQrUploading ? 'Uploading...' : 'Upload'}
                        </span>
                      </label>
                    )}
                    {upiQrError && <p className="text-xs text-rose-600 font-medium">{upiQrError}</p>}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Business name</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full h-11 rounded-full border border-transparent bg-white/35 backdrop-blur-md px-4 text-sm ring-1 ring-white/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_3px_rgba(148,163,184,0.2)] focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">Phone *</label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                    <p className="text-[11px] text-slate-500 mt-1">Required — this is how other OBIX businesses find and connect with you as a retailer or wholesaler.</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">GST number</label>
                    <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Address</label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Receipt Paper Size</label>
                  <p className="text-xs text-slate-500 mb-2">"Full A4 Sheet" switches printed receipts to the rich Bill of Supply layout (item table, UPI QR, Acknowledgment slip). Thermal sizes keep the compact receipt.</p>
                  <select
                    value={form.paperSize}
                    onChange={(e) => setForm({ ...form, paperSize: e.target.value as '2inch' | '3inch' | 'a4' })}
                    className="w-full h-11 rounded-full border border-transparent bg-white/35 backdrop-blur-md px-4 text-sm ring-1 ring-white/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_3px_rgba(148,163,184,0.2)] focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
                  >
                    <option value="3inch">3-inch Thermal (80mm)</option>
                    <option value="2inch">2-inch Thermal (58mm)</option>
                    <option value="a4">Full A4 Sheet</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Terms and Conditions</label>
                  <p className="text-xs text-slate-500 mb-2">Shown on A4 receipts when set. Leave blank to omit.</p>
                  <textarea
                    value={form.termsAndConditions}
                    onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })}
                    rows={3}
                    className="w-full rounded-2xl border border-transparent bg-white/35 backdrop-blur-md px-4 py-2.5 text-sm ring-1 ring-white/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_3px_rgba(148,163,184,0.2)] focus:outline-none focus:ring-2 focus:ring-emerald-400/70 resize-y"
                    placeholder="e.g. Goods once sold will not be taken back or exchanged."
                  />
                </div>
                {form.category === 'pharmacy' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1.5 block">Drug License No. 1</label>
                      <Input value={form.drugLicenseNumber1} onChange={(e) => setForm({ ...form, drugLicenseNumber1: e.target.value })} placeholder="e.g. Retail" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1.5 block">Drug License No. 2</label>
                      <Input value={form.drugLicenseNumber2} onChange={(e) => setForm({ ...form, drugLicenseNumber2: e.target.value })} placeholder="e.g. Wholesale" />
                    </div>
                  </div>
                )}
                </div>
                )}
              </CardContent>
            </Card>

            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <CardTitle className="text-base">Invoice</CardTitle>
              </CardHeader>
              <CardContent>
                <button
                  type="button"
                  onClick={() => setInvoiceColumnsExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/35 backdrop-blur-md rounded-2xl border border-transparent ring-1 ring-white/50 hover:bg-white/45 transition-colors text-sm font-medium text-slate-700"
                >
                  <span>Invoice &amp; receipt columns</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${invoiceColumnsExpanded ? 'rotate-180' : ''}`} />
                </button>

                {invoiceColumnsExpanded && (
                  <div className="space-y-3 mt-2">
                    <p className="text-xs text-slate-500">
                      Choose which columns print on each format. Item name and Amount always show — every format's totals row is laid out around those two. Removing HSN or GST columns from the GST Invoice may affect its GST compliance.
                    </p>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-600 mb-1.5">GST Invoice</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {([['hsn', 'HSN'], ['qty', 'Qty'], ['mrp', 'MRP'], ['price', 'Price'], ['gst', 'GST']] as const).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={invoiceColumns.gstInvoice[key]}
                              onChange={(e) => setInvoiceColumns({ ...invoiceColumns, gstInvoice: { ...invoiceColumns.gstInvoice, [key]: e.target.checked } })}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                    {form.category === 'pharmacy' && (
                      <div>
                        <p className="text-[11px] font-semibold text-slate-600 mb-1.5">Pharmacy Cash Memo</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                          {([['qty', 'Qty'], ['batch', 'Batch'], ['expiry', 'Exp. Date']] as const).map(([key, label]) => (
                            <label key={key} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={invoiceColumns.cashMemo[key]}
                                onChange={(e) => setInvoiceColumns({ ...invoiceColumns, cashMemo: { ...invoiceColumns.cashMemo, [key]: e.target.checked } })}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] font-semibold text-slate-600 mb-1.5">A4 Receipt</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {([['hsn', 'HSN'], ['unit', 'Unit'], ['price', 'Price/unit']] as const).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={invoiceColumns.a4Receipt[key]}
                              onChange={(e) => setInvoiceColumns({ ...invoiceColumns, a4Receipt: { ...invoiceColumns.a4Receipt, [key]: e.target.checked } })}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <CardTitle className="text-base">Modules</CardTitle>
              </CardHeader>
              <CardContent>
                <button
                  type="button"
                  onClick={() => setModulesExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/35 backdrop-blur-md rounded-2xl border border-transparent ring-1 ring-white/50 hover:bg-white/45 transition-colors text-sm font-medium text-slate-700"
                >
                  <span>
                    {[form.inventoryEnabled, form.allowOrdersBeyondStock, form.aiChatEnabled].filter(Boolean).length} of 3 modules enabled
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${modulesExpanded ? 'rotate-180' : ''}`} />
                </button>

                {modulesExpanded && (
                  <div className="space-y-2 mt-2">
                    <label className="flex items-center gap-2.5 px-4 py-3 bg-white/35 backdrop-blur-md rounded-2xl border border-transparent ring-1 ring-white/50 cursor-pointer hover:bg-white/45 transition-colors">
                      <input
                        type="checkbox"
                        checked={form.inventoryEnabled}
                        onChange={(e) => setForm({ ...form, inventoryEnabled: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Enable Inventory module
                        <span className="block text-xs font-normal text-slate-500">
                          Track stock, purchase orders, and low-stock alerts. Turning this off hides the Inventory tab and dashboard stock widgets.
                        </span>
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 px-4 py-3 bg-white/35 backdrop-blur-md rounded-2xl border border-transparent ring-1 ring-white/50 cursor-pointer hover:bg-white/45 transition-colors">
                      <input
                        type="checkbox"
                        checked={form.allowOrdersBeyondStock}
                        onChange={(e) => setForm({ ...form, allowOrdersBeyondStock: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Allow orders beyond stock
                        <span className="block text-xs font-normal text-slate-500">
                          Anyone taking an order — owner or staff — can exceed what&apos;s in stock (sells whatever&apos;s available). Turn this off to block orders that exceed stock on hand for everyone.
                        </span>
                      </span>
                    </label>

                    <label className="flex items-center gap-2.5 px-4 py-3 bg-white/35 backdrop-blur-md rounded-2xl border border-transparent ring-1 ring-white/50 cursor-pointer hover:bg-white/45 transition-colors">
                      <input
                        type="checkbox"
                        checked={form.aiChatEnabled}
                        onChange={(e) => setForm({ ...form, aiChatEnabled: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        Enable AI Chat Assistant
                        <span className="block text-xs font-normal text-slate-500">
                          Show floating AI assistant widget to place orders via speech and chat commands instantly.
                        </span>
                      </span>
                    </label>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fixed so "Save changes" is always reachable without scrolling to the
                bottom of this long form — losing an edited draft because the button
                was off-screen was the whole problem being fixed here. Sits above the
                mobile bottom tab bar (bottom-16), flush to the viewport bottom on
                desktop where there's no tab bar (md:bottom-0). */}
            <div className="fixed inset-x-0 bottom-16 md:bottom-0 z-20 px-6 md:px-10 py-3 pointer-events-none">
              <div className="max-w-2xl lg:max-w-5xl mx-auto pointer-events-auto bg-white/85 backdrop-blur-xl ring-1 ring-white/60 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.15)] rounded-2xl px-4 py-3 flex items-center gap-3">
                {error ? (
                  <p className="text-sm text-rose-600 flex-1 truncate">{error}</p>
                ) : saved ? (
                  <p className="text-sm text-emerald-600 flex-1">Saved.</p>
                ) : (
                  <span className="flex-1 text-xs text-slate-400">Remember to save your changes</span>
                )}
                <Button type="submit" disabled={saving} className="shrink-0">
                  {saving ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </div>
          </form>
        )}

        {!loading && (
          <Card className="ring-white/50 glass-sheen-sm">
            <CardHeader>
              <CardTitle className="text-base">Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Current password</label>
                  <Input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder="Leave blank if you haven't set one yet"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">New password</label>
                    <Input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      minLength={6}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1.5 block">Confirm new password</label>
                    <Input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      minLength={6}
                      required
                    />
                  </div>
                </div>
                {passwordError && <p className="text-sm text-rose-600">{passwordError}</p>}
                {passwordSaved && <p className="text-sm text-emerald-600">Password updated.</p>}
                <Button type="submit" disabled={changingPassword} className="w-full sm:w-auto">
                  {changingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {!loading && (
          <Card className="ring-white/50 glass-sheen-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600" /> Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Order/payment reminders, low-stock and expiry alerts push straight to the native app.
              </p>

              <div>
                <button
                  type="button"
                  onClick={() => setNotificationTypesExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white/35 backdrop-blur-md rounded-2xl border border-transparent ring-1 ring-white/50 hover:bg-white/45 transition-colors text-sm font-medium text-slate-700"
                >
                  <span>
                    {NOTIFICATION_TYPES.filter(({ key }) => notificationPrefs[key] !== false).length} of {NOTIFICATION_TYPES.length}{' '}
                    alert types enabled
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${notificationTypesExpanded ? 'rotate-180' : ''}`} />
                </button>

                {notificationTypesExpanded && (
                  <div className="space-y-2 mt-2">
                    {NOTIFICATION_TYPES.map(({ key, label, description }) => {
                      const enabled = notificationPrefs[key] !== false;
                      return (
                        <label
                          key={key}
                          className="flex items-center gap-2.5 px-4 py-3 bg-white/35 backdrop-blur-md rounded-2xl border border-transparent ring-1 ring-white/50 cursor-pointer hover:bg-white/45 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            disabled={savingNotificationType === key}
                            onChange={(e) => handleToggleNotificationType(key, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm font-medium text-slate-700">
                            {label}
                            <span className="block text-xs font-normal text-slate-500">{description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {notificationPrefsError && <p className="text-sm text-rose-600">{notificationPrefsError}</p>}
            </CardContent>
          </Card>
        )}

        {!loading && (
          <Card className="ring-white/50 glass-sheen-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-600" /> Contact Support
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSupportSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Business category</label>
                  <select
                    value={supportCategory}
                    onChange={(e) => setSupportCategory(e.target.value)}
                    className="w-full h-11 rounded-full border border-transparent bg-white/35 backdrop-blur-md px-4 text-sm ring-1 ring-white/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_3px_rgba(148,163,184,0.2)] focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Message</label>
                  <textarea
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    required
                    rows={4}
                    placeholder="Tell us what you need help with..."
                    className="w-full rounded-2xl border border-transparent bg-white/35 backdrop-blur-md px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 outline-none transition-all ring-1 ring-white/50 focus:ring-2 focus:ring-emerald-400/70 resize-none"
                  />
                </div>
                {supportError && <p className="text-sm text-rose-600">{supportError}</p>}
                {supportSent && (
                  <p className="text-sm text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Message sent — we&apos;ll reply by email soon.
                  </p>
                )}
                <Button type="submit" disabled={sendingSupport} className="w-full sm:w-auto">
                  {sendingSupport ? 'Sending...' : 'Send message'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {!loading && (
          <Card className="ring-rose-500/30 border border-rose-500/20 bg-rose-500/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-rose-700">
                <AlertTriangle className="w-4 h-4" /> Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">
                Permanently delete every customer, product, order, invoice, table, salesman, and supplier in
                this business. This cannot be undone. The business itself and your login are not deleted.
              </p>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setDeleteConfirmText('');
                  setDeleteAllError('');
                  setShowDeleteAllConfirm(true);
                }}
              >
                Delete All Data
              </Button>

              <div className="mt-6 pt-6 border-t border-rose-500/20">
                <p className="text-sm text-slate-600 mb-4">
                  Permanently delete this entire business account — the business itself, every staff login,
                  and everything above. This cannot be undone and cannot be recovered.
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDeleteAccountConfirmText('');
                    setDeleteAccountError('');
                    setShowDeleteAccountConfirm(true);
                  }}
                >
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <AppVersionInfo />
      </div>

      {/* Rail — desktop-only live invoice header preview */}
      <aside className="hidden lg:block w-72 shrink-0 space-y-4 sticky top-10 self-start">
        <div className="bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Invoice preview</h3>
          <div className="bg-white rounded-xl ring-1 ring-slate-100 p-4 space-y-3">
            <div className="flex items-center gap-3">
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={toAbsoluteFileUrl(form.logoUrl) ?? undefined} alt="Logo" className="w-12 h-12 rounded-lg object-contain bg-slate-50 ring-1 ring-slate-100" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                  <ImageUp className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-sm truncate">{form.name || 'Your business name'}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                  {CATEGORY_LABELS[form.category] || form.category}
                </p>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 space-y-0.5 pt-2 border-t border-slate-100">
              {form.address && <p className="truncate">{form.address}</p>}
              {form.phone && <p>Ph: {form.phone}</p>}
              {form.gstNumber && <p>GST: {form.gstNumber}</p>}
              {form.drugLicenseNumber1 && <p>DL1: {form.drugLicenseNumber1}</p>}
              {form.drugLicenseNumber2 && <p>DL2: {form.drugLicenseNumber2}</p>}
              {!form.address && !form.phone && !form.gstNumber && !form.drugLicenseNumber1 && !form.drugLicenseNumber2 && (
                <p className="text-slate-300 italic">Fill in details to see them here</p>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-400">This is how your business header appears on invoices and PDFs.</p>
        </div>
      </aside>
      </div>
      </div>
    </AppShell>

    <Dialog open={showDeleteAllConfirm} onOpenChange={(open) => !deletingAll && setShowDeleteAllConfirm(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="w-4 h-4" /> Delete all data in {form.name || 'this business'}?
          </DialogTitle>
          <DialogDescription>
            This permanently deletes every customer, product, order, invoice, table, salesman, and supplier
            in this business. It cannot be undone. Type <strong>{form.name}</strong> below to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder={form.name}
          autoFocus
        />
        {deleteAllError && <p className="text-sm text-rose-600">{deleteAllError}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setShowDeleteAllConfirm(false)} disabled={deletingAll}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteAllData}
            disabled={deletingAll || deleteConfirmText !== form.name}
          >
            {deletingAll ? 'Deleting...' : 'Delete Everything'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={showDeleteAccountConfirm} onOpenChange={(open) => !deletingAccount && setShowDeleteAccountConfirm(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="w-4 h-4" /> Permanently delete {form.name || 'this business'}?
          </DialogTitle>
          <DialogDescription>
            This permanently deletes the business itself, every staff login, and everything in it. It cannot
            be undone. Type <strong>{form.name}</strong> below to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={deleteAccountConfirmText}
          onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
          placeholder={form.name}
          autoFocus
        />
        {deleteAccountError && <p className="text-sm text-rose-600">{deleteAccountError}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setShowDeleteAccountConfirm(false)} disabled={deletingAccount}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={deletingAccount || deleteAccountConfirmText !== form.name}
          >
            {deletingAccount ? 'Deleting...' : 'Delete Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
