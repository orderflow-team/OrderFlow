import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessConnection } from '../../database/entities/business-connection.entity';
import { Business } from '../../database/entities/business.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { Customer } from '../../database/entities/customer.entity';
import { Notification } from '../../database/entities/notification.entity';
import { Order } from '../../database/entities/order.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { OrdersModule } from '../orders/orders.module';
import { InventoryModule } from '../inventory/inventory.module';
import { BusinessConnectionsController } from './business-connections.controller';
import { BusinessConnectionsService } from './business-connections.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BusinessConnection, Business, Supplier, Customer, Notification, Order, PurchaseOrder]),
    OrdersModule,
    InventoryModule,
  ],
  controllers: [BusinessConnectionsController],
  providers: [BusinessConnectionsService],
  exports: [BusinessConnectionsService],
})
export class BusinessConnectionsModule {}
