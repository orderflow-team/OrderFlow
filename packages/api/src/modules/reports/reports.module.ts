import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { Product } from '../../database/entities/product.entity';
import { Customer } from '../../database/entities/customer.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { PurchaseItem } from '../../database/entities/purchase-item.entity';
import { Payment } from '../../database/entities/payment.entity';
import { Expense } from '../../database/entities/expense.entity';
import { Salesman } from '../../database/entities/salesman.entity';
import { Business } from '../../database/entities/business.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Product,
      Customer,
      PurchaseOrder,
      PurchaseItem,
      Payment,
      Expense,
      Salesman,
      Business,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
