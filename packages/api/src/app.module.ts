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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env.local',
    }),
    TypeOrmModule.forRoot(databaseConfig),
    ScheduleModule.forRoot(),
    // Generous baseline (this app polls a lot — dashboard/notifications/live-users
    // refresh every few seconds, and a busy shop's whole LAN can share one public
    // IP) — this is a general-abuse safety net, not meant to constrain normal use.
    // Sensitive auth endpoints override it with much tighter per-route limits via
    // @Throttle() — see auth.controller.ts.
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
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(private dataSource: DataSource) {}

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
  }
}
