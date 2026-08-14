'use client';

import { useEffect, useState } from 'react';
import { Rocket, RefreshCw, CheckCircle2, RotateCcw, PlayCircle } from 'lucide-react';
import apiClient from '@/lib/api-client';

interface OtaRelease {
  id: string;
  platform: string;
  version: string;
  bundle_url: string;
  checksum: string;
  min_native_version: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface ApkRelease {
  id: string;
  platform: string;
  version_name: string;
  apk_url: string;
  checksum: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

/**
 * Every release this app has shipped so far went out purely via
 * scripts/release-ota.mjs / release-apk.mjs from the command line — this
 * page is the first place to actually SEE that history and roll one back
 * (PATCH .../:id { isActive: false }) without another CLI round trip.
 * "Live" here means the first is_active row per platform, since
 * getLatest()/getLatest() on the backend just picks the most recent
 * is_active=true row — deactivating it makes whichever was active before
 * it "latest" again on the next device poll.
 */
export default function AdminReleasesPage() {
  const [otaReleases, setOtaReleases] = useState<OtaRelease[]>([]);
  const [apkReleases, setApkReleases] = useState<ApkRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [ota, apk] = await Promise.all([
        apiClient.get<OtaRelease[]>('/api/app-updates', { params: { platform: 'android' } }),
        apiClient.get<ApkRelease[]>('/api/app-apk-releases', { params: { platform: 'android' } }),
      ]);
      setOtaReleases(ota.data);
      setApkReleases(apk.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load releases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleOta = async (id: string, isActive: boolean) => {
    setBusyId(id);
    try {
      await apiClient.patch(`/api/app-updates/${id}`, { isActive });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update release');
    } finally {
      setBusyId(null);
    }
  };

  const toggleApk = async (id: string, isActive: boolean) => {
    setBusyId(id);
    try {
      await apiClient.patch(`/api/app-apk-releases/${id}`, { isActive });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update release');
    } finally {
      setBusyId(null);
    }
  };

  // First is_active row is whatever getLatest() would actually serve right now.
  const liveOtaId = otaReleases.find((r) => r.is_active)?.id;
  const liveApkId = apkReleases.find((r) => r.is_active)?.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Rocket className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            App Releases
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            OTA (JS bundle) and native APK release history — roll back a bad release without touching the CLI.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground text-sm font-medium rounded-xl border border-border transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      <ReleaseTable
        title="OTA Releases (JS bundle)"
        rows={otaReleases}
        loading={loading}
        liveId={liveOtaId}
        busyId={busyId}
        getVersion={(r) => r.version}
        onToggle={(id, isActive) => toggleOta(id, isActive)}
      />

      <ReleaseTable
        title="APK Releases (native)"
        rows={apkReleases}
        loading={loading}
        liveId={liveApkId}
        busyId={busyId}
        getVersion={(r) => r.version_name}
        onToggle={(id, isActive) => toggleApk(id, isActive)}
      />
    </div>
  );
}

function ReleaseTable<T extends { id: string; notes: string | null; is_active: boolean; created_at: string }>({
  title,
  rows,
  loading,
  liveId,
  busyId,
  getVersion,
  onToggle,
}: {
  title: string;
  rows: T[];
  loading: boolean;
  liveId: string | undefined;
  busyId: string | null;
  getVersion: (row: T) => string;
  onToggle: (id: string, isActive: boolean) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-foreground">
          <thead className="bg-muted text-xs font-semibold uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3">Version</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 hidden md:table-cell">Notes</th>
              <th className="px-3 py-3">Published</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                  Loading releases...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                  No releases published yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isLive = r.id === liveId;
                return (
                  <tr key={r.id} className="hover:bg-accent transition">
                    <td className="px-4 py-3 font-semibold text-foreground font-mono">{getVersion(r)}</td>
                    <td className="px-3 py-3">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> LIVE
                        </span>
                      ) : r.is_active ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          Active (superseded)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-secondary text-muted-foreground border border-border">
                          Rolled back
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground hidden md:table-cell max-w-[280px] truncate" title={r.notes || ''}>
                      {r.notes || '—'}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">
                      {new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {r.is_active ? (
                        <button
                          disabled={busyId === r.id}
                          onClick={() => onToggle(r.id, false)}
                          title="Roll back this release"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Roll back
                        </button>
                      ) : (
                        <button
                          disabled={busyId === r.id}
                          onClick={() => onToggle(r.id, true)}
                          title="Reactivate this release"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
