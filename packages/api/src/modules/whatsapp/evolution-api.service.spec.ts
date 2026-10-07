import axios from 'axios';
import { EvolutionApiService } from './evolution-api.service';

jest.mock('axios');
const mockedGet = axios.get as jest.Mock;

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });
const netError = (code: string) => Object.assign(new Error(code), { code });

describe('EvolutionApiService.diagnose', () => {
  const OLD_ENV = process.env;
  let service: EvolutionApiService;

  beforeEach(() => {
    process.env = { ...OLD_ENV, EVOLUTION_API_KEY: 'test-key', EVOLUTION_API_URL: 'https://gw.example.com/evolution' };
    mockedGet.mockReset();
    service = new EvolutionApiService();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('reports key_missing without touching the network when EVOLUTION_API_KEY is unset', async () => {
    delete process.env.EVOLUTION_API_KEY;

    const result = await service.diagnose();

    expect(result).toEqual({ kind: 'key_missing', detail: 'EVOLUTION_API_KEY is not set' });
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('returns null when a gateway accepts the key', async () => {
    mockedGet.mockResolvedValue({ data: [] });

    expect(await service.diagnose()).toBeNull();
  });

  it('reports key_rejected when the gateway answers 401, even if other URLs are down', async () => {
    mockedGet.mockImplementation((url: string) =>
      url.startsWith('https://gw.example.com') ? Promise.reject(httpError(401)) : Promise.reject(netError('ECONNREFUSED')),
    );

    const result = await service.diagnose();

    expect(result?.kind).toBe('key_rejected');
    expect(result?.status).toBe(401);
    expect(result?.detail).toContain('gw.example.com');
  });

  it('treats 403 like a rejected key', async () => {
    mockedGet.mockRejectedValue(httpError(403));

    expect((await service.diagnose())?.kind).toBe('key_rejected');
  });

  it('reports http_error for a non-auth HTTP failure', async () => {
    mockedGet.mockRejectedValue(httpError(502));

    const result = await service.diagnose();

    expect(result?.kind).toBe('http_error');
    expect(result?.status).toBe(502);
  });

  it('reports unreachable when nothing answers, and lists the network codes', async () => {
    mockedGet.mockRejectedValue(netError('ECONNREFUSED'));

    const result = await service.diagnose();

    expect(result?.kind).toBe('unreachable');
    expect(result?.detail).toContain('ECONNREFUSED');
  });

  it('never includes the API key in its output', async () => {
    mockedGet.mockRejectedValue(httpError(401));

    expect(JSON.stringify(await service.diagnose())).not.toContain('test-key');
  });

  it('sends the key as the apikey header with a short timeout', async () => {
    mockedGet.mockResolvedValue({ data: [] });

    await service.diagnose();

    expect(mockedGet).toHaveBeenCalledWith(
      expect.stringContaining('/instance/fetchInstances'),
      expect.objectContaining({ headers: expect.objectContaining({ apikey: 'test-key' }), timeout: 3000 }),
    );
  });
});
