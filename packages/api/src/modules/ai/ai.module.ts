import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { OrderParserService } from './services/order-parser.service';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { RestaurantModule } from '../restaurant/restaurant.module';

@Module({
  imports: [OrdersModule, ProductsModule, RestaurantModule],
  controllers: [AiController],
  providers: [OrderParserService],
})
export class AiModule {}
