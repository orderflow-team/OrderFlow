'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  RefreshCw,
  Send,
  AlertTriangle,
  Info,
  CheckCircle,
  ShieldAlert,
  Megaphone,
  Wrench,
  Search,
  X,
  Smartphone,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface AnnouncementState {
  active: boolean;
  message: string;
  type: string;
  updated_at?: string;
}

interface MaintenanceState {
  active: boolean;
  message: string;
}

interface StoreSearchResult {
  id: string;
  name: string;
  category: string;
  owner_email?: string;
}

export default function AdminNotificationsPage() {
  const [announcement, setAnnouncement] = useState<AnnouncementState>({
    active: false,
    message: '',
    type: 'info',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [maintenance, setMaintenance] = useState<MaintenanceState>({ active: false, message: '' });
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceStatusMessage, setMaintenanceStatusMessage] = useState('');

  // Push notification (distinct from the in-app banner above — this fires a
  // real FCM push, see FcmService/NotificationsService.sendCustomPush).
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [pushTarget, setPushTarget] = useState<'store' | 'all'>('store');
  const [pushStoreQuery, setPushStoreQuery] = useState('');
  const [pushStoreResults, setPushStoreResults] = useState<StoreSearchResult[]>([]);
  const [pushSelectedStore, setPushSelectedStore] = useState<StoreSearchResult | null>(null);
  const [pushSearching, setPushSearching] = useState(false);
  const [pushSending, setPushSending] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState('');
  const [pushError, setPushError] = useState('');
  const pushSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAnnouncement = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/platform-admin/announcement');
      setAnnouncement(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenance = async () => {
    try {
      const res = await apiClient.get('/api/platform-admin/maintenance');
      setMaintenance(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAnnouncement();
    fetchMaintenance();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiClient.post('/api/platform-admin/announcement', announcement);
      setAnnouncement(res.data);
      setStatusMessage('Platform announcement updated successfully!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (maintenance.active && !confirm('Turn maintenance mode ON? This blocks new logins for everyone except super_admin until you turn it back off.')) {
      return;
    }
    setMaintenanceSaving(true);
    try {
      const res = await apiClient.post('/api/platform-admin/maintenance', maintenance);
      setMaintenance(res.data);
      setMaintenanceStatusMessage(maintenance.active ? 'Maintenance mode is now ON — new logins are blocked.' : 'Maintenance mode turned off.');
      setTimeout(() => setMaintenanceStatusMessage(''), 4000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update maintenance mode');
    } finally {
      setMaintenanceSaving(false);
    }
  };

  useEffect(() => {
    if (pushSearchTimer.current) clearTimeout(pushSearchTimer.current);
    if (pushTarget !== 'store' || !pushStoreQuery.trim() || pushSelectedStore) {
      setPushStoreResults([]);
      return;
    }
    pushSearchTimer.current = setTimeout(async () => {
      setPushSearching(true);
      try {
        const res = await apiClient.get('/api/platform-admin/stores', { params: { search: pushStoreQuery, limit: 8 } });
        setPushStoreResults(res.data.data || []);
      } catch {
        setPushStoreResults([]);
      } finally {
        setPushSearching(false);
      }
    }, 300);
    return () => {
      if (pushSearchTimer.current) clearTimeout(pushSearchTimer.current);
    };
  }, [pushStoreQuery, pushTarget, pushSelectedStore]);

  const handleSendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pushTarget === 'store' && !pushSelectedStore) {
      setPushError('Search for and select a store first.');
      return;
    }
    if (pushTarget === 'all' && !confirm('Send this push to EVERY business on the platform? This can\'t be undone once sent.')) {
      return;
    }
    setPushSending(true);
    setPushError('');
    setPushStatusMessage('');
    try {
      const res = await apiClient.post('/api/platform-admin/broadcast-push', {
        businessId: pushTarget === 'store' ? pushSelectedStore!.id : undefined,
        title: pushTitle,
        message: pushMessage,
      });
      setPushStatusMessage(
        `Reached ${res.data.businessesReached} business${res.data.businessesReached === 1 ? '' : 'es'}, ` +
        `pushed to ${res.data.devicesNotified} device${res.data.devicesNotified === 1 ? '' : 's'}.`,
      );
      setPushTitle('');
      setPushMessage('');
      setPushSelectedStore(null);
      setPushStoreQuery('');
    } catch (err: any) {
      setPushError(err.response?.data?.message || 'Failed to send push');
    } finally {
      setPushSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Megaphone className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            Broadcast &amp; Maintenance Mode
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Broadcast a system-wide notification banner, or put the platform into maintenance mode to block new logins during a risky deploy.
          </p>
        </div>

        <button
          onClick={fetchAnnouncement}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground text-sm font-medium rounded-xl border border-border transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Push Notification — a real FCM push to the native app, distinct from
          the in-app banner below. One-off and not persisted anywhere other
          than the resulting notification rows/push receipts. */}
      <div className="bg-card border border-border p-6 rounded-2xl shadow-xl space-y-5">
        <div className="border-b border-border pb-3">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Push Notification
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Sends a real push to the native app (tray notification, not just the in-app banner) — to one store or every store on the
            platform. Also saved to that store's notification bell.
          </p>
        </div>

        {pushStatusMessage && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {pushStatusMessage}
          </div>
        )}
        {pushError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 rounded-xl text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {pushError}
          </div>
        )}

        <form onSubmit={handleSendPush} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPushTarget('store')}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border transition ${
                pushTarget === 'store' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-background text-foreground border-border'
              }`}
            >
              Specific store
            </button>
            <button
              type="button"
              onClick={() => setPushTarget('all')}
              className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border transition ${
                pushTarget === 'all' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-background text-foreground border-border'
              }`}
            >
              All stores
            </button>
          </div>

          {pushTarget === 'store' && (
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Store</label>
              {pushSelectedStore ? (
                <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                  <span className="text-sm font-medium text-foreground">
                    {pushSelectedStore.name} <span className="text-xs text-muted-foreground">({pushSelectedStore.category})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPushSelectedStore(null);
                      setPushStoreQuery('');
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={pushStoreQuery}
                    onChange={(e) => setPushStoreQuery(e.target.value)}
                    placeholder="Search store by name..."
                    className="w-full bg-background border border-border rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-emerald-500"
                  />
                  {(pushSearching || pushStoreResults.length > 0) && pushStoreQuery.trim() && (
                    <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto">
                      {pushSearching ? (
                        <div className="p-3 text-xs text-muted-foreground">Searching...</div>
                      ) : (
                        pushStoreResults.map((store) => (
                          <button
                            key={store.id}
                            type="button"
                            onClick={() => {
                              setPushSelectedStore(store);
                              setPushStoreResults([]);
                            }}
                            className="w-full text-left px-3.5 py-2.5 text-sm text-foreground hover:bg-accent transition border-b border-border last:border-0"
                          >
                            {store.name} <span className="text-xs text-muted-foreground">({store.category})</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Title</label>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="e.g. New feature: OBIX Connect"
              value={pushTitle}
              onChange={(e) => setPushTitle(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Message</label>
            <textarea
              required
              rows={3}
              placeholder="e.g. You can now link with wholesalers and retailers directly from Settings."
              value={pushMessage}
              onChange={(e) => setPushMessage(e.target.value)}
              className="w-full bg-background border border-border rounded-xl p-3.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="submit"
              disabled={pushSending}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-lg shadow-emerald-600/30"
            >
              <Send className="w-4 h-4" />
              {pushSending ? 'Sending...' : pushTarget === 'all' ? 'Send to all stores' : 'Send push'}
            </button>
          </div>
        </form>
      </div>

      {statusMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {statusMessage}
        </div>
      )}

      {/* Live Banner Preview */}
      {announcement.active && announcement.message && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 shadow-xl ${
            announcement.type === 'critical'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
              : announcement.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
          }`}
        >
          {announcement.type === 'critical' ? (
            <ShieldAlert className="w-6 h-6 flex-shrink-0 text-rose-600 dark:text-rose-400" />
          ) : announcement.type === 'warning' ? (
            <AlertTriangle className="w-6 h-6 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <Bell className="w-6 h-6 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          )}

          <div className="flex-1 text-sm font-medium">
            <span className="font-bold block text-xs uppercase opacity-75 mb-0.5">
              Live Broadcast Preview ({announcement.type})
            </span>
            {announcement.message}
          </div>
        </div>
      )}

      {/* Broadcast Form */}
      <div className="bg-card border border-border p-6 rounded-2xl shadow-xl space-y-5">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
          <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Configure Broadcast Message
        </h3>

        <form onSubmit={handleSave} className="space-y-4">
          <label className="flex items-center justify-between p-4 bg-background rounded-xl border border-border cursor-pointer">
            <div>
              <span className="text-sm font-bold text-foreground block">Broadcast Banner Active</span>
              <span className="text-xs text-muted-foreground">Display message at top of all tenant store dashboards</span>
            </div>
            <input
              type="checkbox"
              checked={announcement.active}
              onChange={(e) => setAnnouncement({ ...announcement, active: e.target.checked })}
              className="w-5 h-5 rounded bg-card border-border text-blue-600 focus:ring-0"
            />
          </label>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Alert Severity Level</label>
            <select
              value={announcement.type}
              onChange={(e) => setAnnouncement({ ...announcement, type: e.target.value })}
              className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:border-blue-500 capitalize"
            >
              <option value="info">ℹ️ System Info / Update</option>
              <option value="warning">⚠️ Scheduled Maintenance Warning</option>
              <option value="critical">🚨 Critical Service Alert</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Broadcast Message Text</label>
            <textarea
              required
              rows={4}
              placeholder="e.g. Scheduled database maintenance tonight at 2:00 AM IST. Offline POS sync will remain active..."
              value={announcement.message}
              onChange={(e) => setAnnouncement({ ...announcement, message: e.target.value })}
              className="w-full bg-background border border-border rounded-xl p-3.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition shadow-lg shadow-blue-600/30"
            >
              <Send className="w-4 h-4" />
              {saving ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </div>

      {/* Maintenance Mode */}
      {maintenanceStatusMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 rounded-xl text-sm flex items-center gap-2">
          <Wrench className="w-5 h-5 flex-shrink-0" />
          {maintenanceStatusMessage}
        </div>
      )}

      <div className="bg-card border border-border p-6 rounded-2xl shadow-xl space-y-5">
        <div className="border-b border-border pb-3">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Wrench className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            Maintenance Mode
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Blocks new logins for every account except super_admin — already-open sessions keep working. Use this during a risky
            deploy or incident; super_admin can always still log in to turn it back off.
          </p>
        </div>

        <form onSubmit={handleSaveMaintenance} className="space-y-4">
          <label className="flex items-center justify-between p-4 bg-background rounded-xl border border-border cursor-pointer">
            <div>
              <span className="text-sm font-bold text-foreground block">Maintenance Mode Active</span>
              <span className="text-xs text-muted-foreground">New logins blocked platform-wide (super_admin exempt)</span>
            </div>
            <input
              type="checkbox"
              checked={maintenance.active}
              onChange={(e) => setMaintenance({ ...maintenance, active: e.target.checked })}
              className="w-5 h-5 rounded bg-card border-border text-rose-600 focus:ring-0"
            />
          </label>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Message shown to blocked/logged-in users</label>
            <textarea
              rows={3}
              placeholder="e.g. We're doing scheduled maintenance — back in about 30 minutes."
              value={maintenance.message}
              onChange={(e) => setMaintenance({ ...maintenance, message: e.target.value })}
              className="w-full bg-background border border-border rounded-xl p-3.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="submit"
              disabled={maintenanceSaving}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition shadow-lg shadow-rose-600/30"
            >
              <Wrench className="w-4 h-4" />
              {maintenanceSaving ? 'Saving...' : maintenance.active ? 'Turn Maintenance Mode On' : 'Save (Maintenance Off)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
