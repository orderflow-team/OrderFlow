import { resolveListenPort } from './listen-port.util';

describe('resolveListenPort', () => {
  it('uses PORT when it is set', () => {
    expect(resolveListenPort({ PORT: '3001', NODE_ENV: 'production' })).toEqual({ port: 3001, usedDefault: false });
    expect(resolveListenPort({ PORT: '5000' })).toEqual({ port: 5000, usedDefault: false });
  });

  it('falls back to 3001 in production so it matches the Apache proxy', () => {
    expect(resolveListenPort({ NODE_ENV: 'production' })).toEqual({ port: 3001, usedDefault: true });
  });

  it('keeps 4000 outside production so local dev is unchanged', () => {
    expect(resolveListenPort({})).toEqual({ port: 4000, usedDefault: true });
    expect(resolveListenPort({ NODE_ENV: 'development' })).toEqual({ port: 4000, usedDefault: true });
  });

  it('ignores a blank or invalid PORT instead of listening on garbage', () => {
    expect(resolveListenPort({ PORT: '', NODE_ENV: 'production' })).toEqual({ port: 3001, usedDefault: true });
    expect(resolveListenPort({ PORT: 'abc' })).toEqual({ port: 4000, usedDefault: true });
    expect(resolveListenPort({ PORT: '0' })).toEqual({ port: 4000, usedDefault: true });
    expect(resolveListenPort({ PORT: '70000' })).toEqual({ port: 4000, usedDefault: true });
  });
});
