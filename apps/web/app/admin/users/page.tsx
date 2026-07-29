'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Edit2,
  Key,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  Shield,
  Store,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  UserCheck,
  UserX,
  X,
  Save,
  Lock,
  Crown,
  CircleDot,
} from 'lucide-react';
import apiClient from '@/lib/api-client';

interface UserData {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  business_id: string;
  business_name: string;
  created_at: string;
  updated_at: string;
}

interface UserStoreItem {
  id: string;
  name: string;
  category: string | null;
  is_owner: boolean;
  is_active_workspace: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    role: '',
    business_id: '',
    is_active: true,
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Assigned Store -> All Stores Modal State
  const [storesModalOpen, setStoresModalOpen] = useState(false);
  const [storesModalUser, setStoresModalUser] = useState<UserData | null>(null);
  const [userStores, setUserStores] = useState<UserStoreItem[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState('');

  const rolesList = [
    'super_admin',
    'admin',
    'manager',
    'salesman',
    'cashier',
    'waiter',
    'kitchen_staff',
    'delivery_person',
    'accountant',
  ];

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/api/platform-admin/users', {
        params: {
          search,
          role: selectedRole,
          is_active: selectedStatus,
          page,
          limit,
        },
      });
      setUsers(res.data.data);
      setTotalPages(res.data.meta.totalPages);
      setTotalUsers(res.data.meta.total);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load users data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, selectedRole, selectedStatus, page, limit]);

  const handleToggleStatus = async (user: UserData) => {
    try {
      await apiClient.patch(`/api/platform-admin/users/${user.id}/status`, {
        is_active: !user.is_active,
      });
      setSuccessMessage(`User ${user.full_name || user.email} ${!user.is_active ? 'activated' : 'disabled'}`);
      fetchUsers();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user status');
    }
  };

  const openStoresModal = async (user: UserData) => {
    setStoresModalUser(user);
    setStoresModalOpen(true);
    setStoresLoading(true);
    setStoresError('');
    try {
      const res = await apiClient.get(`/api/platform-admin/users/${user.id}/stores`);
      setUserStores(res.data.stores);
    } catch (err: any) {
      setStoresError(err.response?.data?.message || 'Failed to load stores for this user');
    } finally {
      setStoresLoading(false);
    }
  };

  const openEditModal = (user: UserData) => {
    setCurrentUser(user);
    setEditForm({
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role || 'admin',
      business_id: user.business_id || '',
      is_active: user.is_active,
      password: '',
    });
    setEditModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    try {
      const payload: any = {
        full_name: editForm.full_name,
        email: editForm.email,
        role: editForm.role,
        business_id: editForm.business_id || null,
        is_active: editForm.is_active,
      };
      if (editForm.password) {
        payload.password = editForm.password;
      }

      await apiClient.patch(`/api/platform-admin/users/${currentUser.id}`, payload);
      setSuccessMessage(`User ${editForm.full_name || editForm.email} updated successfully!`);
      setEditModalOpen(false);
      fetchUsers();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user details');
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'super_admin':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
      case 'admin':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30';
      case 'manager':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'salesman':
      case 'cashier':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-secondary text-muted-foreground border-border';
    }
  };

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalUsers);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-600 dark:text-blue-400" />
           Manage User  
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Complete platform tabular view to monitor, edit, update roles, reassign stores, and manage status for all {totalUsers} registered users.
          </p>
        </div>
        <button
          onClick={() => fetchUsers()}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-foreground text-sm font-medium rounded-xl border border-border transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {successMessage}
        </div>
      )}

      {error && (
        <div className="p-5 bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-2xl text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <div>
              <div className="font-bold text-foreground text-base">Authentication Required</div>
              <div className="text-rose-700 dark:text-rose-300/80 text-xs mt-0.5">
                {error}. Please log in with an Admin account to access developer platform features.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/signup"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-semibold text-xs rounded-xl shadow transition"
            >
              Sign Up as Admin
            </a>
            <a
              href="/login"
              className="px-4 py-2 bg-secondary hover:bg-accent text-foreground font-semibold text-xs rounded-xl border border-border transition"
            >
              Log In
            </a>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-card p-4 rounded-xl border border-border">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Role Filter */}
        <div>
          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500 capitalize"
          >
            <option value="">All Roles</option>
            {rolesList.map((r) => (
              <option key={r} value={r}>
                {r.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Disabled Only</option>
          </select>
        </div>

        {/* Clear Filters */}
        <div className="flex items-center">
          <button
            onClick={() => {
              setSearch('');
              setSelectedRole('');
              setSelectedStatus('');
              setPage(1);
            }}
            className="w-full py-2 px-3 text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary hover:bg-accent rounded-xl border border-border transition"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Main Tabular Data View */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground">
            <thead className="bg-muted text-xs font-semibold uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Assigned Store</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                    Loading user records...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    No user accounts found matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-accent transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-secondary to-blue-200 dark:to-blue-950 border border-border flex items-center justify-center font-bold text-sm text-blue-600 dark:text-blue-400">
                          {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{user.full_name || 'Unnamed User'}</div>
                          <div className="text-xs text-muted-foreground font-mono">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border capitalize ${getRoleBadgeColor(user.role)}`}>
                        <Shield className="w-3 h-3" />
                        {user.role?.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {user.email === 'admin@orderflow.com' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <button
                          onClick={() => openStoresModal(user)}
                          className="flex items-center gap-2 text-foreground text-xs font-medium hover:text-blue-600 dark:hover:text-blue-400 transition group"
                        >
                          <Store className="w-3.5 h-3.5 text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                          <span className="underline decoration-dotted underline-offset-2">{user.business_name || 'Unassigned'}</span>
                        </button>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(user)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border transition ${
                          user.is_active
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                        }`}
                      >
                        {user.is_active ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" /> Active
                          </>
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5" /> Disabled
                          </>
                        )}
                      </button>
                    </td>

                    <td className="px-6 py-4 text-xs text-muted-foreground font-mono">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-xs font-medium rounded-lg transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 bg-muted border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              Showing <span className="font-bold text-foreground">{totalUsers > 0 ? startRecord : 0}</span> to{' '}
              <span className="font-bold text-foreground">{endRecord}</span> of{' '}
              <span className="font-bold text-foreground">{totalUsers}</span> users
            </span>

            <div className="flex items-center gap-2 border-l border-border pl-4">
              <span>Per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-card border border-border text-foreground text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 px-3 py-1.5 bg-secondary hover:bg-accent disabled:opacity-40 disabled:hover:bg-accent text-foreground text-xs font-semibold rounded-lg transition"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((pNum) => pNum === 1 || pNum === totalPages || Math.abs(pNum - page) <= 1)
              .map((pNum, i, arr) => {
                const prev = arr[i - 1];
                const showDots = prev && pNum - prev > 1;
                return (
                  <React.Fragment key={pNum}>
                    {showDots && <span className="px-1 text-muted-foreground">...</span>}
                    <button
                      onClick={() => setPage(pNum)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                        page === pNum
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                          : 'bg-card hover:bg-accent text-foreground border border-border'
                      }`}
                    >
                      {pNum}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 px-3 py-1.5 bg-secondary hover:bg-accent disabled:opacity-40 disabled:hover:bg-accent text-foreground text-xs font-semibold rounded-lg transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit User Modal Dialog */}
      {editModalOpen && currentUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Edit User Data
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">System Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500 capitalize"
                >
                  {rolesList.map((r) => (
                    <option key={r} value={r}>
                      {r.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Reset Password (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to keep existing password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="w-4 h-4 rounded bg-background border-border text-blue-600 focus:ring-0"
                  />
                  Account Active & Enabled
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl shadow-lg shadow-blue-600/30 transition"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* All Stores For User Modal */}
      {storesModalOpen && storesModalUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Stores for {storesModalUser.full_name || storesModalUser.email}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Every store this user owns, plus their current active workspace.
                </p>
              </div>
              <button
                onClick={() => setStoresModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-accent transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {storesLoading ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                Loading stores...
              </div>
            ) : storesError ? (
              <div className="py-6 text-center text-rose-600 dark:text-rose-400 text-sm">{storesError}</div>
            ) : userStores.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                This user doesn&apos;t own any stores and has no active workspace assigned.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {userStores.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-xl border border-border"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center font-bold text-xs text-blue-600 dark:text-blue-400 shrink-0">
                        {s.name?.charAt(0) || 'S'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{s.name}</div>
                        {s.category && (
                          <div className="text-[11px] text-muted-foreground capitalize">{s.category}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {s.is_owner && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                          <Crown className="w-3 h-3" /> Owner
                        </span>
                      )}
                      {s.is_active_workspace && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          <CircleDot className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end pt-2 border-t border-border">
              <button
                onClick={() => setStoresModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
