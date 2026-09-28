import { createHash } from 'crypto';
import { AppGoogleHandoffService } from './app-google-handoff.service';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

describe('AppGoogleHandoffService', () => {
  const secret = 'a'.repeat(64);
  const loginResult = { access_token: 'at', refresh_token: 'rt', user: { id: 'u1' }, isNewUser: false };
  let authService: { googleAuth: jest.Mock };
  let service: AppGoogleHandoffService;

  beforeEach(() => {
    authService = { googleAuth: jest.fn().mockResolvedValue(loginResult) };
    service = new AppGoogleHandoffService(authService as any);
  });

  it('hands the Google login to the app holding the secret, once', async () => {
    const { sessionId, code } = service.create(sha256(secret));
    expect(service.describe(sessionId)).toEqual({ code });
    expect(service.claim(sessionId, secret)).toEqual({ status: 'pending' });

    await service.complete(sessionId, { idToken: 'google-id-token' });
    expect(authService.googleAuth).toHaveBeenCalledWith({ idToken: 'google-id-token' });

    expect(service.claim(sessionId, secret)).toEqual({ status: 'complete', ...loginResult });
    expect(() => service.claim(sessionId, secret)).toThrow('expired');
  });

  it('refuses to release the login without the right secret', async () => {
    const { sessionId } = service.create(sha256(secret));
    await service.complete(sessionId, { idToken: 't' });
    expect(() => service.claim(sessionId, 'b'.repeat(64))).toThrow('expired');
    expect(service.claim(sessionId, secret).status).toBe('complete');
  });

  it('cannot be completed twice', async () => {
    const { sessionId } = service.create(sha256(secret));
    await service.complete(sessionId, { idToken: 't' });
    await expect(service.complete(sessionId, { idToken: 'other' })).rejects.toThrow('already completed');
  });

  it('does not store a session when Google rejects the token', async () => {
    authService.googleAuth.mockRejectedValue(new Error('Invalid or expired Google authentication token'));
    const { sessionId } = service.create(sha256(secret));
    await expect(service.complete(sessionId, { idToken: 'bad' })).rejects.toThrow('Invalid');
    expect(service.claim(sessionId, secret)).toEqual({ status: 'pending' });
  });

  it('expires sessions after 10 minutes', () => {
    jest.useFakeTimers();
    try {
      const { sessionId } = service.create(sha256(secret));
      jest.advanceTimersByTime(10 * 60_000 + 1);
      expect(() => service.describe(sessionId)).toThrow('expired');
      expect(() => service.claim(sessionId, secret)).toThrow('expired');
    } finally {
      jest.useRealTimers();
    }
  });
});
