import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('api/whatsapp/webhook')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(private whatsappService: WhatsappService) {}

  /**
   * Public Webhook endpoint for Evolution API events.
   * Evolution API POSTs events like `messages.upsert` to this route.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any) {
    try {
      this.logger.debug(`Received Evolution API webhook event: ${payload?.event}`);
      return await this.whatsappService.handleWebhookPayload(payload);
    } catch (err: any) {
      this.logger.error(`Webhook handler caught error: ${err.message}`, err.stack);
      return { status: 'error', message: err.message || 'Error processing webhook' };
    }
  }
}
