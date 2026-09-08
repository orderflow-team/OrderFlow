import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../../database/entities/business.entity';
import { Order } from '../../database/entities/order.entity';
import { AiModule } from '../ai/ai.module';
import { OrdersModule } from '../orders/orders.module';
import { EvolutionApiService } from './evolution-api.service';
import { WhatsappService } from './whatsapp.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappController } from './whatsapp.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, Order]),
    AiModule,
    OrdersModule,
  ],
  controllers: [WhatsappWebhookController, WhatsappController],
  providers: [EvolutionApiService, WhatsappService],
  exports: [WhatsappService, EvolutionApiService],
})
export class WhatsappModule {}


