'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { hasRole } from '@/lib/auth';
import { Phone } from 'lucide-react';

// Module-level, not state: only check once per app open — once dismissed by
// saving a phone, don't re-check again until a real relaunch.
let checkedThisSession = false;

/**
 * Forces a business phone number to be on file — it's the identity key the
 * business-connections module matches on, so a business with no phone can
 * never be found or connect with anyone. Unlike PostLoginUpdateAlert /
 * PendingConnectionRequestAlert, this one is NOT dismissable (no close
 * button, outside-click/Escape are no-ops) since there's no "later" that
 * still lets the OBIX network find this business.
 *
 * Skipped for staff logins (salesman/waiter/etc.) — PATCH /api/businesses/:id
 * is admin/manager-only, so a staff login would otherwise be stuck behind an
 * unclosable dialog it has no permission to clear.
 */
export function RequireBusinessPhoneAlert({ businessId }: { businessId: string | null }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!businessId || checkedThisSession || !hasRole('admin', 'manager')) return;
    checkedThisSession = true;
    apiClient
      .get<{ phone: string | null }>(`/api/businesses/${businessId}`)
      .then((res) => {
        if (!res.data.phone) setOpen(true);
      })
      .catch(() => {});
  }, [businessId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid mobile number (at least 10 digits).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiClient.patch(`/api/businesses/${businessId}`, { phone });
      setOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save phone number');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-[400px] p-6">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Phone className="w-5 h-5 text-emerald-600" /> Add your mobile number
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-3">
          <p className="text-sm text-slate-600">
            Your business needs a mobile number on file before you can continue — it's how customers and other
            OBIX businesses find and connect with you as a retailer or wholesaler.
          </p>
          <Input
            type="tel"
            inputMode="numeric"
            placeholder="10-digit mobile number"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              if (error) setError('');
            }}
            autoFocus
          />
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save and continue'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
