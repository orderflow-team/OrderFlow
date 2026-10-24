import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { ObixMark } from '@/components/obix-logo';
import { JsonLd } from '@/components/seo/json-ld';
import { buildMetadata } from '@/lib/seo';

const SITE = 'https://obix360.com';

/** Every pharmacy guide, so each page can link to the others (internal links help search engines and readers). */
export const GUIDES = [
  {
    path: '/pharmacy-billing-software',
    label: 'Pharmacy billing software',
    blurb: 'Batch and expiry, MRP control, GST invoices and the Schedule H1 register.',
  },
  {
    path: '/pharmacy-management-software',
    label: 'Pharmacy management software',
    blurb: 'Stock, suppliers, dues, staff and reports beyond the billing counter.',
  },
  {
    path: '/medical-store-software',
    label: 'Medical store software',
    blurb: 'A plain-language guide to software for small and growing medical stores.',
  },
  {
    path: '/gst-billing-software-for-chemists',
    label: 'GST billing for chemists',
    blurb: 'CGST, SGST and IGST by HSN code, GSTIN checks and GST-ready reports.',
  },
] as const;

export type Block = {
  id: string;
  heading: string;
  paragraphs?: string[];
  bullets?: { title: string; body?: string }[];
  steps?: { title: string; body: string }[];
  note?: string;
};

export type SeoPageConfig = {
  path: string;
  title: string;
  description: string;
  keywords: string[];
  eyebrow: string;
  h1: string;
  intro: string;
  blocks: Block[];
  faqs: { question: string; answer: string }[];
  ctaTitle: string;
  ctaBody: string;
};

export function seoMetadata(c: SeoPageConfig): Metadata {
  return buildMetadata({ path: c.path, title: c.title, description: c.description, absoluteTitle: true, imageAlt: c.h1, keywords: c.keywords });
}

