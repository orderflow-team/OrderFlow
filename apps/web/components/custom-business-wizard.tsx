'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, ChevronLeft, ChevronRight, Plus, Sliders, X } from 'lucide-react';
import { CustomBusinessSettings } from '@/lib/business-modules';
import {
  BUSINESS_PRESETS,
  CustomField,
  FieldType,
  MODULE_INFO,
  ModuleKey,
  presetById,
} from '@/lib/business-presets';

export type CustomBusinessWizardResult = {
  name: string;
  category: 'others';
  inventoryEnabled: boolean;
  currency: string;
  timezone: string;
  address?: string;
  phone?: string;
  gstNumber?: string;
  customSettings: CustomBusinessSettings;
};

interface CustomBusinessWizardProps {
  initialName?: string;
  initialPhone?: string;
  initialAddress?: string;
  initialGstNumber?: string;
  /** Existing settings when re-customising from Settings — the wizard starts from these. */
  initialSettings?: CustomBusinessSettings | null;
  mode?: 'create' | 'edit';
  onComplete: (data: CustomBusinessWizardResult) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}

const STEPS = ['Your business', 'Features', 'Make it yours'];
const MODULE_ORDER: ModuleKey[] = ['inventory', 'staff', 'expenses', 'restaurant', 'salesman', 'ai_assistant'];
const FIELD_TYPES: { id: FieldType; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'number', label: 'Number' },
  { id: 'date', label: 'Date' },
  { id: 'boolean', label: 'Yes / No' },
];
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function initialModules(s?: CustomBusinessSettings | null): Record<ModuleKey, boolean> | null {
  if (!s?.modules) return null;
  return {
    inventory: s.modules.inventory !== false,
    staff: s.modules.staff === true,
    expenses: s.modules.expenses === true,
    restaurant: s.modules.restaurant === true,
    salesman: s.modules.salesman === true,
    ai_assistant: s.modules.ai_assistant !== false,
  };
}

