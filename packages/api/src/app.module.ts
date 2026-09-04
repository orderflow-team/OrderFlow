import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env.local', '../../.env'],
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
export class AppModule {}
