import { NOINDEX } from '@/lib/seo';

export const metadata = { title: 'Reset Password', ...NOINDEX };

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
