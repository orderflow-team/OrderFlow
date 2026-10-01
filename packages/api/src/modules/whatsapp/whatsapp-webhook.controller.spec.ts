import { UnauthorizedException } from '@nestjs/common';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';

describe('WhatsappWebhookController', () => {
  const ORIGINAL_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET;
  let whatsappService: { handleWebhookPayload: jest.Mock };
  let controller: WhatsappWebhookController;

  beforeEach(() => {
    process.env.WHATSAPP_WEBHOOK_SECRET = 'correct-horse-battery-staple';
    whatsappService = { handleWebhookPayload: jest.fn().mockResolvedValue({ status: 'ok' }) };
    controller = new WhatsappWebhookController(whatsappService as any);
  });

  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.WHATSAPP_WEBHOOK_SECRET;
    else process.env.WHATSAPP_WEBHOOK_SECRET = ORIGINAL_SECRET;
  });

  it('processes an event carrying the right token', async () => {
    const payload = { event: 'messages.upsert' };
    await expect(controller.handleWebhook('correct-horse-battery-staple', payload)).resolves.toEqual({ status: 'ok' });
    expect(whatsappService.handleWebhookPayload).toHaveBeenCalledWith(payload);
  });

  it.each([
    ['no token', undefined],
    ['a wrong token of the same length', 'correct-horse-battery-stapl3'],
    ['a wrong token of a different length', 'nope'],
  ])('rejects %s without touching the payload', async (_label, token) => {
    await expect(controller.handleWebhook(token, { event: 'messages.upsert' })).rejects.toThrow(UnauthorizedException);
    expect(whatsappService.handleWebhookPayload).not.toHaveBeenCalled();
  });

  it('fails closed when no secret is configured', async () => {
    delete process.env.WHATSAPP_WEBHOOK_SECRET;
    await expect(controller.handleWebhook('anything', { event: 'messages.upsert' })).rejects.toThrow(UnauthorizedException);
    expect(whatsappService.handleWebhookPayload).not.toHaveBeenCalled();
  });
});
