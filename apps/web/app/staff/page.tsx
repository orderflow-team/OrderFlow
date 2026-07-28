'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import {
  Plus,
  X,
  UserCog,
  KeyRound,
  Eye,
  EyeOff,
  Pencil,
  Power,
  Clock,
  Percent,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Calendar,
} from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  cashier: 'Cashier',
  waiter: 'Waiter',
  delivery_person: 'Delivery Person',
  accountant: 'Accountant',
};

const ROLE_OPTIONS = Object.entries(ROLE_LABELS);

interface StaffMember {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  user?: { fullName: string | null; email: string };
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE';
  shift_hours: number;
  notes: string | null;
}

interface CommissionSummary {
  userId: string;
  userName: string;
  totalSales: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
}

export default function StaffPage() {
  const { businessId, ready } = useBusiness();
  const [activeTab, setActiveTab] = useState<'roster' | 'attendance' | 'commissions'>('roster');

  // Business Modules Check (For Custom/Stepwise Attendance & Commission Mode)
  const [hasAttendanceModule, setHasAttendanceModule] = useState(false);
  const [hasCommissionsModule, setHasCommissionsModule] = useState(false);

  // Roster State
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager' });
  const [showFormPassword, setShowFormPassword] = useState(false);

  const [credFormFor, setCredFormFor] = useState<string | null>(null);
  const [credLoading, setCredLoading] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [credError, setCredError] = useState('');
  const [credShowPassword, setCredShowPassword] = useState(false);
  const [credForm, setCredForm] = useState({ name: '', email: '', role: '', currentPassword: '', newPassword: '' });

  // Attendance State
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attActionUserId, setAttActionUserId] = useState<string>('');

  // Commission State
  const [commissionSummaries, setCommissionSummaries] = useState<CommissionSummary[]>([]);
  const [commLoading, setCommLoading] = useState(false);

  const loadBusinessConfig = async (bizId: string) => {
    try {
      const res = await apiClient.get<{ category?: string; customSettings?: any }>(`/api/businesses/${bizId}`);
      const settings = res.data?.customSettings?.modules;
      const category = res.data?.category;

      // Attendance & Commissions are visible if category is 'others' with custom settings OR if explicitly enabled in modules
      const isCustomCategory = category === 'others';
      const attEnabled = Boolean(settings?.attendance ?? isCustomCategory);
      const commEnabled = Boolean(settings?.commissions ?? isCustomCategory);

      setHasAttendanceModule(attEnabled);
      setHasCommissionsModule(commEnabled);
    } catch (err) {
      console.error('Failed to load business config', err);
    }
  };

  const loadRoster = async (bizId: string) => {
    setLoading(true);
    try {
      const res = await apiClient.get<StaffMember[]>('/api/staff', { params: { businessId: bizId } });
      setStaff(res.data);
      if (res.data.length > 0 && !attActionUserId) {
        setAttActionUserId(res.data[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async (bizId: string) => {
    setAttLoading(true);
    try {
      const res = await apiClient.get<AttendanceRecord[]>('/api/staff/attendance/roster', { params: { businessId: bizId } });
      setAttendanceRecords(res.data);
    } catch (err) {
      console.error('Failed to load attendance', err);
    } finally {
      setAttLoading(false);
    }
  };

  const loadCommissions = async (bizId: string) => {
    setCommLoading(true);
    try {
      const res = await apiClient.get<CommissionSummary[]>('/api/staff/commissions/summary', { params: { businessId: bizId } });
      setCommissionSummaries(res.data);
    } catch (err) {
      console.error('Failed to load commissions', err);
    } finally {
      setCommLoading(false);
    }
  };

  useEffect(() => {
    if (ready && businessId) {
      loadBusinessConfig(businessId);
      loadRoster(businessId);
    }
  }, [ready, businessId]);

  useEffect(() => {
    if (businessId && activeTab === 'attendance') {
      loadAttendance(businessId);
    } else if (businessId && activeTab === 'commissions') {
      loadCommissions(businessId);
    }
  }, [activeTab, businessId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/api/staff', { businessId, ...form });
      setForm({ name: '', email: '', password: '', role: 'manager' });
      setShowFormPassword(false);
      setShowForm(false);
      loadRoster(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create staff login');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: StaffMember) => {
    if (!businessId) return;
    if (member.isActive && !confirm(`Deactivate ${member.fullName || member.email}? They will no longer be able to log in.`)) return;
    try {
      await apiClient.patch(`/api/staff/${member.id}`, { isActive: !member.isActive }, { params: { businessId } });
      loadRoster(businessId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update staff');
    }
  };

  const handleViewLogin = async (member: StaffMember) => {
    if (credFormFor === member.id) {
      setCredFormFor(null);
      return;
    }
    setCredFormFor(member.id);
    setCredError('');
    setCredShowPassword(false);
    setCredLoading(true);
    try {
      const res = await apiClient.get<{ email: string; password: string | null }>(`/api/staff/${member.id}/credentials`, { params: { businessId } });
      setCredForm({ name: member.fullName || '', email: res.data.email, role: member.role, currentPassword: res.data.password || '', newPassword: '' });
    } catch (err: any) {
      setCredError(err.response?.data?.message || 'Failed to load login details');
    } finally {
      setCredLoading(false);
    }
  };

  const handleSaveLogin = async (e: React.FormEvent, memberId: string) => {
    e.preventDefault();
    if (!businessId) return;
    setCredSaving(true);
    setCredError('');
    try {
      const body: { name?: string; email?: string; role?: string; password?: string } = {
        name: credForm.name,
        email: credForm.email,
        role: credForm.role,
      };
      if (credForm.newPassword) body.password = credForm.newPassword;
      await apiClient.patch(`/api/staff/${memberId}`, body, { params: { businessId } });
      setCredFormFor(null);
      loadRoster(businessId);
    } catch (err: any) {
      setCredError(err.response?.data?.message || 'Failed to update login');
    } finally {
      setCredSaving(false);
    }
  };

  const handleClockIn = async (userId: string) => {
    if (!businessId) return;
    try {
      await apiClient.post('/api/staff/attendance/clock-in', { businessId, userId });
      loadAttendance(businessId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Clock-in failed');
    }
  };

  const handleClockOut = async (userId: string) => {
    if (!businessId) return;
    try {
      await apiClient.post('/api/staff/attendance/clock-out', { businessId, userId });
      loadAttendance(businessId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Clock-out failed');
    }
  };

  if (!ready) return null;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
        <PageHeader
          title="Staff & Team"
          description="Manage team logins, shift attendance, and sales commissions."
          action={
            activeTab === 'roster' ? (
              <Button onClick={() => setShowForm((s) => !s)} className="gap-1.5">
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showForm ? 'Cancel' : 'Add Staff'}
              </Button>
            ) : null
          }
        />

        {/* Tab Switcher (Attendance & Commissions only visible if enabled in Custom/Stepwise options) */}
        {(hasAttendanceModule || hasCommissionsModule) && (
          <div className="flex items-center gap-2 p-1.5 bg-slate-200/50 backdrop-blur-md rounded-2xl w-fit border border-slate-200">
            <button
              onClick={() => setActiveTab('roster')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'roster' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCog className="w-3.5 h-3.5" /> Team Roster
            </button>
            {hasAttendanceModule && (
              <button
                onClick={() => setActiveTab('attendance')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'attendance' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-emerald-600" /> Shift Attendance
              </button>
            )}
            {hasCommissionsModule && (
              <button
                onClick={() => setActiveTab('commissions')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                  activeTab === 'commissions' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Percent className="w-3.5 h-3.5 text-sky-600" /> Commission Ledger
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}

        {/* TAB 1: TEAM ROSTER */}
        {activeTab === 'roster' && (
          <>
            {showForm && (
              <Card className="ring-white/50 glass-sheen-sm">
                <CardContent className="pt-6">
                  <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    <div className="relative">
                      <Input
                        type={showFormPassword ? 'text' : 'password'}
                        placeholder="Password (min 6 chars)"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        minLength={6}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600"
                      >
                        {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="h-10 rounded-full border border-transparent bg-white/35 backdrop-blur-md px-4 text-sm ring-1 ring-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
                    >
                      {ROLE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <p className="text-sm text-slate-400">Loading roster...</p>
            ) : staff.length === 0 ? (
              <div className="p-12 text-center bg-white/40 backdrop-blur-xl rounded-3xl ring-1 ring-white/50">
                <UserCog className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No staff logins yet.</p>
              </div>
            ) : (
              <Card className="ring-white/50 glass-sheen-sm">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-emerald-600" />
                    <CardTitle className="text-base">Staff &amp; Logins</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {staff.map((member) => (
                      <div key={member.id} className="px-6 py-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-800 truncate">{member.fullName || member.email}</p>
                              <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-700 ring-1 ring-sky-500/20 uppercase tracking-wide">
                                {ROLE_LABELS[member.role] || member.role}
                              </span>
                              {!member.isActive && (
                                <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/20 uppercase tracking-wide">
                                  Deactivated
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate">{member.email}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 gap-1.5 text-xs"
                            onClick={() => handleViewLogin(member)}
                          >
                            <KeyRound className="w-3.5 h-3.5" /> {credFormFor === member.id ? 'Close' : 'View / Edit Login'}
                          </Button>
                          <button
                            onClick={() => handleToggleActive(member)}
                            className={`shrink-0 p-1.5 transition-colors ${member.isActive ? 'text-slate-300 hover:text-rose-600' : 'text-slate-300 hover:text-emerald-600'}`}
                            title={member.isActive ? 'Deactivate' : 'Reactivate'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </div>

                        {credFormFor === member.id && (
                          <div className="mt-3">
                            {credLoading ? (
                              <p className="text-sm text-slate-400">Loading...</p>
                            ) : (
                              <form onSubmit={(e) => handleSaveLogin(e, member.id)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                <Input
                                  placeholder="Name"
                                  value={credForm.name}
                                  onChange={(e) => setCredForm({ ...credForm, name: e.target.value })}
                                  required
                                />
                                <Input
                                  type="email"
                                  placeholder="Email"
                                  value={credForm.email}
                                  onChange={(e) => setCredForm({ ...credForm, email: e.target.value })}
                                  required
                                />
                                <select
                                  value={credForm.role}
                                  onChange={(e) => setCredForm({ ...credForm, role: e.target.value })}
                                  className="h-10 rounded-full border border-transparent bg-white/35 backdrop-blur-md px-4 text-sm ring-1 ring-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
                                >
                                  {ROLE_OPTIONS.map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                  ))}
                                </select>
                                <div className="relative">
                                  <Input
                                    type={credShowPassword ? 'text' : 'password'}
                                    placeholder="Current password"
                                    value={credShowPassword ? credForm.currentPassword : '••••••••'}
                                    readOnly
                                    className="pr-10"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setCredShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600"
                                  >
                                    {credShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                </div>
                                <Input
                                  type="text"
                                  placeholder="New password (optional)"
                                  value={credForm.newPassword}
                                  onChange={(e) => setCredForm({ ...credForm, newPassword: e.target.value })}
                                  minLength={6}
                                />
                                <div className="flex gap-2 lg:col-span-3">
                                  <Button type="submit" size="sm" disabled={credSaving} className="gap-1.5">
                                    <Pencil className="w-3.5 h-3.5" /> {credSaving ? 'Saving...' : 'Save changes'}
                                  </Button>
                                  <Button type="button" size="sm" variant="ghost" onClick={() => setCredFormFor(null)}>
                                    Cancel
                                  </Button>
                                </div>
                                {credError && <p className="lg:col-span-4 text-sm text-rose-600">{credError}</p>}
                              </form>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* TAB 2: SHIFT ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <CardTitle className="text-base">Shift Clock In / Clock Out</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={attActionUserId}
                    onChange={(e) => setAttActionUserId(e.target.value)}
                    className="h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName || s.email} ({ROLE_LABELS[s.role] || s.role})
                      </option>
                    ))}
                  </select>
                  <Button onClick={() => handleClockIn(attActionUserId)} disabled={!attActionUserId} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 text-xs">
                    <Clock className="w-3.5 h-3.5" /> Clock In Now
                  </Button>
                  <Button onClick={() => handleClockOut(attActionUserId)} disabled={!attActionUserId} variant="outline" className="gap-1.5 text-xs text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-rose-600" /> Clock Out
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-600" />
                    <CardTitle className="text-base">Recent Attendance Roster</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {attLoading ? (
                  <p className="p-6 text-xs text-slate-400">Loading attendance records...</p>
                ) : attendanceRecords.length === 0 ? (
                  <p className="p-6 text-xs text-slate-400">No shift attendance logged yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {attendanceRecords.map((r) => (
                      <div key={r.id} className="px-6 py-3.5 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-semibold text-slate-800">{r.user?.fullName || r.user?.email || 'Staff Member'}</p>
                          <p className="text-slate-400">{r.date}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {r.status}
                          </span>
                          <p className="text-slate-500 mt-1">
                            {r.clock_in ? new Date(r.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                            {' → '}
                            {r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                            {r.shift_hours > 0 ? ` (${r.shift_hours} hrs)` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3: COMMISSION LEDGER */}
        {activeTab === 'commissions' && (
          <div className="space-y-6">
            <Card className="ring-white/50 glass-sheen-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-sky-600" />
                  <CardTitle className="text-base">Commission Performance Summary</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {commLoading ? (
                  <p className="p-6 text-xs text-slate-400">Loading commission summaries...</p>
                ) : commissionSummaries.length === 0 ? (
                  <p className="p-6 text-xs text-slate-400">No commission records tracked yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {commissionSummaries.map((s) => (
                      <div key={s.userId} className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{s.userName}</p>
                          <p className="text-slate-500">Total Sales: ₹{s.totalSales.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div>
                            <span className="text-slate-400 block text-[10px]">TOTAL EARNED</span>
                            <span className="font-bold text-slate-800">₹{s.totalCommission.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">PENDING PAYOUT</span>
                            <span className="font-bold text-amber-600">₹{s.pendingCommission.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">PAID</span>
                            <span className="font-bold text-emerald-600">₹{s.paidCommission.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
