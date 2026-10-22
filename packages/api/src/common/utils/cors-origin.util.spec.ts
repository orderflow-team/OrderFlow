import { isOriginAllowed, parseAllowedOrigins, DEFAULT_ALLOWED_ORIGINS } from './cors-origin.util';

const prod = (allowedOrigins = parseAllowedOrigins(undefined)) => ({ allowedOrigins, production: true });
const dev = (allowedOrigins = parseAllowedOrigins(undefined)) => ({ allowedOrigins, production: false });

describe('parseAllowedOrigins', () => {
  it('uses the built-in list when ALLOWED_ORIGINS is unset or blank', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([...DEFAULT_ALLOWED_ORIGINS]);
    expect(parseAllowedOrigins('')).toEqual([...DEFAULT_ALLOWED_ORIGINS]);
    expect(parseAllowedOrigins(' , ,')).toEqual([...DEFAULT_ALLOWED_ORIGINS]);
  });

  it('replaces the defaults when set, trimming spaces and trailing slashes', () => {
    expect(parseAllowedOrigins(' https://a.example/ , https://b.example ')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });
});

describe('isOriginAllowed', () => {
  it('lets through requests with no Origin header', () => {
    expect(isOriginAllowed(undefined, prod())).toBe(true);
  });

  it('allows the production site and its aliases', () => {
    expect(isOriginAllowed('https://obix360.com', prod())).toBe(true);
    expect(isOriginAllowed('https://www.obix360.com', prod())).toBe(true);
  });

  it('always allows the exact Capacitor WebView origins', () => {
    for (const o of ['https://localhost', 'http://localhost', 'capacitor://localhost']) {
      expect(isOriginAllowed(o, prod())).toBe(true);
    }
  });

  it('rejects other localhost origins and capacitor hosts in production', () => {
    for (const o of [
      'http://localhost:3000',
      'http://localhost:9999',
      'https://localhost:8443',
      'http://127.0.0.1:3000',
      'capacitor://evil.example',
      'capacitor://localhost.evil.example',
    ]) {
      expect(isOriginAllowed(o, prod())).toBe(false);
    }
  });

  it('allows the local development servers outside production only', () => {
    expect(isOriginAllowed('http://localhost:3000', dev())).toBe(true);
    expect(isOriginAllowed('http://localhost:3000', prod())).toBe(false);
    expect(isOriginAllowed('http://localhost:9999', dev())).toBe(false);
  });

  it('rejects unknown and look-alike origins', () => {
    for (const o of ['https://evil.example', 'https://obix360.com.evil.example', 'http://obix360.com', 'null']) {
      expect(isOriginAllowed(o, prod())).toBe(false);
    }
  });

  it('honours ALLOWED_ORIGINS exactly: stale defaults are no longer accepted', () => {
    const options = prod(parseAllowedOrigins('https://app.example'));

    expect(isOriginAllowed('https://app.example', options)).toBe(true);
    expect(isOriginAllowed('https://obix360.com', options)).toBe(false);
  });
});
