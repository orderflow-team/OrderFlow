import { NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService upgrade requests', () => {
  let query: jest.Mock;
  let service: SubscriptionsService;

  beforeEach(() => {
    query = jest.fn();
    service = new SubscriptionsService({ query } as any);
  });

  const sqlCalls = () => query.mock.calls.map(([sql]) => String(sql));

  describe('requestUpgrade', () => {
    it('records a pending request without activating anything', async () => {
      query
        .mockResolvedValueOnce([{ code: 'pro', name: 'Pro', price_monthly_inr: '499', price_yearly_inr: '4999' }])
        .mockResolvedValueOnce([{ id: 'req-1', plan_code: 'pro', billing_cycle: 'yearly', status: 'pending' }]);

      const result = await service.requestUpgrade('biz-1', 'user-1', 'pro', 'yearly');

      expect(result).toMatchObject({ id: 'req-1', status: 'pending', planName: 'Pro', amountInr: 4999 });
      expect(sqlCalls().some((sql) => sql.includes('business_subscriptions'))).toBe(false);
      expect(sqlCalls().some((sql) => sql.includes('subscription_payments'))).toBe(false);
    });

    it('rejects an unknown or inactive plan', async () => {
      query.mockResolvedValueOnce([]);
      await expect(service.requestUpgrade('biz-1', 'user-1', 'gold', 'monthly')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approveUpgradeRequest', () => {
    it('activates the requested plan and records a manual payment', async () => {
      query
        // claim the pending request (UPDATE ... RETURNING → [rows, count])
        .mockResolvedValueOnce([[{ business_id: 'biz-1', plan_code: 'pro', billing_cycle: 'monthly' }], 1])
        // plan lookup
        .mockResolvedValueOnce([{ id: 'plan-pro', code: 'pro', name: 'Pro', price_monthly_inr: '499', price_yearly_inr: '4999' }])
        // "is this a user id?" — no, it's a business id
        .mockResolvedValueOnce([])
        // owner lookup
        .mockResolvedValueOnce([{ id: 'owner-1' }])
        // existing subscription row for this shop? none → insert
        .mockResolvedValueOnce([])
        .mockResolvedValue([]);

      const result = await service.approveUpgradeRequest('req-1', 'admin-1');

      expect(result).toMatchObject({ status: 'active', planCode: 'pro' });
      const subscriptionCall = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO business_subscriptions'));
      expect(subscriptionCall?.[1]).toContain('manual');
      const paymentCall = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO subscription_payments'));
      expect(paymentCall?.[1]).toEqual(['biz-1', '499', 'manual', 'manual_']);
    });

    // The migrations only make business_id unique (not user_id), so ON CONFLICT (user_id)
    // failed on any database built from them. Activation must work without it.
    it('updates the existing subscription row instead of relying on ON CONFLICT', async () => {
      query
        .mockResolvedValueOnce([[{ business_id: 'biz-1', plan_code: 'pro', billing_cycle: 'monthly' }], 1])
        .mockResolvedValueOnce([{ id: 'plan-pro', code: 'pro', name: 'Pro', price_monthly_inr: '499', price_yearly_inr: '4999' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'owner-1' }])
        .mockResolvedValueOnce([{ id: 'sub-1' }]) // existing row found
        .mockResolvedValue([]);

      await service.approveUpgradeRequest('req-1', 'admin-1');

      const sql = sqlCalls();
      expect(sql.some((s) => s.includes('ON CONFLICT'))).toBe(false);
      expect(sql.some((s) => s.includes('UPDATE business_subscriptions'))).toBe(true);
      expect(sql.some((s) => s.includes('INSERT INTO business_subscriptions'))).toBe(false);
      const update = query.mock.calls.find(([s]) => String(s).includes('UPDATE business_subscriptions'));
      expect(update?.[1][0]).toBe('sub-1');
      expect(update?.[1]).toContain('manual');
    });

    it('refuses a request that was already handled', async () => {
      query.mockResolvedValueOnce([[], 0]);
      await expect(service.approveUpgradeRequest('req-1', 'admin-1')).rejects.toThrow(NotFoundException);
      expect(sqlCalls().some((sql) => sql.includes('business_subscriptions'))).toBe(false);
    });
  });

  describe('rejectUpgradeRequest', () => {
    it('closes the request without touching the subscription', async () => {
      query.mockResolvedValueOnce([[{ business_id: 'biz-1', plan_code: 'pro', billing_cycle: 'monthly' }], 1]);

      await expect(service.rejectUpgradeRequest('req-1', 'admin-1')).resolves.toEqual({ status: 'rejected' });
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0][1]).toEqual(['req-1', 'rejected', 'admin-1']);
    });
  });
});
