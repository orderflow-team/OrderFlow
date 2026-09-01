import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { databaseConfig } from './database/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiModule } from './modules/ai/ai.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { BusinessConnectionsModule } from './modules/business-connections/business-connections.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InvoiceScanModule } from './modules/invoice-scan/invoice-scan.module';
import { RestaurantModule } from './modules/restaurant/restaurant.module';
import { SalesmanModule } from './modules/salesman/salesman.module';
import { StaffModule } from './modules/staff/staff.module';
import { BillingModule } from './modules/billing/billing.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DevToolsModule } from './modules/dev-tools/dev-tools.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { AppUpdatesModule } from './modules/app-updates/app-updates.module';
import { AppApkReleasesModule } from './modules/app-apk-releases/app-apk-releases.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SubscriptionPaywallGuard } from './modules/subscriptions/subscription-paywall.guard';
import { InvoiceScanService } from './modules/invoice-scan/invoice-scan.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env.local',
    }),
    TypeOrmModule.forRoot(databaseConfig),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    AuthModule,
    AiModule,
    BusinessesModule,
    BusinessConnectionsModule,
    CustomersModule,
    ProductsModule,
    OrdersModule,
    SuppliersModule,
    InventoryModule,
    InvoiceScanModule,
    RestaurantModule,
    SalesmanModule,
    StaffModule,
    BillingModule,
    ReportsModule,
    NotificationsModule,
    DevToolsModule,
    CategoriesModule,
    ExpensesModule,
    PlatformAdminModule,
    AppUpdatesModule,
    AppApkReleasesModule,
    SubscriptionsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SubscriptionPaywallGuard },
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(
    private dataSource: DataSource,
    private invoiceScanService: InvoiceScanService,
  ) {}

  async onApplicationBootstrap() {
    try {
      console.log('⏳ Running startup database corrections & admin seed...');
      // Fix products that have stock but are marked as unavailable
      const result = await this.dataSource.query(
        `UPDATE products SET is_available = true WHERE stock_quantity > 0 AND is_available = false`
      );
      console.log(`✅ Startup database correction complete.`, result);

      // Heal stock left negative by oversold orders placed before decrementStock
      // started flooring at 0 — new oversells no longer go negative, but this
      // catches whatever was already sitting negative in the DB.
      const stockFloorResult = await this.dataSource.query(
        `UPDATE products SET stock_quantity = 0 WHERE stock_quantity < 0`
      );
      console.log(`✅ Negative stock correction complete.`, stockFloorResult);

      // The pharmacy product form used to bind its "MRP" field to
      // selling_price, so mrp itself was never actually captured — existing
      // pharmacy products all have mrp = NULL despite having a real MRP the
      // pharmacist typed in (it just landed in the wrong column). Backfill
      // mrp = selling_price as a starting ceiling: it can't block anything
      // immediately (the two are equal right after this runs), but it stops
      // future price increases from drifting above MRP without anyone
      // updating it. Idempotent — a no-op once mrp is set. Scoped to
      // pharmacy-category businesses since that's the only UI that ever had
      // this mislabeling; other categories' NULL mrp was never populated in
      // the first place and isn't this bug.
      const mrpBackfillResult = await this.dataSource.query(
        `UPDATE products SET mrp = selling_price
         WHERE mrp IS NULL
           AND business_id IN (SELECT id FROM businesses WHERE category = 'pharmacy')`
      );
      console.log(`✅ Pharmacy MRP backfill complete.`, mrpBackfillResult);

      // Create Subscription tables if they don't exist yet
      await this.dataSource.query(`
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
        );

        CREATE TABLE IF NOT EXISTS business_subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id UUID UNIQUE NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
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
        );

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
        );

        ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);
        ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(20);

        CREATE TABLE IF NOT EXISTS business_referrals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          referrer_business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          referee_business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          reward_days_granted INT DEFAULT 30,
          status VARCHAR(50) DEFAULT 'rewarded',
          created_at TIMESTAMP DEFAULT NOW()
        );

        UPDATE businesses 
        SET referral_code = 'OF-' || UPPER(SUBSTRING(MD5(id::text || NOW()::text) FROM 1 FOR 6))
        WHERE referral_code IS NULL;
      `);

      // Seed Subscription Plans if empty
      const plansCount = await this.dataSource.query(`SELECT COUNT(*) as count FROM subscription_plans`);
      if (parseInt(plansCount[0]?.count || '0', 10) === 0) {
        await this.dataSource.query(`
          INSERT INTO subscription_plans (code, name, price_monthly_inr, price_yearly_inr, max_staff_users, max_devices, max_orders_per_month, max_ai_scans_per_month, features)
          VALUES 
            ('starter', 'Mobile Starter', 59.00, 599.00, 2, 1, 500, 15, '{"restaurant_kot": false, "salt_search": false, "h1_register": false, "salesman_gps": false}'),
            ('pro', 'Pro Plan', 399.00, 3999.00, 10, 5, -1, 100, '{"restaurant_kot": true, "salt_search": true, "h1_register": true, "salesman_gps": true}'),
            ('enterprise', 'Enterprise Plan', 999.00, 9999.00, -1, -1, -1, -1, '{"multi_branch": true, "restaurant_kot": true, "salt_search": true, "h1_register": true, "salesman_gps": true}')
          ON CONFLICT (code) DO UPDATE SET
            price_monthly_inr = EXCLUDED.price_monthly_inr,
            price_yearly_inr = EXCLUDED.price_yearly_inr
        `);
        console.log('✅ Seeded default subscription plans (starter, pro, enterprise).');
      }

      // Auto-provision 30-day Free Trial for businesses without a subscription record
      const proPlan = await this.dataSource.query(`SELECT id FROM subscription_plans WHERE code = 'pro'`);
      const proPlanId = proPlan[0]?.id;
      if (proPlanId) {
        await this.dataSource.query(`
          INSERT INTO business_subscriptions (id, business_id, plan_id, status, trial_starts_at, trial_ends_at)
          SELECT gen_random_uuid(), id, '${proPlanId}', 'trialing', NOW(), NOW() + INTERVAL '30 days'
          FROM businesses
          WHERE id NOT IN (SELECT business_id FROM business_subscriptions)
        `);
      }

      // Seed super_admin user admin@orderflow.com only if it doesn't exist yet.
      // Deliberately does NOT touch password_hash/role/is_active on an existing
      // row on every restart — that used to force this account's password back
      // to a hardcoded value forever, which was a permanent backdoor (any login
      // attempt with that password silently re-granted super-admin access, no
      // matter how many times it was changed). A password change now actually
      // sticks.
      const existingUser = await this.dataSource.query(
        `SELECT id FROM users WHERE email = 'admin@orderflow.com'`
      );

      if (!existingUser || existingUser.length === 0) {
        const bcrypt = await import('bcryptjs');
        const crypto = await import('crypto');
        // No hardcoded default — a random bootstrap password only exists in
        // this one log line, or the operator can pin their own via env.
        const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || crypto.randomBytes(12).toString('base64url');
        const hash = await bcrypt.hash(bootstrapPassword, 10);
        await this.dataSource.query(
          `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), 'admin@orderflow.com', $1, 'Platform Super Admin', 'super_admin', true, NOW(), NOW())`,
          [hash]
        );
        console.log('✅ Created default Super Admin account admin@orderflow.com.');
        console.log(`🔑 Bootstrap password (shown once, change it immediately after logging in): ${bootstrapPassword}`);
      }

      // Seed audit activity logs if empty
      const logsCount = await this.dataSource.query(`SELECT COUNT(*) as count FROM user_activity_logs`);
      if (parseInt(logsCount[0]?.count || '0', 10) === 0) {
        const adminUser = await this.dataSource.query(`SELECT id, business_id FROM users WHERE email = 'admin@orderflow.com'`);
        const adminId = adminUser[0]?.id || null;
        const bizId = adminUser[0]?.business_id || null;

        await this.dataSource.query(`
          INSERT INTO user_activity_logs (id, user_id, business_id, action, resource, metadata, ip_address, created_at)
          VALUES 
            (gen_random_uuid(), ${adminId ? `'${adminId}'` : 'NULL'}, ${bizId ? `'${bizId}'` : 'NULL'}, 'SYSTEM_BOOTSTRAP', 'System', '{"module":"Engine","status":"Active"}', '127.0.0.1', NOW() - INTERVAL '2 hours'),
            (gen_random_uuid(), ${adminId ? `'${adminId}'` : 'NULL'}, ${bizId ? `'${bizId}'` : 'NULL'}, 'STORE_CONFIGURED', 'Business', '{"feature":"Inventory & AI Chat Enabled"}', '127.0.0.1', NOW() - INTERVAL '1 hour'),
            (gen_random_uuid(), ${adminId ? `'${adminId}'` : 'NULL'}, ${bizId ? `'${bizId}'` : 'NULL'}, 'USER_LOGIN', 'Auth', '{"login_type":"super_admin_session"}', '127.0.0.1', NOW() - INTERVAL '10 minutes')
        `);
        console.log('✅ Seeded initial activity & audit log entries.');
      }
    } catch (err) {
      console.error('❌ Failed to run startup database corrections or admin seed:', err);
    }

    // Deliberately its OWN try/catch, not folded into the block above — this
    // way a failure/throw in any of those older, unrelated startup steps can
    // never silently skip this migration (which is exactly what appears to
    // have happened on the first deploy: the bucket never drained, with no
    // "migration" log line at all, meaning this code plausibly never ran).
    try {
      // 2026-08-25 security fix: `invoice-scans` was a public_read bucket
      // (see neon.ts) — migrate any remaining objects onto the private
      // `invoice-scans-private` bucket. Idempotent: a no-op once nothing
      // references the legacy bucket anymore. Logs unconditionally (not just
      // on a non-zero result) so its own execution is provable from the logs.
      console.log('⏳ Checking invoice-scan legacy bucket migration...');
      const migrationResult = await this.invoiceScanService.migrateLegacyBucket();
      console.log(
        `✅ Invoice-scan legacy bucket migration check complete: ${migrationResult.migrated} migrated, ${migrationResult.failed} failed.`,
      );
    } catch (err) {
      console.error('❌ Invoice-scan legacy bucket migration threw:', err);
    }
  }
}
