'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { setCurrentUser } from '@/lib/auth';
import { Plus, Store } from 'lucide-react';

interface Business {
  id: string;
  name: string;
  category: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  grocery: 'Grocery Store',
  restaurant: 'Restaurant',
  pharmacy: 'Pharmacy',
  wholesale: 'Wholesale',
  salesman: 'Salesman Order Collection',
  others: 'Others',
};

function categoryLabel(category: string | null) {
  if (!category) return 'No category';
  return CATEGORY_LABELS[category] ?? category;
}

function NewBusinessForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('grocery');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post('/api/businesses/onboard', { name, category });
      localStorage.setItem('access_token', response.data.access_token);
      setCurrentUser(response.data.user);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not create business');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="ring-slate-200/70 shadow-xl shadow-slate-200/60">
      <CardHeader>
        <CardTitle className="text-xl">Add a new business</CardTitle>
        <CardDescription>Set up another workspace for a different category.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input placeholder="Business name" value={name} onChange={(e) => setName(e.target.value)} required />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm"
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 h-11 rounded-xl" disabled={loading}>
              {loading ? 'Creating...' : 'Create Business'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SelectBusinessPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selecting, setSelecting] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const loadBusinesses = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get<Business[]>('/api/businesses/mine');
      setBusinesses(response.data);
      setShowNewForm(response.data.length === 0);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load your businesses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }
    loadBusinesses();
  }, [router]);

  const handleSelect = async (businessId: string) => {
    setSelecting(businessId);
    setError('');
    try {
      const response = await apiClient.post(`/api/businesses/${businessId}/select`);
      localStorage.setItem('access_token', response.data.access_token);
      setCurrentUser(response.data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not switch business');
      setSelecting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading your businesses...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-800">Choose a business</h1>
          <p className="text-sm text-slate-500">Pick a workspace to continue, or add a new category.</p>
        </div>

        {error && <p className="text-sm text-rose-600 text-center">{error}</p>}

        {showNewForm ? (
          <NewBusinessForm
            onCreated={() => router.push('/dashboard')}
            onCancel={() => setShowNewForm(false)}
          />
        ) : (
          <Card className="ring-slate-200/70 shadow-xl shadow-slate-200/60">
            <CardContent className="p-4 space-y-2">
              {businesses.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSelect(b.id)}
                  disabled={selecting !== null}
                  className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors disabled:opacity-50"
                >
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                    <Store className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{b.name}</p>
                    <p className="text-xs text-slate-500">{categoryLabel(b.category)}</p>
                  </div>
                  {selecting === b.id && <span className="text-xs text-slate-400">Switching...</span>}
                </button>
              ))}

              <button
                onClick={() => setShowNewForm(true)}
                disabled={selecting !== null}
                className="w-full flex items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-left hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors disabled:opacity-50"
              >
                <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                  <Plus className="w-4 h-4" />
                </div>
                <p className="font-medium text-slate-800">Add new business</p>
              </button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
