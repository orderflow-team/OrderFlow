import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let configService: jest.Mocked<ConfigService>;
  const originalFetch = global.fetch;

  const buildModule = async (config: Record<string, string | undefined>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => config[key]) },
        },
      ],
    }).compile();

    service = module.get(MailService);
    configService = module.get(ConfigService);
  };

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('when the email proxy is configured', () => {
    beforeEach(async () => {
      await buildModule({ EMAIL_PROXY_URL: 'https://proxy.example.com/send', EMAIL_PROXY_SECRET: 'secret' });
    });

    it('sendOtpEmail posts to the proxy and returns true on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

      const result = await service.sendOtpEmail('user@example.com', '123456');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://proxy.example.com/send',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.email).toBe('user@example.com');
      expect(body.secret).toBe('secret');
      expect(body.text).toContain('123456');
      expect(result).toBe(true);
    });

    it('sendPasswordResetEmail posts to the proxy and returns true on success', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

      const result = await service.sendPasswordResetEmail('user@example.com', '654321');

      expect(result).toBe(true);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.subject).toMatch(/reset/i);
    });

    it('returns false when the proxy responds with a non-ok status', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' }) as any;

      const result = await service.sendOtpEmail('user@example.com', '123456');

      expect(result).toBe(false);
    });

    it('returns false when fetch throws (network failure)', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

      const result = await service.sendOtpEmail('user@example.com', '123456');

      expect(result).toBe(false);
    });
  });

  describe('when the email proxy is not configured', () => {
    beforeEach(async () => {
      await buildModule({ EMAIL_PROXY_URL: undefined, EMAIL_PROXY_SECRET: undefined });
    });

    it('returns false and never calls fetch', async () => {
      global.fetch = jest.fn() as any;

      const result = await service.sendOtpEmail('user@example.com', '123456');

      expect(result).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
