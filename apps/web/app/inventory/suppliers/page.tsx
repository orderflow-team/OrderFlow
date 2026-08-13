'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import apiClient from '@/lib/api-client';
import { useBusiness } from '@/lib/use-business';
import { Plus, ArrowLeft, Warehouse, Pencil, Trash2, Search } from 'lucide-react';
import { SupplierFormDialog, type Supplier } from './supplier-form-dialog';

export default function SuppliersPage() {
  const { businessId, ready } = useBusiness();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const load = async (bizId: string) => {
    setLoading(true);
    try {
      const res = await apiClient.get<Supplier[]>('/api/suppliers', { params: { businessId: bizId } });
      setSuppliers(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && businessId) load(businessId);
  }, [ready, businessId]);

  const handleDelete = async (id: string) => {
    if (!businessId) return;
    if (!confirm('Delete this supplier? Purchase orders already linked to them will keep showing their name.')) return;
    await apiClient.delete(`/api/suppliers/${id}`, { params: { businessId } });
    load(businessId);
  };

  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  if (!ready) return null;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Suppliers"
          description="Full supplier records — contact details, GST/compliance, commercial terms, and banking."
          action={
            <div className="flex items-center gap-2">
              <Link href="/inventory">
                <Button variant="outline" className="gap-1.5"><ArrowLeft className="w-4 h-4" /> Back to Inventory</Button>
              </Link>
              <Button onClick={() => { setEditingSupplier(null); setFormOpen(true); }} className="gap-1.5">
                <Plus className="w-4 h-4" /> Add Supplier
              </Button>
            </div>
          }
        />

        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers..."
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/40 backdrop-blur-md ring-1 ring-white/50 text-sm outline-none"
          />
        </div>

        <Card className="ring-white/50 glass-sheen-sm">
          <CardContent className="p-0">
            {loading ? (
              <p className="p-10 text-center text-slate-400 text-sm">Loading...</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-24 h-24 bg-white/40 backdrop-blur-sm ring-1 ring-white/50 rounded-full flex items-center justify-center mb-6">
                  <Warehouse className="w-10 h-10 text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">No suppliers found</h2>
                <p className="text-slate-500 mb-8 text-sm">Add a supplier to manage your supply chain</p>
                <Button onClick={() => { setEditingSupplier(null); setFormOpen(true); }} className="gap-2 px-6 h-11">
                  <Plus className="w-4 h-4" /> Add Supplier
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto w-full"><table className="w-full text-sm text-left min-w-[900px]">
                <thead className="text-xs text-slate-500 uppercase bg-white/30 border-b border-white/40">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3">Location</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Payment Terms</th>
                    <th className="px-6 py-3 text-right">Credit Limit</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-white/40 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">
                        <span className="inline-flex items-center gap-1.5">
                          {s.name}
                          {s.linked_business_id && (
                            <span className="text-[10px] font-semibold text-sky-700 bg-sky-100/80 px-1.5 py-0.5 rounded-full">Linked via OBIX</span>
                          )}
                        </span>
                        {s.contact_person && <div className="text-xs text-slate-400 font-normal">{s.contact_person}</div>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {s.phone || '—'}
                        {s.email && <div className="text-xs text-slate-400">{s.email}</div>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{[s.city, s.state].filter(Boolean).join(', ') || '—'}</td>
                      <td className="px-6 py-4 text-slate-600 capitalize">{s.supplier_type?.replace('_', ' ') || '—'}</td>
                      <td className="px-6 py-4 text-slate-600 capitalize">{s.payment_terms?.replace('_', ' ') || '—'}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{Number(s.credit_limit) > 0 ? `₹${Number(s.credit_limit).toFixed(2)}` : '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.is_active ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-500/10 text-slate-500'}`}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => { setEditingSupplier(s); setFormOpen(true); }} className="text-slate-400 hover:text-slate-700">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(s.id)} className="text-slate-400 hover:text-rose-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </CardContent>
        </Card>
      </div>

      {businessId && (
        <SupplierFormDialog
          businessId={businessId}
          open={formOpen}
          onOpenChange={setFormOpen}
          editingSupplier={editingSupplier}
          onSaved={() => load(businessId)}
        />
      )}
    </AppShell>
  );
}
