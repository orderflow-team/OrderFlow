import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migrates the subscription schema and historical corrections that previously
 * ran on every API boot. All statements are safe for databases where the old
 * bootstrap code already created the tables.
 */
export class MoveStartupDatabaseWorkToMigration1788307200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        price_monthly_inr DECIMAL(15, 2) NOT NULL,
        price_yearly_inr DECIMAL(15, 2) NOT NULL,
        max_staff_users INT NOT NULL DEFAULT 2,
        max_devices INT NOT NULL DEFAULT 1,
        max_orders_per_month INT NOT NULL DEFAULT 500,
        max_ai_scans_per_month INT NOT NULL DEFAULT 15,
        features JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS business_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
        plan_id UUID REFERENCES subscription_plans(id),
        status VARCHAR(50) NOT NULL DEFAULT 'trialing',
        billing_cycle VARCHAR(20) DEFAULT 'monthly',
        trial_starts_at TIMESTAMP DEFAULT NOW(),
        trial_ends_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days',
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        gateway VARCHAR(50) DEFAULT 'razorpay',
        gateway_subscription_id VARCHAR(100),
        gateway_customer_id VARCHAR(100),
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subscription_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        subscription_id UUID REFERENCES business_subscriptions(id) ON DELETE CASCADE,
        amount DECIMAL(15, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'INR',
        status VARCHAR(50) NOT NULL,
        gateway VARCHAR(50) NOT NULL,
        gateway_payment_id VARCHAR(100),
        invoice_pdf_url TEXT,
        paid_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(20)`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS business_referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        referee_business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        reward_days_granted INT DEFAULT 30,
        status VARCHAR(50) DEFAULT 'rewarded',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `ALTER TABLE business_subscriptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE business_subscriptions ALTER COLUMN business_id DROP NOT NULL`,
    );

    await queryRunner.query(`
      UPDATE products
      SET is_available = true
      WHERE stock_quantity > 0 AND is_available = false
    `);
    await queryRunner.query(
      `UPDATE products SET stock_quantity = 0 WHERE stock_quantity < 0`,
    );
    await queryRunner.query(`
      UPDATE products SET mrp = selling_price
      WHERE mrp IS NULL
        AND business_id IN (SELECT id FROM businesses WHERE category = 'pharmacy')
    `);
    await queryRunner.query(`
      UPDATE business_subscriptions bs
      SET user_id = u.id
      FROM users u
      WHERE bs.user_id IS NULL
        AND u.business_id = bs.business_id
        AND u.role IN ('admin', 'super_admin')
    `);
    await queryRunner.query(`
      UPDATE business_subscriptions bs
      SET user_id = (SELECT id FROM users WHERE business_id = bs.business_id LIMIT 1)
      WHERE bs.user_id IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO subscription_plans
        (code, name, price_monthly_inr, price_yearly_inr, max_staff_users, max_devices, max_orders_per_month, max_ai_scans_per_month, features)
      VALUES
        ('starter', 'Mobile Starter', 59.00, 599.00, 2, 1, 500, 15, '{"restaurant_kot": false, "salt_search": false, "h1_register": false, "salesman_gps": false}'),
        ('pro', 'Pro Plan', 399.00, 3999.00, 10, 5, -1, 100, '{"restaurant_kot": true, "salt_search": true, "h1_register": true, "salesman_gps": true}'),
        ('enterprise', 'Enterprise Plan', 999.00, 9999.00, -1, -1, -1, -1, '{"multi_branch": true, "restaurant_kot": true, "salt_search": true, "h1_register": true, "salesman_gps": true}')
      ON CONFLICT (code) DO NOTHING
    `);
  }

  // This migration intentionally preserves historical corrections and seeded
  // plan data; rolling it back must not delete customer subscriptions.
  public async down(): Promise<void> {}
}
