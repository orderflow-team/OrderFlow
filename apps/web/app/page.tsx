import type { Metadata } from 'next';
import { HomeClient } from '@/components/home-client';
import { buildMetadata } from '@/lib/seo';
import { FAQS } from '@/components/landing/faq-data';

const SITE = 'https://obix360.com';

export const metadata: Metadata = buildMetadata({
  path: '/',
  title: 'Billing Software for India: GST, Inventory & POS | OBIX 360',
  absoluteTitle: true,
  description:
    'All-in-one billing software for shops, medical stores, wholesalers and restaurants: GST invoices, inventory, POS and WhatsApp bills. Start free.',
  keywords: ['billing software India', 'GST invoice software', 'shop billing app', 'restaurant billing software'],
});

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
        'All-in-one billing software: GST billing, inventory tracking, order management, WhatsApp invoicing and POS for retail, pharmacy, wholesale and restaurant businesses.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      publisher: { '@id': `${SITE}/#organization` },
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
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
