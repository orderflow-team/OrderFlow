'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  RefreshCw,
  Send,
  AlertTriangle,
  Info,
  CheckCircle,
  ShieldAlert,
  Megaphone,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface AnnouncementState {
  active: boolean;
  message: string;
  type: string;
  updated_at?: string;
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

  useEffect(() => {
    fetchAnnouncement();
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Megaphone className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            Platform Broadcast Announcement Manager
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Broadcast system-wide notification banners or scheduled maintenance alerts across all active store dashboards.
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
    </div>
  );
}
