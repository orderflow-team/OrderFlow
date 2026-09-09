import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WhatsappService } from './whatsapp.service';
import { Business } from '../../database/entities/business.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderParserService } from '../ai/services/order-parser.service';
import { EvolutionApiService } from './evolution-api.service';

describe('WhatsappService', () => {
  let service: WhatsappService;
  let businessRepo: any;
  let orderRepo: any;
  let orderParserService: any;
  let evolutionApiService: any;

  const mockBusiness: Partial<Business> = {
    id: 'b1234567-89ab-cdef-0123-456789abcdef',
    name: 'Test Store',
    whatsapp_instance_name: 'obix-b1234567',
    whatsapp_enabled: true,
    whatsapp_connected: true,
    whatsapp_phone_number: '919876543210',
  };

  beforeEach(async () => {
    businessRepo = {
      findOne: jest.fn().mockResolvedValue(mockBusiness),
      find: jest.fn().mockResolvedValue([mockBusiness]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    orderRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    orderParserService = {
      parseChatOrder: jest.fn().mockResolvedValue({
        reply: 'Order placed for 2x Rice',
        order: { id: 'order-123', order_number: 101 },
      }),
    };

    evolutionApiService = {
      sendTextMessage: jest.fn().mockResolvedValue({ status: 'sent' }),
      fetchConnectionState: jest.fn().mockResolvedValue('open'),
      createInstance: jest.fn().mockResolvedValue({ status: 'created' }),
      fetchQrCode: jest.fn().mockResolvedValue({ base64: 'qr-base64-data' }),
      logoutInstance: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: OrderParserService, useValue: orderParserService },
        { provide: EvolutionApiService, useValue: evolutionApiService },
      ],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
  });

  describe('handleWebhookPayload', () => {
    it('returns ignored for null payload', async () => {
      const res = await service.handleWebhookPayload(null);
      expect(res).toEqual({ status: 'ignored' });
    });

    it('handles uppercase CONNECTION_UPDATE event properly', async () => {
      const payload = {
        event: 'CONNECTION_UPDATE',
        instance: 'obix-b1234567',
        data: { state: 'open' },
      };

      const res = await service.handleWebhookPayload(payload);
      expect(res).toEqual({ status: 'connection_updated', isConnected: true, state: 'open' });
      expect(businessRepo.update).toHaveBeenCalledWith(
        { id: mockBusiness.id },
        { whatsapp_connected: true, whatsapp_instance_name: 'obix-b1234567', whatsapp_enabled: true },
      );
    });

    it('ignores normal personal chats that do not contain Obix', async () => {
      const payload = {
        event: 'MESSAGES_UPSERT',
        instance: 'obix-b1234567',
        data: {
          key: { remoteJid: '919876543210@s.whatsapp.net', fromMe: false },
          pushName: 'Friend John',
          message: { conversation: 'Hey brother, are we meeting for dinner tonight?' },
        },
      };

      const res = await service.handleWebhookPayload(payload);
      expect(res).toEqual({ status: 'ignored_not_an_order' });
      expect(orderParserService.parseChatOrder).not.toHaveBeenCalled();
    });

    it('ignores messages containing domain names/URLs like obix360.com without the explicit trigger', async () => {
      const payload = {
        event: 'MESSAGES_UPSERT',
        instance: 'obix-b1234567',
        data: {
          key: { remoteJid: '919876543210@s.whatsapp.net', fromMe: false },
          pushName: 'Admin Neel',
          message: {
            conversation: 'obix360.com\nhttps://obix360.com/api/whatsapp/webhook\nEVOLUTION_API_URL=http://localhost:8080',
          },
        },
      };

      const res = await service.handleWebhookPayload(payload);
      expect(res).toEqual({ status: 'ignored_not_an_order' });
      expect(orderParserService.parseChatOrder).not.toHaveBeenCalled();
    });

    it('processes uppercase MESSAGES_UPSERT event with Hi Obix trigger and places order', async () => {
      const payload = {
        event: 'MESSAGES_UPSERT',
        instance: 'obix-b1234567',
        data: {
          key: { remoteJid: '919876543210@s.whatsapp.net', fromMe: false },
          pushName: 'Customer Neel',
          message: { conversation: 'Hi Obix, 2kg rice' },
        },
      };

      const res = await service.handleWebhookPayload(payload);
      expect(res).toEqual({ status: 'success', orderId: 'order-123' });
      expect(orderParserService.parseChatOrder).toHaveBeenCalledWith(
        mockBusiness.id,
        '2kg rice',
        undefined,
        { customerName: 'Customer Neel', phone: '919876543210' },
      );
      expect(orderRepo.update).toHaveBeenCalledWith({ id: 'order-123' }, { origin: 'whatsapp' });
      expect(evolutionApiService.sendTextMessage).toHaveBeenCalledWith(
        'obix-b1234567',
        '919876543210',
        'Order placed for 2x Rice',
      );
    });

    it('handles array payload data from Evolution API with Obix trigger', async () => {
      const payload = {
        event: 'messages.upsert',
        instance: 'obix-b1234567',
        data: [
          {
            key: { remoteJid: '919876543210@s.whatsapp.net', fromMe: false },
            pushName: 'Customer Neel',
            message: { extendedTextMessage: { text: 'Hi Obix 1 dozen eggs' } },
          },
        ],
      };

      const res = await service.handleWebhookPayload(payload);
      expect(res).toEqual({ status: 'success', orderId: 'order-123' });
    });

    it('ignores duplicate message webhook events with the same message ID', async () => {
      const payload = {
        event: 'MESSAGES_UPSERT',
        instance: 'obix-b1234567',
        data: {
          key: { id: 'MSG_DUP_123', remoteJid: '919876543210@s.whatsapp.net', fromMe: false },
          pushName: 'Customer Neel',
          message: { conversation: 'Hi Obix, 4kg rice' },
        },
      };

      const firstRes = await service.handleWebhookPayload(payload);
      expect(firstRes).toEqual({ status: 'success', orderId: 'order-123' });

      // Second webhook call with identical message ID
      const secondRes = await service.handleWebhookPayload(payload);
      expect(secondRes).toEqual({ status: 'ignored_duplicate' });
    });

    it('ignores automated outgoing bot replies (fromMe: true starting with bot emoji/prefix)', async () => {
      const payload = {
        event: 'MESSAGES_UPSERT',
        instance: 'obix-b1234567',
        data: {
          key: { remoteJid: '919876543210@s.whatsapp.net', fromMe: true },
          message: { conversation: '✅ Order Confirmed! Your order #101 has been confirmed.' },
        },
      };

      const res = await service.handleWebhookPayload(payload);
      expect(res).toEqual({ status: 'ignored_bot_reply' });
      expect(orderParserService.parseChatOrder).not.toHaveBeenCalled();
    });

    it('processes human test messages sent from connected phone (fromMe: true)', async () => {
      const payload = {
        event: 'MESSAGES_UPSERT',
        instance: 'obix-b1234567',
        data: {
          key: { remoteJid: '919876543210@s.whatsapp.net', fromMe: true },
          pushName: 'N3èl',
          message: { conversation: 'Hi Obix, I want to place an order: 3 Tata Salt' },
        },
      };

      const res = await service.handleWebhookPayload(payload);
      expect(res).toEqual({ status: 'success', orderId: 'order-123' });
      expect(orderParserService.parseChatOrder).toHaveBeenCalledWith(
        mockBusiness.id,
        'I want to place an order: 3 Tata Salt',
        undefined,
        { customerName: 'N3èl', phone: '919876543210' },
      );
    });

    it('ignores non-whatsapp direct customer messages (e.g. group chats @g.us)', async () => {
      const payload = {
        event: 'MESSAGES_UPSERT',
        instance: 'obix-b1234567',
        data: {
          key: { remoteJid: '12036301234567@g.us', fromMe: false },
          message: { conversation: 'Hi Obix 2kg rice' },
        },
      };

      const res = await service.handleWebhookPayload(payload);
      expect(res).toEqual({ status: 'ignored_group_or_status' });
    });

    it('sends error message when parsing fails', async () => {
      orderParserService.parseChatOrder.mockRejectedValueOnce(new Error('AI parsing failed'));

      const payload = {
        event: 'MESSAGES_UPSERT',
        instance: 'obix-b1234567',
        data: {
          key: { remoteJid: '919876543210@s.whatsapp.net', fromMe: false },
          pushName: 'Customer Neel',
          message: { conversation: 'Hi Obix complex order string' },
        },
      };

      const res = await service.handleWebhookPayload(payload);
      expect(res).toEqual({ status: 'error', error: 'AI parsing failed' });
      expect(evolutionApiService.sendTextMessage).toHaveBeenCalledWith(
        'obix-b1234567',
        '919876543210',
        "Sorry, we couldn't process your order automatically: AI parsing failed",
      );
    });
  });
});
