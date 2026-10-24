import { describe, expect, it } from 'vitest';
import { buildMetadata, jsonLdString, NOINDEX, PRIVATE_PREFIXES, PUBLIC_ROUTES, SITE_URL } from './seo';

describe('buildMetadata', () => {
  const m = buildMetadata({ path: '/terms', title: 'Terms', description: 'd', keywords: ['k'] });

  it('sets canonical, og and twitter for the page itself', () => {
    expect(m.alternates?.canonical).toBe('/terms');
    expect(m.openGraph).toMatchObject({ url: `${SITE_URL}/terms`, type: 'website', siteName: 'OBIX 360', title: 'Terms | OBIX 360' });
    expect(m.twitter).toMatchObject({ card: 'summary_large_image', images: ['/og-image.png'] });
  });

  it('puts page keywords first and de-duplicates the site-wide ones', () => {
    const k = buildMetadata({ path: '/x', title: 't', description: 'd', keywords: ['OBIX 360', 'k'] }).keywords as string[];
    expect(k[0]).toBe('OBIX 360');
    expect(k.filter((x) => x === 'OBIX 360')).toHaveLength(1);
  });

  it('uses the homepage URL without a trailing slash and honours absolute titles and noindex', () => {
    const h = buildMetadata({ path: '/', title: 'Home', description: 'd', absoluteTitle: true, noindex: true });
    expect(h.openGraph).toMatchObject({ url: SITE_URL, title: 'Home' });
    expect(h.title).toEqual({ absolute: 'Home' });
    expect(h.robots).toEqual(NOINDEX.robots);
  });
});

describe('route registry', () => {
  it('has unique public routes that are not disallowed in robots', () => {
    const paths = PUBLIC_ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) expect(PRIVATE_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`))).toBe(false);
  });
});

it('escapes "<" in JSON-LD', () => {
  expect(jsonLdString({ a: '</script>' })).not.toContain('<');
});
