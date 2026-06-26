'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api-client';

/** Dev-only: wipes all of one module's data for the current business. The API rejects this in production. */
export function ClearModuleButton({
  module,
  businessId,
  label = 'Clear All',
  onCleared,
}: {
  module: 'customers' | 'products' | 'orders' | 'inventory' | 'billing' | 'restaurant' | 'salesman';
  businessId: string;
  label?: string;
  onCleared?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
    if (!confirm(`Delete ALL ${module} data for this business? This cannot be undone.`)) return;
    setLoading(true);
    try {
      await apiClient.delete(`/api/dev/clear/${module}`, { params: { businessId } });
      if (onCleared) {
        onCleared();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to clear data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClear} variant="destructive" size="sm" disabled={loading} className="gap-1.5">
      <Trash2 className="w-3.5 h-3.5" />
      {loading ? 'Clearing...' : label}
    </Button>
  );
}
