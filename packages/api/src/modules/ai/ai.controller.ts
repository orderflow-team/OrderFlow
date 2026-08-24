import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrderParserService } from './services/order-parser.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessScopeGuard } from '../../common/guards/business-scope.guard';
import { ChatOrderDto } from './dto/chat-order.dto';

@UseGuards(JwtAuthGuard, BusinessScopeGuard)
@Controller('api/ai')
export class AiController {
  constructor(private parserService: OrderParserService) {}

  @Post('parse-voice')
  async parseVoice(
    @Body() body: { transcript: string; customerId: string },
  ) {
    try {
      const order = await this.parserService.parseVoiceTranscript(
        body.transcript,
        'business-id-placeholder', // Will use real business_id in Phase 2
        body.customerId,
      );

      return {
        order,
        status: 'success',
      };
    } catch (error) {
      return {
        error: error.message,
        status: 'error',
      };
    }
  }

  // Well below the module-wide default (300/min, see app.module.ts) — each
  // request that falls through to Gemini is a paid, quota-limited call
  // (GeminiKeyPoolService), so this endpoint specifically shouldn't be
  // hammer-able at the same rate as a plain read.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('chat-order')
  async chatOrder(@Body() body: ChatOrderDto) {
    return this.parserService.parseChatOrder(body.businessId, body.message, body.orderId, body.pendingCustomer);
  }
}
