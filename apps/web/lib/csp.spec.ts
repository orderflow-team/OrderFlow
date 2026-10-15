import { describe, expect, it } from 'vitest';
import { buildCsp, toOrigin } from './csp';

const prod = (connectOrigins: Array<string | undefined> = []) => buildCsp({ isDev: false, connectOrigins });

describe('toOrigin', () => {
  it('reduces a URL to its origin', () => {
    expect(toOrigin('https://obix360.com/api/x?y=1')).toBe('https://obix360.com');
  });

  it('drops empty and unparsable values', () => {
    expect(toOrigin(undefined)).toBeNull();
    expect(toOrigin('')).toBeNull();
    expect(toOrigin('not a url')).toBeNull();
  });
});

describe('buildCsp', () => {
  it('locks down the dangerous directives', () => {
    const csp = prod();

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it('does not allow eval or websockets in production', () => {
    const csp = prod(['https://obix360.com']);

    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('ws:');
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('allows eval and local connections only in development', () => {
    const csp = buildCsp({ isDev: true, connectOrigins: [] });

    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain('ws:');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('limits connect-src to self, Google sign-in and the configured origins', () => {
    const csp = prod(['https://obix360.com/api', 'https://mailer.example.vercel.app', undefined, 'garbage']);
    const connect = csp.split('; ').find((d) => d.startsWith('connect-src '))!;

    expect(connect).toBe(
      "connect-src 'self' https://accounts.google.com https://raw.githack.com https://obix360.com https://mailer.example.vercel.app",
    );
  });

  it('lists each origin once', () => {
    const csp = prod(['https://obix360.com', 'https://obix360.com/login']);

    expect(csp.match(/https:\/\/obix360\.com/g)).toHaveLength(1);
  });

  it('loads scripts only from this origin and the Google sign-in client', () => {
    const script = prod().split('; ').find((d) => d.startsWith('script-src '))!;

    expect(script).toBe("script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client");
  });
});
