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
          useValue: { parseChatOrder: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(AiController);
    service = module.get(OrderParserService);
  });

  describe('chatOrder', () => {
    it('hands the message to the parser for the caller’s business and returns its result', async () => {
      service.parseChatOrder.mockResolvedValue({ reply: 'Added 2 kg rice' } as any);

      const result = await controller.chatOrder({
        businessId: 'biz-1',
        message: '2 kg rice',
        orderId: 'order-1',
        pendingCustomer: undefined,
      } as any);

      expect(service.parseChatOrder).toHaveBeenCalledWith('biz-1', '2 kg rice', 'order-1', undefined);
      expect(result).toEqual({ reply: 'Added 2 kg rice' });
    });
  });
});
