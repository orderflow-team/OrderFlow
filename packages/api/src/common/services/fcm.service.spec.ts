import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

const initializeAppMock = jest.fn();
const certMock = jest.fn((sa) => sa);
const sendEachForMulticastMock = jest.fn();
const messagingMock = jest.fn((_app: any) => ({ sendEachForMulticast: sendEachForMulticastMock }));

jest.mock('firebase-admin', () => ({
  initializeApp: (arg: any) => initializeAppMock(arg),
  credential: { cert: (arg: any) => certMock(arg) },
  messaging: (arg: any) => messagingMock(arg),
}));

import { FcmService } from './fcm.service';

describe('FcmService', () => {
  let configService: { get: jest.Mock };

  const buildService = async (raw: string | undefined) => {
    configService = { get: jest.fn().mockReturnValue(raw) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [FcmService, { provide: ConfigService, useValue: configService }],
    }).compile();
    return module.get(FcmService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    initializeAppMock.mockReturnValue({ name: 'fake-app' });
  });

  describe('isConfigured', () => {
    it('is false when FIREBASE_SERVICE_ACCOUNT is not set', async () => {
      const service = await buildService(undefined);

      expect(service.isConfigured).toBe(false);
      expect(initializeAppMock).not.toHaveBeenCalled();
    });

    it('is true when FIREBASE_SERVICE_ACCOUNT parses and initializes successfully', async () => {
      const service = await buildService(JSON.stringify({ project_id: 'p1', private_key: 'k', client_email: 'e' }));

      expect(service.isConfigured).toBe(true);
      expect(initializeAppMock).toHaveBeenCalled();
    });

    it('is false and does not throw when FIREBASE_SERVICE_ACCOUNT is malformed JSON', async () => {
      const service = await buildService('not-json');

      expect(service.isConfigured).toBe(false);
    });

    it('is false when initializeApp itself throws (e.g. invalid credential shape)', async () => {
      initializeAppMock.mockImplementation(() => {
        throw new Error('invalid credential');
      });

      const service = await buildService(JSON.stringify({ project_id: 'p1' }));

      expect(service.isConfigured).toBe(false);
    });
  });

  describe('sendToTokens', () => {
    it('returns an empty array without calling FCM when not configured', async () => {
      const service = await buildService(undefined);

      const result = await service.sendToTokens(['tok-1'], 'Title', 'Body');

      expect(result).toEqual([]);
      expect(messagingMock).not.toHaveBeenCalled();
    });

    it('returns an empty array when there are no tokens to send to', async () => {
      const service = await buildService(JSON.stringify({ project_id: 'p1' }));

      const result = await service.sendToTokens([], 'Title', 'Body');

      expect(result).toEqual([]);
      expect(messagingMock).not.toHaveBeenCalled();
    });

    it('sends to every token and returns none as invalid when all succeed', async () => {
      const service = await buildService(JSON.stringify({ project_id: 'p1' }));
      sendEachForMulticastMock.mockResolvedValue({ responses: [{ success: true }, { success: true }] });

      const result = await service.sendToTokens(['tok-1', 'tok-2'], 'Title', 'Body', { type: 'test' });

      expect(sendEachForMulticastMock).toHaveBeenCalledWith(
        expect.objectContaining({ tokens: ['tok-1', 'tok-2'], notification: { title: 'Title', body: 'Body' }, data: { type: 'test' } }),
      );
      expect(result).toEqual([]);
    });

    it('collects tokens FCM reports as unregistered/invalid for pruning', async () => {
      const service = await buildService(JSON.stringify({ project_id: 'p1' }));
      sendEachForMulticastMock.mockResolvedValue({
        responses: [
          { success: false, error: { code: 'messaging/registration-token-not-registered' } },
          { success: true },
          { success: false, error: { code: 'messaging/invalid-registration-token' } },
        ],
      });

      const result = await service.sendToTokens(['tok-1', 'tok-2', 'tok-3'], 'Title', 'Body');

      expect(result).toEqual(['tok-1', 'tok-3']);
    });

    it('does not treat a transient failure (not a registration error) as an invalid token', async () => {
      const service = await buildService(JSON.stringify({ project_id: 'p1' }));
      sendEachForMulticastMock.mockResolvedValue({
        responses: [{ success: false, error: { code: 'messaging/internal-error', message: 'temporary' } }],
      });

      const result = await service.sendToTokens(['tok-1'], 'Title', 'Body');

      expect(result).toEqual([]);
    });

    it('splits more than 500 tokens into multiple batched calls', async () => {
      const service = await buildService(JSON.stringify({ project_id: 'p1' }));
      sendEachForMulticastMock.mockImplementation(async ({ tokens }: { tokens: string[] }) => ({
        responses: tokens.map(() => ({ success: true })),
      }));
      const tokens = Array.from({ length: 600 }, (_, i) => `tok-${i}`);

      await service.sendToTokens(tokens, 'Title', 'Body');

      expect(sendEachForMulticastMock).toHaveBeenCalledTimes(2);
      expect(sendEachForMulticastMock.mock.calls[0][0].tokens).toHaveLength(500);
      expect(sendEachForMulticastMock.mock.calls[1][0].tokens).toHaveLength(100);
    });

    it('continues to the next batch when one batch call throws entirely', async () => {
      const service = await buildService(JSON.stringify({ project_id: 'p1' }));
      sendEachForMulticastMock
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({ responses: [{ success: true }] });
      const tokens = [...Array.from({ length: 500 }, (_, i) => `tok-${i}`), 'tok-extra'];

      const result = await service.sendToTokens(tokens, 'Title', 'Body');

      expect(sendEachForMulticastMock).toHaveBeenCalledTimes(2);
      expect(result).toEqual([]);
    });
  });
});
