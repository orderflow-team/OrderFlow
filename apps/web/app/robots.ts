import type { MetadataRoute } from 'next';
import { PRIVATE_PREFIXES, SITE_URL } from '@/lib/seo';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE_PREFIXES.flatMap((p) => [p, `${p}/`]) }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
