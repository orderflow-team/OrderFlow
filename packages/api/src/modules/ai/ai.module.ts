import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { OrderParserService } from './services/order-parser.service';

@Module({
  controllers: [AiController],
  providers: [OrderParserService],
})
export class AiModule {}
