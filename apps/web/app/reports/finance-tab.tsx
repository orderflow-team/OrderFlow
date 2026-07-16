'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/format-currency';
import { KpiCard } from './kpi-card';
import { SimpleBarChart } from './simple-bar-chart';
import { TrendingUp, TrendingDown, Wallet, CreditCard, Receipt, Plus, Trash2, Landmark } from 'lucide-react';
import type { AnalyticsPayload } from './types';

function deltaText(percent: number | undefined) {
  const value = percent || 0;
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}% vs previous period`;
}

export function FinanceTab({ analytics, businessId, days, onExpenseChanged }: {
  analytics: AnalyticsPayload | null;
  businessId: string;
  days: number;
  onExpenseChanged: () => void;
}) {
  const finance = analytics?.finance;
  const comparison = analytics?.comparison;
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/api/expenses', {
        businessId,
        category: category || undefined,
        amount: Number(amount),
        description: description || undefined,
        expenseDate: expenseDate || undefined,
      });
      setCategory('');
      setAmount('');
      setDescription('');
      setExpenseDate('');
      onExpenseChanged();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await apiClient.delete(`/api/expenses/${id}`, { params: { businessId } });
      onExpenseChanged();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={finance && finance.netProfit >= 0 ? TrendingUp : TrendingDown}
          label="Net Profit"
          value={formatCurrency(finance?.netProfit || 0)}
          sub={deltaText(comparison?.netProfitGrowthPercent)}
          tint={(finance?.netProfit || 0) >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}
          valueClass={(finance?.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}
        />
        <KpiCard
          icon={Wallet}
          label="Sales Growth"
          value={`${(comparison?.salesGrowthPercent || 0) >= 0 ? '+' : ''}${(comparison?.salesGrowthPercent || 0).toFixed(1)}%`}
          sub="vs previous period"
          tint={(comparison?.salesGrowthPercent || 0) >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}
          valueClass={(comparison?.salesGrowthPercent || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}
        />
        <KpiCard
          icon={Receipt}
          label="Expenses"
          value={formatCurrency(finance?.expenses.total || 0)}
          sub={deltaText(comparison?.expensesGrowthPercent)}
          tint="bg-amber-500/10 text-amber-600"
        />
        <KpiCard
          icon={CreditCard}
          label="Payments Collected"
          value={formatCurrency((finance?.paymentMethodBreakdown || []).reduce((s, m) => s + m.total, 0))}
          sub={`Last ${days} day${days !== 1 ? 's' : ''}, net of refunds`}
          tint="bg-blue-500/10 text-blue-600"
        />
        <KpiCard
          icon={Landmark}
          label="Net GST Payable"
          value={formatCurrency(finance?.netGstPayable || 0)}
          sub="Selected period: output − input"
          tint="bg-violet-500/10 text-violet-600"
        />
      </div>

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <CardTitle className="text-base">Payment Method Breakdown</CardTitle>
          <CardDescription>Last {days} day{days !== 1 ? 's' : ''}, net of refunds.</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart
            data={(finance?.paymentMethodBreakdown || []).map((m) => ({ label: m.method, value: m.total }))}
            color="#2563eb"
          />
        </CardContent>
      </Card>

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <CardTitle className="text-base">Expense Trend</CardTitle>
          <CardDescription>Last {days} day{days !== 1 ? 's' : ''}.</CardDescription>
        </CardHeader>
        <CardContent>
          <SimpleBarChart
            data={(finance?.expenses.trend || []).map((t) => ({ label: formatDate(t.date, { day: '2-digit', month: 'short' }), value: t.total }))}
            color="#f59e0b"
            emptyMessage="No expenses recorded in this period yet."
          />
        </CardContent>
      </Card>

      <Card className="ring-white/50 glass-sheen-sm">
        <CardHeader>
          <CardTitle className="text-base">Add Expense</CardTitle>
          <CardDescription>Rent, salaries, utilities — anything that isn't a purchase order.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input placeholder="Category (e.g. Rent)" value={category} onChange={(e) => setCategory(e.target.value)} />
            <Input placeholder="Amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            <Button type="submit" disabled={saving} className="sm:col-span-4 gap-1.5">
              <Plus className="w-4 h-4" /> {saving ? 'Saving...' : 'Add Expense'}
            </Button>
          </form>
          {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="ring-white/50 glass-sheen-sm">
          <CardHeader>
            <CardTitle className="text-base">Recent Expenses</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(finance?.expenses.recent.length || 0) === 0 ? (
              <p className="p-10 text-center text-slate-400 text-sm">No expenses recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {finance?.expenses.recent.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{e.category || 'Uncategorized'}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {formatDate(e.expense_date)}{e.description ? ` · ${e.description}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-bold text-slate-800">{formatCurrency(Number(e.amount))}</p>
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors"
                        aria-label="Delete expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="ring-white/50 glass-sheen-sm">
          <CardHeader>
            <CardTitle className="text-base">Expenses by Category</CardTitle>
            <CardDescription>Selected period.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(finance?.expenses.byCategory.length || 0) === 0 ? (
              <p className="p-10 text-center text-slate-400 text-sm">No expenses in this period.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {finance?.expenses.byCategory.map((c) => (
                  <div key={c.category} className="px-4 py-3 flex justify-between text-sm">
                    <span className="text-slate-800 font-medium">{c.category}</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(c.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
