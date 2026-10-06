import Link from 'next/link';
import { Check } from 'lucide-react';
import { ObixMark } from '@/components/obix-logo';

export interface SeoLandingContent {
  path: string;
  eyebrow: string;
  h1: string;
  intro: string;
  features: { title: string; body: string }[];
  steps: string[];
  faqs: { q: string; a: string }[];
  related: { href: string; label: string };
}

const SITE = 'https://obix360.com';

export function SeoLanding({ c }: { c: SeoLandingContent }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${SITE}${c.path}#webpage`,
        url: `${SITE}${c.path}`,
        name: c.h1,
        isPartOf: { '@id': `${SITE}/#website` },
        inLanguage: 'en-IN',
      },
      {
        '@type': 'FAQPage',
        mainEntity: c.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'OBIX 360', item: SITE },
          { '@type': 'ListItem', position: 2, name: c.h1, item: `${SITE}${c.path}` },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <script
        type="application/ld+json"
        // Static, server-built JSON; escape "<" so it can't close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <ObixMark className="w-9 h-9" />
            <span className="font-extrabold text-xl tracking-tight text-slate-900">OBIX 360</span>
          </Link>
          <Link href="/signup" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Start free
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 sm:py-16 space-y-16">
        <section className="space-y-5">
          <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">{c.eyebrow}</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950 leading-[1.1]">{c.h1}</h1>
          <p className="text-lg text-slate-600 max-w-2xl">{c.intro}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/signup" className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700">
              Create free account
            </Link>
            <Link href="/" className="rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-100">
              See all OBIX 360 features
            </Link>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">Features built for your counter</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {c.features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">Get started in minutes</h2>
          <ol className="space-y-3">
            {c.steps.map((s) => (
              <li key={s} className="flex gap-3 text-slate-700">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">Frequently asked questions</h2>
          <div className="space-y-4">
            {c.faqs.map((f) => (
              <div key={f.q} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-bold text-slate-900">{f.q}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-slate-900 p-8 sm:p-10 text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Try OBIX 360 free</h2>
          <p className="text-slate-300">No special hardware needed. Works on a phone, tablet or PC.</p>
          <Link href="/signup" className="inline-block rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-400">
            Sign up free
          </Link>
          <p className="text-sm text-slate-400">
            Also see: <Link href={c.related.href} className="underline hover:text-white">{c.related.label}</Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        OBIX 360 ·{' '}
        <Link href="/privacy-policy" className="hover:text-slate-800">Privacy Policy</Link>
      </footer>
    </div>
  );
}
