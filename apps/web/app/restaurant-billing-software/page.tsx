import type { Metadata } from 'next';
import { SeoLanding, type SeoLandingContent } from '@/components/seo-landing';

const content: SeoLandingContent = {
  path: '/restaurant-billing-software',
  eyebrow: 'For restaurants, cafés & takeaways',
  h1: 'Restaurant Billing Software with Table Orders, KOT & GST',
  intro:
    'OBIX 360 runs your floor from one app: take table and takeaway orders, send KOTs to the kitchen display, and print GST bills. Give waiters, cashiers and cooks their own logins.',
  features: [
    { title: 'Table & takeaway orders', body: 'Open orders against tables or take quick takeaway orders from the same screen.' },
    { title: 'Kitchen display (KOT)', body: 'Orders reach the kitchen as KOTs on a kitchen display, so cooks see what to make without paper slips.' },
    { title: 'Role-based staff logins', body: 'Separate access for admin, manager, waiter, cashier and kitchen staff.' },
    { title: 'GST invoices', body: 'Generate GST bills with the tax split, and review sales in reports.' },
    { title: 'Inventory & purchases', body: 'Track ingredients and supplies, raise purchase orders and watch stock levels on the dashboard.' },
    { title: 'WhatsApp bills', body: 'Send the bill to the customer on WhatsApp instead of printing.' },
  ],
  steps: [
    'Sign up free and choose Restaurant as your business type.',
    'Add your menu items and tables, then invite waiters, cashiers and kitchen staff.',
    'Take orders, send KOTs to the kitchen and settle the bill with a GST invoice.',
  ],
  faqs: [
    { q: 'Does OBIX 360 support KOT and a kitchen display?', a: 'Yes. Orders are sent to the kitchen as KOTs that appear on the kitchen display page.' },
    { q: 'Can I manage dine-in and takeaway together?', a: 'Yes. Table orders and takeaway orders are both handled in the Orders section.' },
    { q: 'Can my staff have separate logins?', a: 'Yes. Admins and managers can create waiter, cashier and kitchen staff accounts with role-based access.' },
    { q: 'Is the billing GST compliant?', a: 'Invoices include the GST split, and you can view sales in reports.' },
    { q: 'Do I need a POS terminal?', a: 'No special hardware is required. It works on a phone, tablet or computer.' },
  ],
  related: { href: '/pharmacy-billing-software', label: 'Pharmacy billing software' },
};

export const metadata: Metadata = {
  title: { absolute: 'Restaurant Billing Software India – KOT, Tables & GST | OBIX 360' },
  description:
    'Restaurant billing software for India: table and takeaway orders, KOT kitchen display, staff roles and GST invoices. No special hardware. Start free with OBIX 360.',
  alternates: { canonical: `https://obix360.com${content.path}` },
};

export default function Page() {
  return <SeoLanding c={content} />;
}