export function CustomBusinessWizard({
  initialName = '',
  initialPhone = '',
  initialAddress = '',
  initialGstNumber = '',
  initialSettings,
  mode = 'create',
  onComplete,
  onCancel,
  loading,
}: CustomBusinessWizardProps) {
  const startPreset = presetById(initialSettings?.terminology?.preset) ?? null;
  const fallback = startPreset ?? BUSINESS_PRESETS[0];

  const [step, setStep] = useState(1);
  const [error, setError] = useState('');

  // Step 1
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [presetId, setPresetId] = useState<string | null>(startPreset?.id ?? (initialSettings?.terminology ? 'general' : null));

  // Step 2
  const [modules, setModules] = useState<Record<ModuleKey, boolean>>(initialModules(initialSettings) ?? fallback.modules);
  const [batchExpiry, setBatchExpiry] = useState<boolean>(
    initialSettings?.moduleConfig?.inventorySettings?.enableBatchExpiry ?? Boolean(fallback.batchExpiry),
  );

  // Step 3
  const t = initialSettings?.terminology;
  const [labels, setLabels] = useState({
    productsLabel: t?.productsLabel || fallback.terminology.productsLabel,
    ordersLabel: t?.ordersLabel || fallback.terminology.ordersLabel,
    customersLabel: t?.customersLabel || fallback.terminology.customersLabel,
    staffLabel: t?.staffLabel || fallback.terminology.staffLabel,
    skuLabel: t?.skuLabel || fallback.terminology.skuLabel,
    priceLabel: t?.priceLabel || fallback.terminology.priceLabel,
  });
  const [categories, setCategories] = useState<string[]>(initialSettings?.categories?.length ? initialSettings.categories : fallback.categories);
  const [newCategory, setNewCategory] = useState('');
  const [productFields, setProductFields] = useState<CustomField[]>(initialSettings?.productCustomFields ?? fallback.productFields);
  const [customerFields, setCustomerFields] = useState<CustomField[]>(initialSettings?.customerCustomFields ?? fallback.customerFields);
  const [newField, setNewField] = useState<{ target: 'product' | 'customer'; name: string; type: FieldType }>({ target: 'product', name: '', type: 'text' });
  const [address, setAddress] = useState(initialAddress);
  const [gstNumber, setGstNumber] = useState(initialGstNumber);

  const pickPreset = (id: string) => {
    const p = presetById(id);
    if (!p) return;
    setPresetId(id);
    // A preset is a starting point: it sets features and wording to fit the business type.
    setModules(p.modules);
    setBatchExpiry(Boolean(p.batchExpiry));
    setLabels({ ...p.terminology });
    if (mode === 'edit') {
      // Never throw away what an existing business already set up — just add the new suggestions.
      const mergeFields = (have: CustomField[], add: CustomField[]) => [
        ...have,
        ...add.filter((f) => !have.some((h) => h.name.toLowerCase() === f.name.toLowerCase())),
      ];
      setCategories((have) => [...have, ...p.categories.filter((c) => !have.some((h) => h.toLowerCase() === c.toLowerCase()))]);
      setProductFields((have) => mergeFields(have, p.productFields));
      setCustomerFields((have) => mergeFields(have, p.customerFields));
    } else {
      setCategories(p.categories);
      setProductFields(p.productFields);
      setCustomerFields(p.customerFields);
    }
  };

  const goNext = () => {
    setError('');
    if (step === 1) {
      if (!name.trim()) return setError('Please enter your business name.');
      // Required: it's how customers and other OBIX businesses find you (the app asks for it right after setup otherwise).
      if (phone.replace(/\D/g, '').length < 10) return setError('Please enter a valid mobile number (10 digits).');
      if (!presetId) return setError('Pick the option closest to your business.');
    }
    setStep((s) => Math.min(STEPS.length, s + 1));
  };

  const addCategory = () => {
    const c = newCategory.trim();
    if (c && !categories.some((x) => x.toLowerCase() === c.toLowerCase())) setCategories([...categories, c]);
    setNewCategory('');
  };

  const addField = () => {
    const n = newField.name.trim();
    if (!n) return;
    const list = newField.target === 'product' ? productFields : customerFields;
    if (list.some((f) => f.name.toLowerCase() === n.toLowerCase())) return;
    const next = [...list, { name: n, type: newField.type }];
    if (newField.target === 'product') setProductFields(next);
    else setCustomerFields(next);
    setNewField({ ...newField, name: '' });
  };

  const submit = async () => {
    setError('');
    if (!name.trim()) {
      setStep(1);
      return setError('Please enter your business name.');
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setStep(1);
      return setError('Please enter a valid mobile number (10 digits).');
    }
    const gst = gstNumber.trim().toUpperCase();
    if (gst && !GSTIN.test(gst)) {
      setStep(3);
      return setError('That GSTIN doesn’t look right — it should be 15 characters, like 24ABCDE1234F1Z5.');
    }
    const base = initialSettings ?? {};
    const customSettings: CustomBusinessSettings = {
      ...base,
      modules: {
        ...(base.modules ?? {}),
        products: true,
        orders: true,
        customers: true,
        billing: true,
        reports: true,
        inventory: modules.inventory,
        staff: modules.staff,
        attendance: modules.staff,
        commissions: modules.staff,
        expenses: modules.expenses,
        restaurant: modules.restaurant,
        salesman: modules.salesman,
        ai_assistant: modules.ai_assistant,
      },
      moduleConfig: {
        ...(base.moduleConfig ?? {}),
        inventorySettings: {
          ...(base.moduleConfig?.inventorySettings ?? {}),
          enableBatchExpiry: modules.inventory && batchExpiry,
          enablePurchaseOrders: modules.inventory,
        },
      },
      terminology: { preset: presetId ?? 'general', ...labels },
      categories,
      productCustomFields: productFields,
      customerCustomFields: customerFields,
      customFields: [...productFields, ...customerFields],
    };
    try {
      await onComplete({
        name: name.trim(),
        category: 'others',
        inventoryEnabled: modules.inventory,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        gstNumber: gst || undefined,
        customSettings,
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Could not save your business. Please try again.');
    }
  };

  const preset = presetById(presetId);

  return (
    <Card className="ring-white/50 glass-sheen-sm border-0 shadow-2xl overflow-hidden max-w-2xl w-full mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600/90 via-teal-600/90 to-cyan-600/90 p-5 text-white">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
            <Sliders className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">{mode === 'edit' ? 'Customize your business' : 'Set up your business'}</h2>
            <p className="text-xs text-white/80">
              Step {step} of {STEPS.length} — {STEPS[step - 1]}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-white' : 'bg-white/30'}`} />
          ))}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* STEP 1 — name + business type */}
        {step === 1 && (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Business name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sharma Salon" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Mobile number</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" inputMode="tel" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">What kind of business is it?</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {BUSINESS_PRESETS.map((p) => {
                  const on = p.id === presetId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickPreset(p.id)}
                      className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 text-center transition-colors ${
                        on ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30' : 'border-slate-200 bg-white/70 hover:border-emerald-300'
                      }`}
                    >
                      {on && <Check className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-emerald-600" />}
                      <span className="text-2xl leading-none">{p.emoji}</span>
                      <span className="text-[11px] font-semibold text-slate-700 leading-tight">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* STEP 2 — features */}
        {step === 2 && (
          <>
            <p className="text-sm text-slate-600">
              We’ve switched on what a <strong>{preset?.label ?? 'business like yours'}</strong> usually needs. Orders, billing, customers, {labels.productsLabel.toLowerCase()} and reports are always on.
            </p>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {MODULE_ORDER.map((key) => {
                const on = modules[key];
                return (
                  <div key={key} className={`rounded-2xl border p-3.5 transition-colors ${on ? 'border-emerald-400 bg-emerald-50/70' : 'border-slate-200 bg-white/70'}`}>
                    <button type="button" onClick={() => setModules({ ...modules, [key]: !on })} className="w-full flex items-start justify-between gap-3 text-left">
                      <div>
                        <div className="text-sm font-bold text-slate-800">{MODULE_INFO[key].title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{MODULE_INFO[key].desc}</div>
                      </div>
                      <span className={`mt-0.5 shrink-0 w-10 h-6 rounded-full p-0.5 transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
                      </span>
                    </button>
                    {key === 'inventory' && on && (
                      <label className="mt-2.5 flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={batchExpiry} onChange={(e) => setBatchExpiry(e.target.checked)} className="accent-emerald-600" />
                        Track batch & expiry dates
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-400">You can change any of this later in Settings.</p>
          </>
        )}

        {/* STEP 3 — optional personalisation */}
        {step === 3 && (
          <>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-700">What do you call things?</div>
              <div className="grid grid-cols-2 gap-2.5">
                {(
                  [
                    ['productsLabel', 'Your items'],
                    ['ordersLabel', 'Your sales'],
                    ['customersLabel', 'Your customers'],
                    ['staffLabel', 'Your team'],
                  ] as const
                ).map(([k, hint]) => (
                  <div key={k} className="space-y-1">
                    <span className="text-[11px] font-medium text-slate-400">{hint}</span>
                    <Input value={labels[k]} onChange={(e) => setLabels({ ...labels, [k]: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-700">{labels.productsLabel || 'Item'} categories</div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 pl-3 pr-1.5 py-1 text-xs font-medium text-slate-700">
                    {c}
                    <button type="button" onClick={() => setCategories(categories.filter((x) => x !== c))} className="rounded-full p-0.5 hover:bg-slate-200" aria-label={`Remove ${c}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())} placeholder="Add a category" />
                <Button type="button" variant="outline" onClick={addCategory}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-700">Extra details to save</div>
              {(
                [
                  ['product', `On each ${(labels.productsLabel || 'item').toLowerCase().replace(/s$/, '')}`, productFields, setProductFields],
                  ['customer', `On each ${(labels.customersLabel || 'customer').toLowerCase().replace(/s$/, '')}`, customerFields, setCustomerFields],
                ] as const
              ).map(([key, title, list, setList]) => (
                <div key={key} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-500 w-full sm:w-auto sm:mr-1">{title}:</span>
                  {list.length === 0 && <span className="text-xs text-slate-400">nothing extra</span>}
                  {list.map((f) => (
                    <span key={f.name} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 pl-3 pr-1.5 py-1 text-xs font-medium text-emerald-800">
                      {f.name}
                      <button type="button" onClick={() => setList(list.filter((x) => x.name !== f.name))} className="rounded-full p-0.5 hover:bg-emerald-100" aria-label={`Remove ${f.name}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <select
                  value={newField.target}
                  onChange={(e) => setNewField({ ...newField, target: e.target.value as 'product' | 'customer' })}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="product">{labels.productsLabel || 'Items'}</option>
                  <option value="customer">{labels.customersLabel || 'Customers'}</option>
                </select>
                <Input
                  className="flex-1 min-w-[8rem]"
                  value={newField.name}
                  onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addField())}
                  placeholder="e.g. Size, Colour, Vehicle No."
                />
                <select value={newField.type} onChange={(e) => setNewField({ ...newField, type: e.target.value as FieldType })} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm">
                  {FIELD_TYPES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" onClick={addField}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <details className="rounded-2xl border border-slate-200 bg-white/60 p-3.5" open={Boolean(initialAddress || initialGstNumber)}>
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">Address & GSTIN (optional — shown on bills)</summary>
              <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shop address" />
                <Input value={gstNumber} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} placeholder="GSTIN (15 characters)" maxLength={15} />
              </div>
            </details>
          </>
        )}

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">
        <Button type="button" variant="ghost" size="sm" onClick={step === 1 ? onCancel : () => (setError(''), setStep(step - 1))} disabled={loading}>
          {step === 1 ? 'Cancel' : (
            <>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </>
          )}
        </Button>
        <div className="flex gap-2">
          {step === 2 && (
            <Button type="button" variant="outline" size="sm" onClick={submit} disabled={loading}>
              {loading ? 'Saving…' : mode === 'edit' ? 'Save now' : 'Finish now'}
            </Button>
          )}
          {step < STEPS.length ? (
            <Button type="button" size="sm" onClick={goNext} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              {step === 2 ? 'Personalize' : 'Next'} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={submit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
              {loading ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create business'} <Check className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
