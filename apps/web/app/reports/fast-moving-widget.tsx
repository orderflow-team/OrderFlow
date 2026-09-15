'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/format-currency';
import { useBusiness } from '@/lib/use-business';
import { ProductPurchasersModal } from './product-purchasers-modal';
import { Users, ChevronRight } from 'lucide-react';

interface FastMovingRow {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

export function FastMovingWidget({ rows, days }: { rows: FastMovingRow[]; days?: number }) {
  const { businessId } = useBusiness();
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);

  if (rows.length === 0) {
    return <p className="p-10 text-center text-slate-400 text-sm">No sales in this period yet.</p>;
  }

  return (
    <>
      <div className="divide-y divide-slate-100">
        {rows.map((row, index) => (
          <div
            key={row.productId}
            onClick={() => setSelectedProduct({ id: row.productId, name: row.productName })}
            className="flex items-center justify-between px-4 py-3.5 gap-4 hover:bg-slate-50/90 dark:hover:bg-slate-800/60 cursor-pointer transition-all group"
            title="Click to view customer purchase history"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {row.productName}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 group-hover:text-emerald-600/70 transition-colors">
                  <Users className="w-3 h-3" />
                  <span>View buyers & invoices</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{row.totalQuantity} sold</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(row.totalRevenue)}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        ))}
      </div>

      {businessId && selectedProduct && (
        <ProductPurchasersModal
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          businessId={businessId}
          days={days}
        />
      )}
    </>
  );
}
