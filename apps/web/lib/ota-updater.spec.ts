import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as nodeCrypto from 'node:crypto';
import { otaSigningMessage } from './ota-signature';

const downloadMock = vi.fn();
const setMock = vi.fn();
const reloadMock = vi.fn();

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } }));
vi.mock('@capgo/capacitor-updater', () => ({
  CapacitorUpdater: {
    notifyAppReady: vi.fn(),
    current: vi.fn(async () => ({ bundle: { version: '1.0.0' }, native: '1.18' })),
    download: (arg: unknown) => downloadMock(arg),
    set: (arg: unknown) => setMock(arg),
    reload: () => reloadMock(),
  },
}));
vi.mock('./api-client', () => ({ API_BASE_URL: 'https://api.test' }));

const { publicKey, privateKey } = nodeCrypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const sign = (platform: string, version: string, checksum: string, key = privateKey) =>
  nodeCrypto.sign('sha256', Buffer.from(otaSigningMessage(platform, version, checksum)), { key, dsaEncoding: 'ieee-p1363' }).toString('base64');

const checksum = 'c'.repeat(64);
const release = (over: Record<string, unknown> = {}) => ({
  platform: 'android',
  version: '1.1.0',
  url: 'https://files.test/bundle.zip',
  checksum,
  signature: sign('android', '1.1.0', checksum),
  minNativeVersion: null,
  notes: null,
  ...over,
});

async function runUpdater(latest: unknown, publicKeyEnv: string | undefined) {
  vi.resetModules();
  if (publicKeyEnv) vi.stubEnv('NEXT_PUBLIC_OTA_PUBLIC_KEY', publicKeyEnv);
  else vi.stubEnv('NEXT_PUBLIC_OTA_PUBLIC_KEY', '');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => latest })));
  const { checkForOtaUpdate } = await import('./ota-updater');
  await checkForOtaUpdate();
}

describe('checkForOtaUpdate signature enforcement', () => {
  beforeEach(() => {
    downloadMock.mockReset().mockResolvedValue({ id: 'bundle-1' });
    setMock.mockReset();
    reloadMock.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('applies a release signed by the trusted key, passing the signed checksum to the native download', async () => {
    await runUpdater(release(), publicB64);

    expect(downloadMock).toHaveBeenCalledWith({ url: 'https://files.test/bundle.zip', version: '1.1.0', checksum });
    expect(setMock).toHaveBeenCalledWith({ id: 'bundle-1' });
    expect(reloadMock).toHaveBeenCalled();
  });

  it('never downloads a release with no signature', async () => {
    await runUpdater(release({ signature: null }), publicB64);

    expect(downloadMock).not.toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
  });

  it('never downloads a release signed by another key (e.g. a compromised server with its own key)', async () => {
    const other = nodeCrypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

    await runUpdater(release({ signature: sign('android', '1.1.0', checksum, other.privateKey) }), publicB64);

    expect(downloadMock).not.toHaveBeenCalled();
  });

  it('never downloads when the API swaps in a different bundle checksum under a valid signature', async () => {
    await runUpdater(release({ checksum: 'd'.repeat(64) }), publicB64);

    expect(downloadMock).not.toHaveBeenCalled();
  });

  it('never downloads when the API swaps in a different version under a valid signature', async () => {
    await runUpdater(release({ version: '9.9.9' }), publicB64);

    expect(downloadMock).not.toHaveBeenCalled();
  });

  it('refuses a release published for an unrelated platform, even with a valid signature', async () => {
    await runUpdater(release({ platform: 'ios', signature: sign('ios', '1.1.0', checksum) }), publicB64);

    expect(downloadMock).not.toHaveBeenCalled();
  });

  it('accepts a release published under the shared base platform for a flavored channel', async () => {
    // The device asks for "android-direct"; the API falls back to the "android" release.
    await runUpdater(release({ platform: 'android' }), publicB64);

    expect(downloadMock).toHaveBeenCalled();
  });

  it('keeps today\'s behaviour (applies, with a warning) in a build that has no public key', async () => {
    await runUpdater(release({ signature: null }), undefined);

    expect(downloadMock).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('WITHOUT signature verification'));
  });
});