function jsonLdFor(c: SeoPageConfig) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${SITE}${c.path}#webpage`,
        url: `${SITE}${c.path}`,
        name: c.title,
        description: c.description,
        inLanguage: 'en-IN',
        isPartOf: { '@id': `${SITE}/#website` },
        about: { '@type': 'SoftwareApplication', name: 'OBIX 360', url: SITE },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
          { '@type': 'ListItem', position: 2, name: 'Pharmacy billing software', item: `${SITE}/pharmacy-billing-software` },
          { '@type': 'ListItem', position: 3, name: c.h1, item: `${SITE}${c.path}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: c.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
    ],
  };
}

export function SeoPage({ config: c }: { config: SeoPageConfig }) {
  const related = GUIDES.filter((g) => g.path !== c.path);

  return (
    <div className="min-h-screen bg-[#F3F7F5] text-[#0D1B16] antialiased">
      <style>{`
        @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .rise { animation: rise .55s cubic-bezier(.2,.7,.2,1) both; }
        .rise-2 { animation-delay: .1s; }
        @media (prefers-reduced-motion: reduce) { .rise { animation: none; } }
        details > summary::-webkit-details-marker { display: none; }
      `}</style>

      <JsonLd data={jsonLdFor(c)} />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-[#D5E0DB]/80 bg-[#F3F7F5]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Link href="/" className="flex items-center gap-2.5" aria-label="OBIX 360 home">
            <ObixMark className="h-9 w-9" />
            <span className="text-xl font-extrabold tracking-tight">OBIX</span>
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0F7B57] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#0A5C41] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F7B57]"
          >
            Start free <ArrowRight className="h-4 w-4" aria-hidden={true} />
          </Link>
        </div>
      </header>

      <main id="main">
        {/* Hero + contents */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-12 sm:pt-16 lg:grid-cols-[1.4fr_0.6fr] lg:items-start">
          <div className="space-y-5">
            <nav aria-label="Breadcrumb" className="text-sm text-[#5B6F66]">
              <Link href="/" className="hover:text-[#0D1B16]">Home</Link>
              <span aria-hidden="true"> / </span>
              <Link href="/pharmacy-billing-software" className="hover:text-[#0D1B16]">Pharmacy billing software</Link>
            </nav>
            <p className="rise inline-flex rounded-full bg-[#E3F4EC] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0A5C41]">
              {c.eyebrow}
            </p>
            <h1 className="rise rise-2 text-4xl font-extrabold leading-[1.08] tracking-tight text-[#0A3B2C] sm:text-5xl">
              {c.h1}
            </h1>
            <p className="rise rise-2 max-w-2xl text-lg leading-relaxed text-[#40554B]">{c.intro}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-[#0F7B57] px-6 py-3 font-bold text-white transition-colors hover:bg-[#0A5C41] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F7B57]"
              >
                Create a free account <ArrowRight className="h-4 w-4" aria-hidden={true} />
              </Link>
              <Link
                href="/pharmacy-billing-software"
                className="inline-flex items-center rounded-full px-5 py-3 font-semibold text-[#0A3B2C] ring-1 ring-[#B5C9C0] transition-colors hover:bg-white"
              >
                See the pharmacy features
              </Link>
            </div>
          </div>

          <aside className="rounded-2xl bg-white p-5 ring-1 ring-[#D5E0DB]" aria-label="On this page">
            <p className="text-xs font-bold uppercase tracking-wider text-[#5B6F66]">On this page</p>
            <ul className="mt-3 space-y-2 text-sm font-semibold">
              {c.blocks.map((b) => (
                <li key={b.id}>
                  <a href={`#${b.id}`} className="text-[#0A3B2C] hover:text-[#0F7B57] hover:underline">
                    {b.heading}
                  </a>
                </li>
              ))}
              <li>
                <a href="#faq" className="text-[#0A3B2C] hover:text-[#0F7B57] hover:underline">Questions</a>
              </li>
            </ul>
          </aside>
        </section>

        {/* Content blocks */}
        <div className="mx-auto max-w-3xl space-y-14 px-4 pb-16">
          {c.blocks.map((b) => (
            <section key={b.id} id={b.id} className="scroll-mt-24 space-y-4">
              <h2 className="text-2xl font-extrabold tracking-tight text-[#0D1B16] sm:text-3xl">{b.heading}</h2>
              {b.paragraphs?.map((p) => (
                <p key={p} className="text-base leading-relaxed text-[#40554B] sm:text-lg">{p}</p>
              ))}
              {b.bullets && (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {b.bullets.map((x) => (
                    <li key={x.title} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-[#D5E0DB]">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0F7B57] text-white">
                        <Check className="h-3.5 w-3.5" aria-hidden={true} />
                      </span>
                      <div>
                        <h3 className="font-bold">{x.title}</h3>
                        {x.body && <p className="mt-1 text-sm leading-relaxed text-[#40554B]">{x.body}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {b.steps && (
                <ol className="space-y-3">
                  {b.steps.map((s, i) => (
                    <li key={s.title} className="flex gap-4 rounded-2xl bg-white p-4 ring-1 ring-[#D5E0DB]">
                      <span className="font-mono text-sm font-bold text-[#0F7B57]">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <h3 className="font-bold">{s.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-[#40554B]">{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {b.note && (
                <p className="rounded-xl bg-[#FEF3C7] px-4 py-3 text-sm leading-relaxed text-[#92400E] ring-1 ring-[#FCD9A1]">
                  {b.note}
                </p>
              )}
            </section>
          ))}
        </div>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 border-y border-[#D5E0DB] bg-white py-16">
          <div className="mx-auto max-w-3xl space-y-6 px-4">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Questions and answers</h2>
            <div className="space-y-3">
              {c.faqs.map((f) => (
                <details key={f.question} className="group rounded-2xl bg-[#F3F7F5] p-5 ring-1 ring-[#E1EAE5] open:bg-white open:ring-[#B5C9C0]">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-bold">
                    {f.question}
                    <span className="mt-0.5 text-xl leading-none text-[#0F7B57] transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-[#40554B] sm:text-base">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Related guides */}
        <section className="mx-auto max-w-6xl space-y-6 px-4 py-16">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">More for medical stores</h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {related.map((g) => (
              <li key={g.path}>
                <Link
                  href={g.path}
                  className="group block h-full rounded-2xl bg-white p-5 ring-1 ring-[#D5E0DB] transition-shadow hover:shadow-[0_14px_30px_-18px_rgba(10,59,44,0.6)]"
                >
                  <h3 className="font-bold text-[#0A3B2C] group-hover:text-[#0F7B57]">{g.label}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#40554B]">{g.blurb}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#0F7B57]">
                    Read more <ArrowRight className="h-4 w-4" aria-hidden={true} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="bg-[#0A3B2C] py-16">
          <div className="mx-auto max-w-3xl space-y-5 px-4 text-center">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white">{c.ctaTitle}</h2>
            <p className="text-lg text-[#C9E6DA]">{c.ctaBody}</p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-[#7BE0B5] px-8 py-4 text-base font-bold text-[#0A3B2C] transition-colors hover:bg-[#98EBC7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Create a free account <ArrowRight className="h-4 w-4" aria-hidden={true} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-[#07281E] py-8 text-center text-sm text-[#9DBBAE]">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2" aria-label="Footer">
          <Link href="/" className="hover:text-white">Home</Link>
          {GUIDES.map((g) => (
            <Link key={g.path} href={g.path} className="hover:text-white">{g.label}</Link>
          ))}
          <Link href="/privacy-policy" className="hover:text-white">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white">Terms of Service</Link>
        </nav>
        <p className="mt-4">© OBIX 360 · support@obix360.com</p>
      </footer>
    </div>
  );
}
