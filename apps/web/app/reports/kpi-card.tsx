import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tint,
  valueClass,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tint: string;
  valueClass?: string;
}) {
  return (
    <Card className="ring-white/50 glass-sheen-sm">
      <CardContent className="p-4 flex flex-col gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tint}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className={`text-lg font-bold mt-0.5 ${valueClass || 'text-slate-800'}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
