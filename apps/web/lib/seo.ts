import type { Metadata } from 'next';

export const SITE_URL = 'https://obix360.com';
export const SITE_NAME = 'OBIX 360';
const OG_IMAGE = { url: '/og-image.png', width: 1200, height: 630 };

/** Fallbacks used by the root layout and by any route that doesn't define its own metadata. */
export const DEFAULT_TITLE = 'OBIX 360 - All-in-One Billing Software | Orders, Inventory & POS';
export const DEFAULT_OG_TITLE = 'OBIX 360 – GST Billing, Inventory & Orders in One App';
export const DEFAULT_DESCRIPTION =
  'All-in-one billing software for India: GST invoicing, inventory, orders, POS and WhatsApp invoices for shops, pharmacies, wholesalers and restaurants.';
export const DEFAULT_IMAGE = { ...OG_IMAGE, alt: 'OBIX 360 – all-in-one GST billing, inventory and WhatsApp invoicing software' };
export const DEFAULT_KEYWORDS = [
  'OBIX 360', 'GST billing software', 'inventory management', 'POS billing', 'WhatsApp invoicing', 'order management',
];

/**
 * Next.js shallow-merges metadata, so a page that sets only title/description would inherit the
 * homepage's og:url, og:title and og:description. Every public page goes through this helper so
 * canonical, Open Graph and Twitter always describe that page.
 */
export function buildMetadata(opts: {
  path: string;
  title: string;
  description: string;
  /** Use the title exactly as given instead of "<title> | OBIX 360". */
  absoluteTitle?: boolean;
  imageAlt?: string;
  /** Page-specific keywords; the site-wide ones are appended. */
  keywords?: string[];
  /** Keep the page out of search results (it still gets canonical + social tags). */
  noindex?: boolean;
}): Metadata {
  const fullTitle = opts.absoluteTitle ? opts.title : `${opts.title} | ${SITE_NAME}`;
  const alt = opts.imageAlt ?? `${SITE_NAME} – GST billing, inventory and orders`;
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    keywords: [...new Set([...(opts.keywords ?? []), ...DEFAULT_KEYWORDS])],
    ...(opts.noindex ? NOINDEX : {}),
    alternates: { canonical: opts.path },
    openGraph: {
      type: 'website',
      locale: 'en_IN',
      url: `${SITE_URL}${opts.path === '/' ? '' : opts.path}`,
      siteName: SITE_NAME,
      title: fullTitle,
      description: opts.description,
      images: [{ ...OG_IMAGE, alt }],
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description: opts.description, images: [OG_IMAGE.url] },
  };
}

/** For pages behind login or one-off flows: never indexed, never listed in the sitemap. */
export const NOINDEX: Metadata = { robots: { index: false, follow: false } };

/** Indexable pages. This is the single source for app/sitemap.ts. */
export const PUBLIC_ROUTES: { path: string; lastModified: string }[] = [
  { path: '/', lastModified: '2026-10-13' },
  { path: '/pharmacy-billing-software', lastModified: '2026-10-13' },
  { path: '/pharmacy-management-software', lastModified: '2026-10-13' },
  { path: '/medical-store-software', lastModified: '2026-10-13' },
  { path: '/gst-billing-software-for-chemists', lastModified: '2026-10-13' },
  { path: '/signup', lastModified: '2026-10-24' },
  { path: '/privacy-policy', lastModified: '2026-10-09' },
  { path: '/terms', lastModified: '2026-10-12' },
];

/** Route prefixes that must never be crawled. Each also matches the bare path (no trailing slash). */
export const PRIVATE_PREFIXES = [
  '/admin', '/dashboard', '/api', '/api-proxy', '/billing', '/customers', '/inventory', '/orders',
  '/products', '/reports', '/restaurant', '/salesman', '/settings', '/security', '/staff',
  '/select-business', '/forgot-password', '/google-app-signin',
];

/** Serialises JSON-LD so a "<" in the data can never close the surrounding script tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
