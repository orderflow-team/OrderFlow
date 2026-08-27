import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { OrderParserService } from './services/order-parser.service';

describe('AiController', () => {
  let controller: AiController;
  let service: jest.Mocked<OrderParserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: OrderParserService,
          useValue: { parseVoiceTranscript: jest.fn(), parseChatOrder: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(AiController);
    service = module.get(OrderParserService);
  });

  describe('parseVoice', () => {
    it('returns a success envelope wrapping the parsed order', async () => {
      (service.parseVoiceTranscript as jest.Mock).mockResolvedValue({ customerName: 'Neel', items: [] });

      const result = await controller.parseVoice({ transcript: '2kg rice', customerId: 'cust-1' } as any);

      expect(service.parseVoiceTranscript).toHaveBeenCalledWith('2kg rice', 'business-id-placeholder', 'cust-1');
      expect(result).toEqual({ order: { customerName: 'Neel', items: [] }, status: 'success' });
    });

    it('returns an error envelope instead of throwing when the service rejects', async () => {
      (service.parseVoiceTranscript as jest.Mock).mockRejectedValue(new Error('Transcript cannot be empty'));

      const result = await controller.parseVoice({ transcript: '', customerId: 'cust-1' } as any);

      expect(result).toEqual({ error: 'Transcript cannot be empty', status: 'error' });
    });
  });

  it('chatOrder delegates to the service with the dto fields spread positionally', () => {
    const dto = { businessId: 'biz-1', message: '2 widget', orderId: 'order-1', pendingCustomer: { customerName: 'Neel' } };
    controller.chatOrder(dto as any);
    expect(service.parseChatOrder).toHaveBeenCalledWith('biz-1', '2 widget', 'order-1', { customerName: 'Neel' });
  });
});
