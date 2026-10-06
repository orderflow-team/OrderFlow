import type { Metadata } from 'next';
import { SeoLanding, type SeoLandingContent } from '@/components/seo-landing';

const content: SeoLandingContent = {
  path: '/pharmacy-billing-software',
  eyebrow: 'For chemists & pharmacies',
  h1: 'Pharmacy Billing Software with GST, Batch & Expiry Tracking',
  intro:
    'OBIX 360 helps medical stores bill faster, stay GST-compliant and avoid selling expired stock. Track batches and expiry dates, keep a Schedule H1/X register, and send invoices on WhatsApp.',
  features: [
    { title: 'GST invoicing', body: 'CGST/SGST/IGST split, HSN codes and financial-year invoice numbering, with GSTR reports.' },
    { title: 'Batch & expiry tracking', body: 'Record batch number and expiry per product, and see a dashboard list of batches expiring within 30 days.' },
    { title: 'Schedule H1 / X register', body: 'Maintain the controlled-drug register at the counter, and capture a prescription photo with the sale.' },
    { title: 'Scan supplier invoices', body: 'Photograph a purchase invoice and have items added to inventory instead of typing every line.' },
    { title: 'Supplier returns & purchase orders', body: 'Raise purchase orders, record supplier returns and keep stock accurate.' },
    { title: 'WhatsApp invoices', body: 'Send bills to customers on WhatsApp from the billing screen.' },
  ],
  steps: [
    'Sign up free and choose Pharmacy as your business type.',
    'Add your medicines with HSN code, GST rate, batch and expiry, or scan a supplier invoice.',
    'Bill at the counter on phone, tablet or PC and share the invoice on WhatsApp.',
  ],
  faqs: [
    { q: 'Is OBIX 360 GST compliant for pharmacies?', a: 'Invoices carry the CGST/SGST or IGST split and HSN codes, use financial-year numbering, and you can pull GSTR reports.' },
    { q: 'Can it track medicine expiry dates?', a: 'Yes. You can record batch and expiry for each product, and the dashboard lists batches expiring within 30 days.' },
    { q: 'Does it support Schedule H1 and X drugs?', a: 'Yes. OBIX 360 includes a Schedule H1/X register and lets you attach a prescription photo to a sale.' },
    { q: 'Do I need special hardware?', a: 'No. It runs on your phone, tablet or computer, and there is an Android app on Google Play.' },
    { q: 'How much does it cost?', a: 'There is a free plan to start, with paid plans for larger shops. See the pricing section on the home page.' },
  ],
  related: { href: '/restaurant-billing-software', label: 'Restaurant billing software' },
};

export const metadata: Metadata = {
  title: { absolute: 'Pharmacy Billing Software India – GST, Batch & Expiry | OBIX 360' },
  description:
    'GST pharmacy billing software for Indian chemists: batch and expiry tracking, Schedule H1/X register, supplier invoice scanning and WhatsApp bills. Start free with OBIX 360.',
  alternates: { canonical: `https://obix360.com${content.path}` },
};

export default function Page() {
  return <SeoLanding c={content} />;
}
