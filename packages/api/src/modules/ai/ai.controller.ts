import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { OrderParserService } from './services/order-parser.service';

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
}
