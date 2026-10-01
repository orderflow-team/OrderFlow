import { Controller, Post, Body, HttpCode, HttpStatus, Logger, Query, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { WhatsappService } from './whatsapp.service';

/** Constant-time comparison so the token can't be guessed byte-by-byte from response timing. */
function tokenMatches(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Controller('api/whatsapp/webhook')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(private whatsappService: WhatsappService) {}

  /**
   * Webhook endpoint for Evolution API events (`messages.upsert` etc.).
   * Public route, so every call must carry WHATSAPP_WEBHOOK_SECRET as
   * `?token=` — EvolutionApiService registers the webhook URL with it. Without
   * this, anyone who guessed a shop's instance name could forge messages and
   * create orders. Fails closed when the secret isn't configured.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Query('token') token: string | undefined, @Body() payload: any) {
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!secret || !tokenMatches(token, secret)) {
      this.logger.warn('Rejected WhatsApp webhook call with a missing or invalid token');
      throw new UnauthorizedException();
    }
    try {
      this.logger.debug(`Received Evolution API webhook event: ${payload?.event}`);
      return await this.whatsappService.handleWebhookPayload(payload);
    } catch (err: any) {
      this.logger.error(`Webhook handler caught error: ${err.message}`, err.stack);
      return { status: 'error', message: err.message || 'Error processing webhook' };
    }
  }
}
