import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  path: '/signup',
  title: 'Sign Up Free',
  keywords: ['OBIX 360 sign up', 'free billing software account', 'create GST billing account'],
  description:
    'Create your free OBIX 360 account: GST billing, inventory, orders and WhatsApp invoices for your shop, pharmacy, wholesale or restaurant.',
});

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
