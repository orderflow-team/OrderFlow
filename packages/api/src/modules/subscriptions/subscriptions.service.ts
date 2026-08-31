import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface SubscriptionStatusResponse {
  status: 'trialing' | 'active' | 'past_due' | 'expired' | 'canceled';
  planCode: string;
  planName: string;
  trialDaysLeft: number;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  quotas: {
    ordersUsedThisMonth: number;
    maxOrdersPerMonth: number; // -1 for unlimited
    aiScansUsedThisMonth: number;
    maxAiScansPerMonth: number;
    staffUsersCount: number;
    maxStaffUsers: number;
  };
  features: Record<string, boolean>;
}

@Injectable()
export class SubscriptionsService {
  constructor(private dataSource: DataSource) {}

  async getPublicPlans() {
    return this.dataSource.query(
      `SELECT id, code, name, price_monthly_inr, price_yearly_inr, max_staff_users, max_devices, max_orders_per_month, max_ai_scans_per_month, features
       FROM subscription_plans
       WHERE is_active = true
       ORDER BY price_monthly_inr ASC`
    );
  }

  async getBusinessSubscriptionStatus(businessId: string): Promise<SubscriptionStatusResponse> {
    const rows = await this.dataSource.query(
      `SELECT bs.id, bs.status, bs.billing_cycle, bs.trial_starts_at, bs.trial_ends_at, bs.current_period_start, bs.current_period_end,
              sp.code as plan_code, sp.name as plan_name, sp.max_staff_users, sp.max_devices, sp.max_orders_per_month, sp.max_ai_scans_per_month, sp.features
       FROM business_subscriptions bs
       LEFT JOIN subscription_plans sp ON bs.plan_id = sp.id
       WHERE bs.business_id = $1`,
      [businessId]
    );

    let sub = rows[0];

    // Auto-provision 30-day trial if no subscription record exists yet
    if (!sub) {
      const defaultPlan = await this.dataSource.query(
        `SELECT id, code, name, max_staff_users, max_devices, max_orders_per_month, max_ai_scans_per_month, features
         FROM subscription_plans WHERE code = 'pro' LIMIT 1`
      );
      const plan = defaultPlan[0];
      if (plan) {
        await this.dataSource.query(
          `INSERT INTO business_subscriptions (id, business_id, plan_id, status, trial_starts_at, trial_ends_at)
           VALUES (gen_random_uuid(), $1, $2, 'trialing', NOW(), NOW() + INTERVAL '30 days')`,
          [businessId, plan.id]
        );
        sub = {
          status: 'trialing',
          plan_code: plan.code,
          plan_name: plan.name,
          trial_starts_at: new Date(),
          trial_ends_at: new Date(Date.now() + 30 * 86400 * 1000),
          max_staff_users: plan.max_staff_users,
          max_devices: plan.max_devices,
          max_orders_per_month: plan.max_orders_per_month,
          max_ai_scans_per_month: plan.max_ai_scans_per_month,
          features: plan.features,
        };
      }
    }

    // Calculate trial days left
    const now = new Date();
    const trialEndsAt = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;
    let trialDaysLeft = 0;
    if (trialEndsAt && trialEndsAt > now) {
      trialDaysLeft = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Determine status override if trial has expired and no paid plan active
    let effectiveStatus = sub?.status || 'trialing';
    if (effectiveStatus === 'trialing' && trialDaysLeft <= 0) {
      effectiveStatus = 'expired';
    }

    // Count monthly orders
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const orderCountRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM orders WHERE business_id = $1 AND created_at >= $2`,
      [businessId, startOfMonth]
    );
    const ordersUsedThisMonth = orderCountRes[0]?.count || 0;

    // Count monthly AI scans
    const scanCountRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM invoice_scans WHERE business_id = $1 AND created_at >= $2`,
      [businessId, startOfMonth]
    );
    const aiScansUsedThisMonth = scanCountRes[0]?.count || 0;

    // Count staff users
    const staffCountRes = await this.dataSource.query(
      `SELECT COUNT(*)::int as count FROM users WHERE business_id = $1 AND is_active = true`,
      [businessId]
    );
    const staffUsersCount = staffCountRes[0]?.count || 0;

    return {
      status: effectiveStatus,
      planCode: sub?.plan_code || 'pro',
      planName: sub?.plan_name || 'Pro Plan (Trial)',
      trialDaysLeft,
      trialEndsAt,
      currentPeriodEnd: sub?.current_period_end ? new Date(sub.current_period_end) : null,
      quotas: {
        ordersUsedThisMonth,
        maxOrdersPerMonth: sub?.max_orders_per_month ?? -1,
        aiScansUsedThisMonth,
        maxAiScansPerMonth: sub?.max_ai_scans_per_month ?? 100,
        staffUsersCount,
        maxStaffUsers: sub?.max_staff_users ?? 10,
      },
      features: sub?.features || { restaurant_kot: true, salt_search: true, h1_register: true, salesman_gps: true },
    };
  }

