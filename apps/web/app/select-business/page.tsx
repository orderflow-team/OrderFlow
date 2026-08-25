'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { getCurrentUser, setCurrentUser, getPostLoginPath } from '@/lib/auth';
import { categoryDefaultsToInventory } from '@/lib/business-modules';
import { Plus, Store, Sliders } from 'lucide-react';
import { CustomBusinessWizard } from '@/components/custom-business-wizard';

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
  others: 'Others (Customized Stepwise)',
};

function categoryLabel(category: string | null) {
  if (!category) return 'No category';
  return CATEGORY_LABELS[category] ?? category;
}

function NewBusinessForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('grocery');
  const [inventoryEnabled, setInventoryEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCustomWizard, setShowCustomWizard] = useState(false);

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setInventoryEnabled(categoryDefaultsToInventory(value));
    if (value === 'others') {
      setShowCustomWizard(true);
    }
  };

  const handleStandardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (category === 'others') {
      setShowCustomWizard(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post('/api/businesses/onboard', { name, phone, category, inventoryEnabled });
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
      setCurrentUser(response.data.user);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not create business');
    } finally {
      setLoading(false);
    }
  };

  const handleWizardComplete = async (wizardData: any) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post('/api/businesses/onboard', wizardData);
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
      setCurrentUser(response.data.user);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not create custom business');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  if (showCustomWizard || category === 'others') {
    return (
      <CustomBusinessWizard
        initialName={name}
        onComplete={handleWizardComplete}
        onCancel={() => {
          setShowCustomWizard(false);
          setCategory('grocery');
        }}
        loading={loading}
      />
    );
  }

  return (
    <Card className="ring-white/50 glass-sheen-sm">
      <CardHeader>
        <CardTitle className="text-xl">Add a new business</CardTitle>
        <CardDescription>Set up another workspace for a different category.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleStandardSubmit} className="space-y-4">
          <Input placeholder="Business name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Category</label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full h-11 rounded-full border border-transparent bg-white/35 backdrop-blur-md px-4 text-sm ring-1 ring-white/50 shadow-[inset_0_1px_2px_rgba(255,255,255,0.6),inset_0_-1px_3px_rgba(148,163,184,0.2)] focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {category === 'others' ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
              <Sliders className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Selecting <strong>Others</strong> opens the Stepwise Custom Builder to customize every module & term from scratch.</span>
            </div>
          ) : (
            <label className="flex items-center gap-2.5 px-4 py-3 bg-white/35 backdrop-blur-md rounded-2xl border border-transparent ring-1 ring-white/50 cursor-pointer hover:bg-white/45 transition-colors">
              <input
                type="checkbox"
                checked={inventoryEnabled}
                onChange={(e) => setInventoryEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Enable Inventory module
                <span className="block text-xs font-normal text-slate-500">Track stock, purchase orders, and low-stock alerts</span>
              </span>
            </label>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1 h-11 rounded-xl" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 h-11 rounded-xl" disabled={loading}>
              {loading ? 'Creating...' : category === 'others' ? 'Configure Stepwise Wizard' : 'Create Business'}
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
      if (err.response?.status === 401) {
        router.push('/login');
        return;
      }
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
    const role = getCurrentUser()?.role;
    if (role === 'salesman' || role === 'kitchen_staff') {
      router.push(getPostLoginPath(role));
      return;
    }
    loadBusinesses();
  }, []);

  const handleSelect = async (businessId: string) => {
    setSelecting(businessId);
    setError('');
    try {
      const response = await apiClient.post(`/api/businesses/${businessId}/select`);
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
      setCurrentUser(response.data.user);
      // Hard navigation resets all app state for the newly selected business; target "/"
      // since that's the only path Capacitor's local server always resolves correctly —
      // root page.tsx's own logic then routes to the right destination.
      window.location.href = '/';
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

  const isWideWizard = showNewForm;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85vw] h-[75vh] max-w-[70rem] max-h-[45rem] min-w-[36rem] min-h-[28rem] rounded-full bg-sky-300/55 blur-3xl" />
        <div className="absolute -top-1/4 -left-1/4 w-[55vw] h-[55vw] max-w-[42rem] max-h-[42rem] min-w-[26rem] min-h-[26rem] rounded-full bg-emerald-300/50 blur-3xl" />
        <div className="absolute -top-1/4 -right-1/4 w-[55vw] h-[55vw] max-w-[42rem] max-h-[42rem] min-w-[26rem] min-h-[26rem] rounded-full bg-teal-300/50 blur-3xl" />
      </div>
      <div className={`w-full ${isWideWizard ? 'max-w-2xl' : 'max-w-md'} space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-700 transition-all`}>
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
          <Card className="ring-white/50 glass-sheen-sm">
            <CardContent className="p-4 space-y-2">
              {businesses.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSelect(b.id)}
                  disabled={selecting !== null}
                  className="w-full flex items-center gap-3 rounded-2xl border border-white/40 ring-1 ring-white/50 bg-white/40 hover:bg-white/60 active:scale-[0.98] px-4 py-3 text-left transition-all disabled:opacity-50 glass-sheen-sm"
                >
                  <div className="p-2 rounded-full bg-emerald-500/15 backdrop-blur-sm text-emerald-600">
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
                className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-white/60 bg-white/20 hover:bg-white/40 active:scale-[0.98] px-4 py-3 text-left transition-all disabled:opacity-50 mt-2"
              >
                <div className="p-2 rounded-full bg-white/40 backdrop-blur-sm text-slate-600">
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
