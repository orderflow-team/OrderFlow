import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { OrderParserService } from './services/order-parser.service';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { CustomersModule } from '../customers/customers.module';
import { GeminiKeyPoolService } from '../../common/services/gemini-key-pool.service';

@Module({
  imports: [OrdersModule, ProductsModule, RestaurantModule, CustomersModule],
  controllers: [AiController],
  providers: [OrderParserService, GeminiKeyPoolService],
})
export class AiModule {}
