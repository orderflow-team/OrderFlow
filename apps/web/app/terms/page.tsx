import { buildMetadata } from '@/lib/seo';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ObixMark } from '@/components/obix-logo';

export const metadata = buildMetadata({
  path: '/terms',
  title: 'Terms of Service',
  description: 'Terms of Service for OBIX 360, the all-in-one billing, inventory and order management app.',
});

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. Acceptance of terms',
    body: [
      'By creating an account or using OBIX 360 (the "Service") through our website or mobile app, you agree to these Terms of Service. If you use the Service on behalf of a business, you confirm you are authorised to bind that business.',
    ],
  },
  {
    title: '2. Your account',
    body: [
      'You are responsible for keeping your login details confidential and for all activity under your account, including activity by staff you invite. Tell us promptly if you suspect unauthorised access.',
      'Give accurate information when you sign up, including your business details and GSTIN where applicable.',
    ],
  },
  {
    title: '3. Your data',
    body: [
      'You own the business data you enter into OBIX 360, including products, customers, orders and invoices. You allow us to store and process it only to provide the Service. See our Privacy Policy for how we handle data and how to request deletion.',
      'You are responsible for the accuracy of invoices, tax details and compliance records you generate, and for meeting the legal obligations of your business.',
    ],
  },
  {
    title: '4. Acceptable use',
    body: [
      "Do not misuse the Service: no attempts to break its security, access other businesses' data, send spam or unlawful content, or interfere with its operation.",
    ],
  },
  {
    title: '5. Plans and fees',
    body: [
      'Some features are free and some need a paid plan. Current plans and prices are shown in the pricing section of our home page. We will give notice before changing the price of a plan you already use.',
    ],
  },
  {
    title: '6. Availability and changes',
    body: [
      'We work to keep the Service available but do not guarantee uninterrupted access. We may update, add or remove features, and will aim to give notice of significant changes.',
    ],
  },
  {
    title: '7. Liability',
    body: [
      'The Service is provided "as is". To the extent permitted by law, OBIX 360 is not liable for indirect or consequential losses, or for losses caused by your misuse of the Service or inaccurate data you entered.',
    ],
  },
  {
    title: '8. Ending your use',
    body: [
      'You can stop using the Service and request deletion of your account at any time. We may suspend accounts that breach these terms.',
    ],
  },
  {
    title: '9. Contact',
    body: ['Questions about these terms? Email support@obix360.com.'],
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <ObixMark className="w-9 h-9" />
            <span className="font-extrabold text-xl tracking-tight text-slate-900">OBIX</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Terms of Service
          </h1>
          <p className="text-sm text-slate-500">Last updated: October 12, 2026</p>
        </div>

        <div className="rounded-3xl bg-white ring-1 ring-slate-200 p-6 sm:p-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title} className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p} className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  {p}
                </p>
              ))}
            </section>
          ))}
          <p className="text-sm text-slate-500">
            See also our{' '}
            <Link href="/privacy-policy" className="text-sky-600 underline font-semibold">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
