'use client';

import { useEffect, useState } from 'react';
import { Rocket, RefreshCw, CheckCircle2, RotateCcw, PlayCircle, ChevronDown } from 'lucide-react';
import apiClient from '@/lib/api-client';

// Same default as CollapsibleList (components/collapsible-list.tsx) — kept
// consistent across the app rather than reusing that component directly,
// since it wraps rows in a <div> and can't sit inside a <table>'s <tbody>.
const COLLAPSE_LIMIT = 5;

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

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'ota' | 'apk'>('ota');
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !version) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('platform', 'android');
      if (uploadType === 'ota') {
        formData.append('version', version);
        formData.append('notes', notes);
        await apiClient.post('/api/app-updates', formData);
      } else {
        formData.append('versionName', version);
        formData.append('notes', notes);
        await apiClient.post('/api/app-apk-releases', formData);
      }
      setUploadModalOpen(false);
      setSelectedFile(null);
      setVersion('');
      setNotes('');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to publish release');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Rocket className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            App Releases
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            OTA (JS bundle) and native APK release history — publish live updates directly to installed apps.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-xl shadow-md transition"
          >
            <Rocket className="w-4 h-4" />
            Publish New Release 🚀
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground text-sm font-medium rounded-xl border border-border transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
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

      {/* Upload Release Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Rocket className="w-5 h-5 text-blue-500" />
              Publish App Release
            </h3>

            <form onSubmit={handlePublish} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Release Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadType('ota')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${
                      uploadType === 'ota'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-background text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    OTA JS Bundle (.zip)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadType('apk')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${
                      uploadType === 'apk'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-background text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    Native APK (.apk)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Version (e.g. 1.2.5)</label>
                <input
                  type="text"
                  required
                  placeholder="1.2.5"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Release Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Subscription badge and bug fixes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Select {uploadType === 'ota' ? '.zip Bundle File' : '.apk File'}
                </label>
                <input
                  type="file"
                  required
                  accept={uploadType === 'ota' ? '.zip' : '.apk'}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-foreground file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-secondary file:text-foreground hover:file:bg-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile || !version}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {uploading ? 'Publishing...' : 'Publish Release 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? rows : rows.slice(0, COLLAPSE_LIMIT);
  const hiddenCount = rows.length - COLLAPSE_LIMIT;

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
              visibleRows.map((r) => {
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
            {!loading && hiddenCount > 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
                  >
                    {expanded ? 'Show less' : `Show ${hiddenCount} more`}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
