'use client';

import { Fragment, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import apiClient from '@/lib/api-client';
import type { PoFieldConfig } from '@/lib/business-modules';
import { Plus, Warehouse, CheckCircle2, ChevronDown, ChevronRight, Pencil, XCircle, IndianRupee } from 'lucide-react';
import type { EditingPo } from './purchase-order-form';

interface Product {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface PurchaseOrder {
  id: string;
  order_number: string;
  status: string;
  supplier_id: string | null;
  total_amount: string | number;
  items?: {
    id: string;
    quantity: string | number;
    unit_price: string | number;
    tax_percentage?: string | number;
    scheme_quantity?: string | number | null;
    subtotal: string | number;
    batch_number?: string | null;
    expiry_date?: string | null;
    supplier_id?: string | null;
    product?: Product;
  }[];
}

export function PurchaseOrderList({
  businessId,
  purchaseOrders,
  suppliers,
  fieldConfig,
  loading,
  onChanged,
  onEdit,
  onCreateNew,
}: {
  businessId: string;
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  fieldConfig: PoFieldConfig;
  loading: boolean;
  onChanged: () => void;
  onEdit: (po: EditingPo) => void;
  onCreateNew: () => void;
}) {
  const [expandedPo, setExpandedPo] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const supplierName = (id: string | null | undefined) => suppliers.find((s) => s.id === id)?.name;

  const runAction = async (id: string, action: 'confirm' | 'receive' | 'mark-paid' | 'cancel') => {
    setBusyId(id);
    try {
      await apiClient.post(`/api/inventory/purchase-orders/${id}/${action}`, {}, { params: { businessId } });
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <p className="p-10 text-center text-slate-400 text-sm">Loading...</p>;
  }

  if (purchaseOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white/40 backdrop-blur-md rounded-2xl ring-1 ring-white/50 glass-sheen-sm">
        <div className="w-24 h-24 bg-white/40 backdrop-blur-sm ring-1 ring-white/50 rounded-full flex items-center justify-center mb-6">
          <Warehouse className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">No purchase orders</h2>
        <p className="text-slate-500 mb-8 text-sm">Create a purchase order to restock items</p>
        <Button onClick={onCreateNew} className="gap-2 px-6 h-11">
          <Plus className="w-4 h-4" /> New Purchase Order
        </Button>
      </div>
    );
  }

  return (
    <Card className="ring-white/50 glass-sheen-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto w-full pb-2"><table className="w-full text-sm text-left min-w-[900px]">
          <thead className="text-xs text-slate-500 uppercase bg-white/30 border-b border-white/40">
            <tr>
              <th className="px-6 py-3 w-10"></th>
              <th className="px-6 py-3">PO #</th>
              <th className="px-6 py-3">Supplier</th>
              <th className="px-6 py-3 text-right">Total</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchaseOrders.map((po) => {
              const isBusy = busyId === po.id;
              const canEdit = po.status !== 'cancelled';
              return (
              <Fragment key={po.id}>
                <tr className="hover:bg-white/40 transition-colors">
                  <td className="px-6 py-4 cursor-pointer" onClick={() => setExpandedPo(expandedPo === po.id ? null : po.id)}>
                    {expandedPo === po.id ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800 cursor-pointer" onClick={() => setExpandedPo(expandedPo === po.id ? null : po.id)}>{po.order_number}</td>
                  <td className="px-6 py-4 text-slate-600">{supplierName(po.supplier_id) || '—'}</td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-800">₹{Number(po.total_amount).toFixed(2)}</td>
                  <td className="px-6 py-4"><StatusBadge status={po.status} /></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-3 flex-wrap">
                      {canEdit && (
                        <button
                          disabled={isBusy}
                          onClick={() => onEdit(po as EditingPo)}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 font-semibold hover:text-slate-700"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                      {po.status === 'draft' && (
                        <button disabled={isBusy} onClick={() => runAction(po.id, 'confirm')} className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                        </button>
                      )}
                      {(po.status === 'draft' || po.status === 'confirmed') && (
                        <>
                          <button disabled={isBusy} onClick={() => runAction(po.id, 'receive')} className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Mark Received
                          </button>
                          <button disabled={isBusy} onClick={() => runAction(po.id, 'cancel')} className="inline-flex items-center gap-1 text-xs text-rose-600 font-semibold hover:text-rose-700">
                            <XCircle className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </>
                      )}
                      {po.status === 'received' && (
                        <button disabled={isBusy} onClick={() => runAction(po.id, 'mark-paid')} className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-700">
                          <IndianRupee className="w-3.5 h-3.5" /> Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedPo === po.id && po.items && po.items.length > 0 && (
                  <tr className="bg-white/20">
                    <td colSpan={6} className="px-14 py-4">
                      <div className="rounded-2xl ring-1 ring-white/50 overflow-hidden bg-white/30 backdrop-blur-md">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-slate-500 bg-white/30 border-b border-white/40 uppercase">
                            <tr>
                              <th className="px-4 py-2">Item</th>
                              {fieldConfig.batchExpiry && <th className="px-4 py-2">Batch / Expiry</th>}
                              {fieldConfig.schemeQuantity && <th className="px-4 py-2 text-right">Scheme</th>}
                              <th className="px-4 py-2">Supplier</th>
                              <th className="px-4 py-2 text-right">Qty</th>
                              <th className="px-4 py-2 text-right">Unit Price</th>
                              <th className="px-4 py-2 text-right">Tax %</th>
                              <th className="px-4 py-2 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {po.items.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 font-medium text-slate-700">{item.product?.name || 'Unknown Product'}</td>
                                {fieldConfig.batchExpiry && (
                                  <td className="px-4 py-2 text-slate-500 text-xs">
                                    {item.batch_number || '—'}
                                    {item.expiry_date ? ` • Exp ${new Date(item.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}
                                  </td>
                                )}
                                {fieldConfig.schemeQuantity && (
                                  <td className="px-4 py-2 text-right text-slate-500 text-xs">{item.scheme_quantity || '—'}</td>
                                )}
                                <td className="px-4 py-2 text-slate-500 text-xs">{supplierName(item.supplier_id) || '—'}</td>
                                <td className="px-4 py-2 text-right text-slate-600">{Number(item.quantity)}</td>
                                <td className="px-4 py-2 text-right text-slate-600">₹{Number(item.unit_price).toFixed(2)}</td>
                                <td className="px-4 py-2 text-right text-slate-500 text-xs">{Number(item.tax_percentage) || 0}%</td>
                                <td className="px-4 py-2 text-right font-medium text-slate-700">₹{Number(item.subtotal).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
              );
            })}
          </tbody>
        </table></div>
      </CardContent>
    </Card>
  );
}