  async simulateLocalPaymentUpgrade(businessId: string, planCode: string, cycle: 'monthly' | 'yearly' = 'monthly') {
    const plan = await this.dataSource.query(`SELECT id, code, name, price_monthly_inr, price_yearly_inr FROM subscription_plans WHERE code = $1`, [planCode]);
    if (!plan || plan.length === 0) {
      throw new NotFoundException(`Plan ${planCode} not found`);
    }

    const targetPlan = plan[0];
    const amount = cycle === 'yearly' ? targetPlan.price_yearly_inr : targetPlan.price_monthly_inr;
    const durationDays = cycle === 'yearly' ? 365 : 30;

    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(Date.now() + durationDays * 86400 * 1000);

    // Update business subscription status to active
    await this.dataSource.query(
      `INSERT INTO business_subscriptions (id, business_id, plan_id, status, billing_cycle, current_period_start, current_period_end, gateway)
       VALUES (gen_random_uuid(), $1, $2, 'active', $3, $4, $5, 'local_simulated')
       ON CONFLICT (business_id) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         status = 'active',
         billing_cycle = EXCLUDED.billing_cycle,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         updated_at = NOW()`,
      [businessId, targetPlan.id, cycle, currentPeriodStart, currentPeriodEnd]
    );

    // Log payment audit entry
    await this.dataSource.query(
      `INSERT INTO subscription_payments (id, business_id, amount, currency, status, gateway, gateway_payment_id, paid_at)
       VALUES (gen_random_uuid(), $1, $2, 'INR', 'success', 'local_simulated', 'sim_pay_' || substr(md5(random()::text), 1, 10), NOW())`,
      [businessId, amount]
    );

    return {
      message: `Successfully upgraded to ${targetPlan.name} (${cycle})!`,
      status: 'active',
      planCode: targetPlan.code,
      currentPeriodEnd,
    };
  }

  async getReferralInfo(businessId: string) {
    let bizRes = await this.dataSource.query(`SELECT referral_code FROM businesses WHERE id = $1`, [businessId]);
    let referralCode = bizRes[0]?.referral_code;

    if (!referralCode) {
      referralCode = 'OF-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      await this.dataSource.query(`UPDATE businesses SET referral_code = $1 WHERE id = $2`, [referralCode, businessId]);
    }

    const referralsCountRes = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM business_referrals WHERE referrer_business_id = $1`,
      [businessId]
    );

    const totalReferrals = parseInt(referralsCountRes[0]?.count || '0', 10);
    const bonusDaysEarned = totalReferrals * 30;

    const shareMessage = `Hey! I use Orderflow to manage my shop POS billing & inventory. Use my referral link to get a 30-Day FREE Pro Trial + 30 Extra Bonus Days! Signup here: https://orderflow.in/signup?ref=${referralCode}`;

    return {
      referralCode,
      referralLink: `https://orderflow.in/signup?ref=${referralCode}`,
      totalReferrals,
      bonusDaysEarned,
      shareMessage,
    };
  }

  async applyReferralCode(refereeBusinessId: string, referralCode: string) {
    const cleanCode = referralCode.trim().toUpperCase();
    const referrerRes = await this.dataSource.query(`SELECT id FROM businesses WHERE UPPER(referral_code) = $1`, [cleanCode]);
    if (!referrerRes || referrerRes.length === 0) {
      throw new NotFoundException(`Invalid referral code: ${referralCode}`);
    }

    const referrerBusinessId = referrerRes[0].id;
    if (referrerBusinessId === refereeBusinessId) {
      throw new BadRequestException('You cannot refer your own store!');
    }

    const existingRef = await this.dataSource.query(
      `SELECT id FROM business_referrals WHERE referee_business_id = $1`,
      [refereeBusinessId]
    );

    if (existingRef && existingRef.length > 0) {
      throw new BadRequestException('Referral code already applied for this store!');
    }

    await this.dataSource.query(
      `INSERT INTO business_referrals (id, referrer_business_id, referee_business_id, reward_days_granted, status)
       VALUES (gen_random_uuid(), $1, $2, 30, 'rewarded')`,
      [referrerBusinessId, refereeBusinessId]
    );

    await this.dataSource.query(
      `UPDATE business_subscriptions 
       SET trial_ends_at = trial_ends_at + INTERVAL '30 days',
           current_period_end = GREATEST(current_period_end, NOW()) + INTERVAL '30 days'
       WHERE business_id IN ($1, $2)`,
      [referrerBusinessId, refereeBusinessId]
    );

    return {
      message: 'Referral code applied! 30 Bonus Days of Pro Plan credited to both stores! 🎉',
      bonusDays: 30,
    };
  }
}
