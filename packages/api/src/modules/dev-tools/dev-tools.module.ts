import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../../database/entities/business.entity';
import { Notification } from '../../database/entities/notification.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Product } from '../../database/entities/product.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { Stock } from '../../database/entities/stock.entity';
import { Table } from '../../database/entities/table.entity';
import { KOT } from '../../database/entities/kot.entity';
import { Salesman } from '../../database/entities/salesman.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { Payment } from '../../database/entities/payment.entity';
import { CustomersModule } from '../customers/customers.module';
import { ProductsModule } from '../products/products.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { OrdersModule } from '../orders/orders.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { SalesmanModule } from '../salesman/salesman.module';
import { BillingModule } from '../billing/billing.module';
import { DevToolsController } from './dev-tools.controller';
import { DevToolsService } from './dev-tools.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Business,
      Notification,
      Order,
      OrderItem,
      Customer,
      Product,
      Supplier,
      PurchaseOrder,
      Stock,
      Table,
      KOT,
      Salesman,
      Invoice,
      Payment,
    ]),
    CustomersModule,
    ProductsModule,
    SuppliersModule,
    OrdersModule,
    InventoryModule,
    RestaurantModule,
    SalesmanModule,
    BillingModule,
  ],
  controllers: [DevToolsController],
  providers: [DevToolsService],
  exports: [DevToolsService],
})
export class DevToolsModule {}
