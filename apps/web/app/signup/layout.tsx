import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up Free',
  description:
    'Create your free OBIX 360 account: GST billing, inventory, orders and WhatsApp invoices for your shop, pharmacy, wholesale or restaurant.',
  alternates: { canonical: 'https://obix360.com/signup' },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
