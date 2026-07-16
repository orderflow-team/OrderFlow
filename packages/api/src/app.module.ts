import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { databaseConfig } from './database/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiModule } from './modules/ai/ai.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InvoiceScanModule } from './modules/invoice-scan/invoice-scan.module';
import { RestaurantModule } from './modules/restaurant/restaurant.module';
import { SalesmanModule } from './modules/salesman/salesman.module';
import { BillingModule } from './modules/billing/billing.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DevToolsModule } from './modules/dev-tools/dev-tools.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ExpensesModule } from './modules/expenses/expenses.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env.local',
    }),
    TypeOrmModule.forRoot(databaseConfig),
    ScheduleModule.forRoot(),
    AuthModule,
    AiModule,
    BusinessesModule,
    CustomersModule,
    ProductsModule,
    OrdersModule,
    SuppliersModule,
    InventoryModule,
    InvoiceScanModule,
    RestaurantModule,
    SalesmanModule,
    BillingModule,
    ReportsModule,
    NotificationsModule,
    DevToolsModule,
    CategoriesModule,
    ExpensesModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(private dataSource: DataSource) {}

  async onApplicationBootstrap() {
    try {
      console.log('⏳ Running startup database corrections...');
      // Fix products that have stock but are marked as unavailable
      const result = await this.dataSource.query(
        `UPDATE products SET is_available = true WHERE stock_quantity > 0 AND is_available = false`
      );
      console.log(`✅ Startup database correction complete.`, result);
    } catch (err) {
      console.error('❌ Failed to run startup database corrections:', err);
    }
  }
}
