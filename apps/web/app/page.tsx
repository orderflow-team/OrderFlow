import type { Metadata } from 'next';
import { HomeClient } from '@/components/home-client';

const SITE = 'https://obix360.com';

export const metadata: Metadata = {
  title: {
    absolute: 'OBIX 360 – Billing, Inventory & Order Management Software for Indian Businesses',
  },
  description:
    'OBIX 360 is all-in-one billing software with GST invoicing, inventory tracking, order management, WhatsApp invoices and POS for retailers, pharmacies, wholesalers and restaurants in India. Start free.',
  alternates: { canonical: SITE },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE}/#organization`,
      name: 'OBIX 360',
      alternateName: ['OBIX', 'obix360'],
      url: SITE,
      logo: `${SITE}/icon-512.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      url: SITE,
      name: 'OBIX 360',
      publisher: { '@id': `${SITE}/#organization` },
      inLanguage: 'en-IN',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'OBIX 360',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, Android',
      url: SITE,
      description:
        'Order management, GST billing, inventory tracking, WhatsApp invoicing and POS for retail, pharmacy, wholesale and restaurant businesses.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      publisher: { '@id': `${SITE}/#organization` },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static, server-built JSON; escape "<" so it can't close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\u003c') }}
      />
      <HomeClient />
    </>
  );
}
