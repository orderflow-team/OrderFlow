import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

const generateContentMock = jest.fn();
const getGenerativeModelMock = jest.fn(() => ({ generateContent: generateContentMock }));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({ getGenerativeModel: getGenerativeModelMock })),
}));

import { GeminiKeyPoolService } from './gemini-key-pool.service';

describe('GeminiKeyPoolService', () => {
  const buildService = async (env: Record<string, string | undefined>) => {
    const configService = { get: jest.fn((key: string) => env[key]) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeminiKeyPoolService, { provide: ConfigService, useValue: configService }],
    }).compile();
    return module.get(GeminiKeyPoolService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: any) => {
      fn();
      return 0 as any;
    }) as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('is false when no API key is set', async () => {
      const service = await buildService({});

      expect(service.isConfigured).toBe(false);
    });

    it('ignores the literal placeholder "test-key"', async () => {
      const service = await buildService({ GEMINI_API_KEY: 'test-key' });

      expect(service.isConfigured).toBe(false);
    });

    it('is true when a real key is set', async () => {
      const service = await buildService({ GEMINI_API_KEY: 'real-key' });

      expect(service.isConfigured).toBe(true);
    });

    it('supports a second key for pool fallback', async () => {
      const service = await buildService({ GEMINI_API_KEY: 'key-1', GEMINI_API_KEY_2: 'key-2' });

      expect(service.isConfigured).toBe(true);
    });
  });

  describe('generateContent', () => {
    it('throws when no client is configured', async () => {
      const service = await buildService({});

      await expect(service.generateContent('gemini-2.5-flash', ['hi'])).rejects.toThrow(
        'Generative AI is not configured on the server.',
      );
    });

    it('returns the generated text on success', async () => {
      const service = await buildService({ GEMINI_API_KEY: 'key-1' });
      generateContentMock.mockResolvedValue({ response: { text: () => 'hello world' } });

      const result = await service.generateContent('gemini-2.5-flash', ['hi']);

      expect(result).toBe('hello world');
    });

    it('retries the same key on a transient 503 overloaded error, then succeeds', async () => {
      const service = await buildService({ GEMINI_API_KEY: 'key-1' });
      generateContentMock
        .mockRejectedValueOnce(new Error('503 The model is overloaded'))
        .mockResolvedValueOnce({ response: { text: () => 'ok on retry' } });

      const result = await service.generateContent('gemini-2.5-flash', ['hi']);

      expect(generateContentMock).toHaveBeenCalledTimes(2);
      expect(result).toBe('ok on retry');
    });

    it('gives up on this key after 2 overloaded attempts and throws if there is no other key', async () => {
      const service = await buildService({ GEMINI_API_KEY: 'key-1' });
      generateContentMock.mockRejectedValue(new Error('503 overloaded'));

      await expect(service.generateContent('gemini-2.5-flash', ['hi'])).rejects.toThrow('503 overloaded');
      expect(generateContentMock).toHaveBeenCalledTimes(2);
    });

    it('moves to the next key immediately on a 429/quota error without retrying the same key', async () => {
      const service = await buildService({ GEMINI_API_KEY: 'key-1', GEMINI_API_KEY_2: 'key-2' });
      generateContentMock
        .mockRejectedValueOnce(new Error('429 Too Many Requests'))
        .mockResolvedValueOnce({ response: { text: () => 'from key 2' } });

      const result = await service.generateContent('gemini-2.5-flash', ['hi']);

      expect(generateContentMock).toHaveBeenCalledTimes(2);
      expect(result).toBe('from key 2');
    });

    it('moves to the next key on a lowercase "quota" message too', async () => {
      const service = await buildService({ GEMINI_API_KEY: 'key-1', GEMINI_API_KEY_2: 'key-2' });
      generateContentMock
        .mockRejectedValueOnce(new Error('quota exceeded for this project'))
        .mockResolvedValueOnce({ response: { text: () => 'from key 2' } });

      const result = await service.generateContent('gemini-2.5-flash', ['hi']);

      expect(result).toBe('from key 2');
    });

    it('does not retry a non-transient, non-rate-limit error at all', async () => {
      const service = await buildService({ GEMINI_API_KEY: 'key-1' });
      generateContentMock.mockRejectedValue(new Error('invalid API key'));

      await expect(service.generateContent('gemini-2.5-flash', ['hi'])).rejects.toThrow('invalid API key');
      expect(generateContentMock).toHaveBeenCalledTimes(1);
    });

    it('throws the last error after exhausting every key', async () => {
      const service = await buildService({ GEMINI_API_KEY: 'key-1', GEMINI_API_KEY_2: 'key-2' });
      generateContentMock.mockRejectedValue(new Error('429 quota exceeded'));

      await expect(service.generateContent('gemini-2.5-flash', ['hi'])).rejects.toThrow('429 quota exceeded');
      expect(generateContentMock).toHaveBeenCalledTimes(2);
    });
  });
});
