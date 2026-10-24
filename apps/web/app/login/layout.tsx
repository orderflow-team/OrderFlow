import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  path: '/login',
  title: 'Sign In',
  description: 'Sign in to your OBIX 360 account to manage GST billing, inventory and orders.',
  keywords: ['OBIX 360 login'],
  noindex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
