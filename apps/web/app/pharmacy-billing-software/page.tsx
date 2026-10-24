import { JsonLd } from '@/components/seo/json-ld';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Layers,
  MessageCircle,
  Minus,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Tag,
  Users,
} from 'lucide-react';
import { ObixMark } from '@/components/obix-logo';

const SITE = 'https://obix360.com';
const PATH = '/pharmacy-billing-software';
const TITLE = 'Pharmacy Billing Software for Medical Stores in India | OBIX 360';
const DESCRIPTION =
  'GST billing software for medical stores and chemists: batch and expiry tracking, MRP control, Schedule H1 register and WhatsApp bills. Start free.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: 'website',
    url: `${SITE}${PATH}`,
    siteName: 'OBIX 360',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'OBIX 360 pharmacy billing software' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og-image.png'] },
};

/* ---------- Content ---------- */

const PROBLEMS = [
  {
    problem: 'Stock expires on the shelf before anyone notices.',
    answer:
      'OBIX 360 tracks the batch and expiry of every medicine, lists batches expiring within 30 days, and sends expiry reminders so you can return or sell them in time.',
  },
  {
    problem: 'A customer says you charged above MRP.',
    answer:
      'Enter the MRP once. When it is set, the selling price is capped at it, including prices changed at the billing counter.',
  },
  {
    problem: 'The Schedule H1 register is a notebook that gets filled late.',
    answer:
      'Mark Schedule H1 and X medicines, record each sale in the app register, and attach a photo of the prescription to the bill.',
  },
  {
    problem: 'Typing a long distributor bill into the system takes an hour.',
    answer:
      'Photograph the purchase invoice. The items are read into your stock for you to review and confirm.',
  },
];

const CHECKLIST = [
  ['Batch and expiry on every product', 'You should see what expires soon without opening a register.'],
  ['MRP control at the counter', 'The selling price should not be able to go above the printed MRP.'],
  ['GST invoices with HSN codes', 'CGST, SGST and IGST split by item, with the customer GSTIN checked on B2B bills.'],
  ['A Schedule H1 and X register', 'Entries and prescription photos kept in one place, not scattered across notebooks.'],
  ['Fast purchase entry', 'Distributor bills should not need to be retyped line by line.'],
  ['Supplier returns on record', 'Expired and damaged stock goes back with a trail you can show.'],
  ['Works on the phone you already own', 'Billing and stock checks from an Android phone or a computer browser.'],
  ['Separate logins for staff', 'Your assistant can bill without seeing everything the owner sees.'],
];

const COMPARE: [string, string, string][] = [
  ['Expiry checks', 'Walk the shelves or scan a sheet', 'Batch list with a 30-day expiry view and reminders'],
  ['MRP control', 'Relies on whoever is billing', 'Price capped at MRP when it is set'],
  ['GST invoice', 'Formulas you maintain yourself', 'CGST, SGST and IGST split by HSN code'],
  ['Schedule H1 register', 'Handwritten notebook', 'In-app register with prescription photo'],
  ['Distributor bills', 'Typed in by hand', 'Photograph the bill and confirm the items'],
  ['Where you can use it', 'One computer', 'Android phone and web browser'],
  ['Sending a bill', 'Print or screenshot', 'Send the invoice on WhatsApp (Store Pro plan)'],
];

const FAQS = [
  {
    question: 'Is OBIX 360 good billing software for a medical store?',
    answer:
      'Yes. OBIX 360 is built for medical stores and chemists among other shops. It tracks batch numbers and expiry dates, caps the selling price at MRP, prints GST invoices with HSN codes, and keeps a Schedule H1/X register.',
  },
  {
    question: 'Does it track batches and expiry dates?',
    answer:
      'Yes. You record the batch number and expiry for each product. Sales use the batch that expires first, you can see batches expiring within 30 days, and you can look up which orders received a given batch.',
  },
  {
    question: 'Can it keep a Schedule H1 register and prescription photos?',
    answer:
      'Yes. You can mark Schedule H1 and X medicines, keep the register in the app, and attach a prescription photo to a sale. The pharmacist remains responsible for the accuracy of the entries and for meeting legal requirements.',
  },
  {
    question: 'Does it handle GST for medicines?',
    answer:
      'Yes. It splits CGST, SGST and IGST by HSN code, supports B2B invoices with GSTIN checks, numbers invoices by financial year, and gives GST-ready monthly reports.',
  },
  {
    question: 'How does the MRP control work?',
    answer:
      'You enter the MRP for a medicine. After that, the selling price is capped at the MRP, including when someone changes the price while billing. Medicines without an MRP set are not capped.',
  },
  {
    question: 'Can I enter my distributor bills quickly?',
    answer:
      'Yes. Photograph the purchase invoice and OBIX 360 reads the items into your stock for you to review and confirm, so you do not have to type each line.',
  },
  {
    question: 'Can I return expired medicines to the supplier?',
    answer:
      'Yes. Record a supplier return for expired or damaged stock so there is a clear record of what went back and when.',
  },
  {
    question: 'Can my staff use it without seeing everything?',
    answer:
      'Yes. You can add staff logins with separate roles, so a counter assistant can bill without access to the owner-level settings.',
  },
  {
    question: 'Does it work on a phone?',
    answer:
      'Yes. OBIX 360 runs on Android and in a web browser, so you can bill and check stock from your phone or a computer.',
  },
  {
    question: 'How much does it cost to try?',
    answer:
      'You can start free. Some features, such as WhatsApp bill delivery, need a paid plan. See the pricing section on the home page for current plans.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${SITE}${PATH}#webpage`,
      url: `${SITE}${PATH}`,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: 'en-IN',
      isPartOf: { '@id': `${SITE}/#website` },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'OBIX 360 for pharmacies',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Pharmacy billing and inventory software',
      operatingSystem: 'Web, Android',
      url: `${SITE}${PATH}`,
      description: DESCRIPTION,
      featureList: [
        'Batch and expiry tracking',
        'MRP price cap',
        'GST invoices with HSN codes',
        'Schedule H1 and X register with prescription photos',
        'Distributor bill scan',
        'Supplier returns',
        'WhatsApp invoices',
      ],
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      publisher: { '@id': `${SITE}/#organization` },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
        { '@type': 'ListItem', position: 2, name: 'Pharmacy billing software', item: `${SITE}${PATH}` },
      ],
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

/* ---------- Small pieces ---------- */

/** A rack-label chip: the monospace tag a chemist writes on a shelf edge. */
function Label({
  children,
  tone = 'plain',
}: {
  children: React.ReactNode;
  tone?: 'plain' | 'ok' | 'warn' | 'alarm';
}) {
  const tones = {
    plain: 'bg-white text-[#0D1B16] ring-[#D5E0DB]',
    ok: 'bg-[#E3F4EC] text-[#0A5C41] ring-[#B5E0CD]',
    warn: 'bg-[#FEF3C7] text-[#92400E] ring-[#FCD9A1]',
    alarm: 'bg-[#FEE4E2] text-[#B42318] ring-[#FBC1BC]',
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold tracking-tight ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function SampleNote() {
  return <p className="mt-3 text-xs text-[#5B6F66]">Sample data, for illustration.</p>;
}

/** The hero's signature: a counter bill with batch, expiry and MRP on every line. */
function CounterBill() {
  return (
    <div
      className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_24px_60px_-20px_rgba(10,59,44,0.45)] ring-1 ring-[#D5E0DB] sm:p-6"
      aria-label="Sample counter bill"
      role="img"
    >
      <div className="flex items-center justify-between border-b border-dashed border-[#D5E0DB] pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#5B6F66]">Counter bill</p>
          <p className="font-mono text-sm font-bold text-[#0D1B16]">INV/26-27/00418</p>
        </div>
        <Label tone="ok">GST invoice</Label>
      </div>

      <ul className="divide-y divide-[#EEF3F0] text-sm">
        {[
          { name: 'Paracetamol 650 mg', meta: 'B2417', exp: '03/27', mrp: '30.91', tone: 'ok' as const, state: 'OK' },
          { name: 'Cetirizine 10 mg', meta: 'C0932', exp: '11/26', mrp: '24.50', tone: 'warn' as const, state: '18 days left' },
          { name: 'Pantoprazole 40 mg', meta: 'P5521', exp: '05/27', mrp: '98.00', tone: 'ok' as const, state: 'OK' },
        ].map((row) => (
          <li key={row.name} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-[#0D1B16]">{row.name}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Label>Batch {row.meta}</Label>
                <Label>Exp {row.exp}</Label>
                <Label>MRP ₹{row.mrp}</Label>
              </div>
            </div>
            <Label tone={row.tone}>{row.state}</Label>
          </li>
        ))}
      </ul>

      <dl className="mt-1 space-y-1 border-t border-dashed border-[#D5E0DB] pt-3 font-mono text-xs text-[#40554B]">
        <div className="flex justify-between"><dt>CGST 6%</dt><dd>₹8.22</dd></div>
        <div className="flex justify-between"><dt>SGST 6%</dt><dd>₹8.22</dd></div>
        <div className="flex justify-between text-sm font-bold text-[#0D1B16]"><dt>Total</dt><dd>₹153.41</dd></div>
      </dl>
      <p className="mt-3 text-[11px] text-[#5B6F66]">Sample data, for illustration.</p>
    </div>
  );
}

function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0F7B57]">{eyebrow}</p>
      <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-[#0D1B16] sm:text-4xl">{title}</h2>
      {intro && <p className="text-base leading-relaxed text-[#40554B] sm:text-lg">{intro}</p>}
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  children,
  visual,
  flip = false,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  children: React.ReactNode;
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <article className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
      <div className={`min-w-0 space-y-4 ${flip ? 'md:order-2' : ''}`}>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A3B2C] text-[#7BE0B5]">
          <Icon className="h-5 w-5" aria-hidden={true} />
        </span>
        <h3 className="text-2xl font-extrabold tracking-tight text-[#0D1B16]">{title}</h3>
        <div className="space-y-3 text-base leading-relaxed text-[#40554B]">{children}</div>
      </div>
      <div className={`min-w-0 ${flip ? 'md:order-1' : ''}`}>{visual}</div>
    </article>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_18px_40px_-24px_rgba(10,59,44,0.5)] ring-1 ring-[#D5E0DB] sm:p-6">
      {children}
    </div>
  );
}

/* ---------- Page ---------- */

export default function PharmacyBillingSoftwarePage() {
  return (
    <div className="min-h-screen bg-[#F3F7F5] text-[#0D1B16] antialiased">
      <style>{`
        @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .rise { animation: rise .6s cubic-bezier(.2,.7,.2,1) both; }
        .rise-2 { animation-delay: .12s; }
        .rise-3 { animation-delay: .24s; }
        @media (prefers-reduced-motion: reduce) { .rise { animation: none; } }
        details > summary::-webkit-details-marker { display: none; }
      `}</style>

      <JsonLd data={jsonLd} />

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
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#40554B] md:flex" aria-label="Page sections">
            <a href="#features" className="hover:text-[#0D1B16]">Features</a>
            <a href="#checklist" className="hover:text-[#0D1B16]">What to look for</a>
            <a href="#compare" className="hover:text-[#0D1B16]">Compare</a>
            <a href="#faq" className="hover:text-[#0D1B16]">FAQ</a>
          </nav>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0F7B57] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#0A5C41] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F7B57]"
          >
            Start free <ArrowRight className="h-4 w-4" aria-hidden={true} />
          </Link>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24">
          <div className="space-y-6">
            <p className="rise inline-flex items-center gap-2 rounded-full bg-[#E3F4EC] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0A5C41]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0F7B57]" aria-hidden="true" />
              For chemists and medical stores
            </p>
            <h1 className="rise rise-2 text-4xl font-extrabold leading-[1.05] tracking-tight text-[#0A3B2C] sm:text-5xl lg:text-[3.4rem]">
              Pharmacy billing software for medical stores in India
            </h1>
            <p className="rise rise-3 max-w-xl text-lg leading-relaxed text-[#40554B]">
              Bill with GST, see which batches are about to expire, keep every price within MRP and send the
              bill on WhatsApp. One app on your phone or computer, built around how a medical store counter works.
            </p>
            <div className="rise rise-3 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-full bg-[#0F7B57] px-7 py-3.5 text-base font-bold text-white shadow-[0_12px_28px_-12px_rgba(15,123,87,0.8)] transition-colors hover:bg-[#0A5C41] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F7B57]"
              >
                Create a free account <ArrowRight className="h-4 w-4" aria-hidden={true} />
              </Link>
              <Link
                href="/#pricing"
                className="inline-flex items-center rounded-full px-5 py-3.5 text-base font-semibold text-[#0A3B2C] ring-1 ring-[#B5C9C0] transition-colors hover:bg-white"
              >
                See pricing
              </Link>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm font-medium text-[#40554B]">
              {['Android and web', 'GST invoices with HSN', 'Schedule H1 register'].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-[#0F7B57]" aria-hidden={true} /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rise rise-3 flex justify-center lg:justify-end">
            <CounterBill />
          </div>
        </section>

        {/* Problems */}
        <section className="bg-[#0A3B2C] py-16 text-white sm:py-20">
          <div className="mx-auto max-w-6xl space-y-10 px-4">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7BE0B5]">The counter, every day</p>
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                Four problems every medical store owner knows
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {PROBLEMS.map((p) => (
                <article key={p.problem} className="rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/15">
                  <h3 className="text-lg font-bold leading-snug">{p.problem}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#C9E6DA] sm:text-base">{p.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl space-y-20 px-4 py-16 sm:py-24">
          <SectionHeading
            eyebrow="What you get"
            title="Everything a medical store needs, in one place"
            intro="Billing, stock, expiry and compliance records live in the same app, so nothing has to be copied from one notebook to another."
          />

          <FeatureRow
            icon={Layers}
            title="Batch and expiry tracking that you can actually see"
            visual={
              <Panel>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#5B6F66]">Expiring soon</p>
                <ul className="divide-y divide-[#EEF3F0] text-sm">
                  {[
                    ['Cetirizine 10 mg', 'C0932', '18 days', 'warn' as const],
                    ['Azithromycin 500 mg', 'Z1180', '24 days', 'warn' as const],
                    ['Amoxicillin 500 mg', 'A7710', 'Expired', 'alarm' as const],
                    ['Paracetamol 650 mg', 'B2417', '5 months', 'ok' as const],
                  ].map(([name, batch, left, tone]) => (
                    <li key={name} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block font-semibold">{name}</span>
                        <span className="font-mono text-xs text-[#5B6F66]">Batch {batch}</span>
                      </span>
                      <Label tone={tone as 'ok' | 'warn' | 'alarm'}>{left}</Label>
                    </li>
                  ))}
                </ul>
                <SampleNote />
              </Panel>
            }
          >
            <p>
              Record the batch number and expiry date when stock comes in. Each sale takes stock from the batch that
              expires first, so older stock moves before it goes out of date.
            </p>
            <p>
              See every batch expiring within 30 days and get reminders. If a batch is ever recalled, look up which
              orders received it.
            </p>
          </FeatureRow>

          <FeatureRow
            flip
            icon={Tag}
            title="MRP control and GST invoices without the spreadsheet"
            visual={
              <Panel>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#5B6F66]">Price check at billing</p>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-[#F3F7F5] px-3 py-2.5">
                    <span className="font-semibold">Price entered</span>
                    <span className="font-mono">₹35.00</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[#F3F7F5] px-3 py-2.5">
                    <span className="font-semibold">MRP on the strip</span>
                    <span className="font-mono">₹30.91</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[#E3F4EC] px-3 py-2.5 text-[#0A5C41]">
                    <span className="font-bold">Billed at</span>
                    <span className="font-mono font-bold">₹30.91</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Label>HSN 3004</Label>
                  <Label>CGST 6%</Label>
                  <Label>SGST 6%</Label>
                  <Label>FY invoice number</Label>
                </div>
                <SampleNote />
              </Panel>
            }
          >
            <p>
              Enter the MRP once for each medicine. When it is set, the selling price is capped at it, even if someone
              changes the price at the counter.
            </p>
            <p>
              Bills split CGST, SGST and IGST by HSN code, are numbered by financial year, and check the customer GSTIN
              on B2B invoices. Monthly GST-ready reports are there when your accountant asks.
            </p>
          </FeatureRow>

          <FeatureRow
            icon={ShieldCheck}
            title="A Schedule H1 and X register that fills itself in"
            visual={
              <Panel>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#5B6F66]">Schedule H1 register</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[22rem] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wider text-[#5B6F66]">
                      <tr>
                        <th className="pb-2 pr-3 font-bold">Date</th>
                        <th className="pb-2 pr-3 font-bold">Medicine</th>
                        <th className="pb-2 pr-3 font-bold">Qty</th>
                        <th className="pb-2 font-bold">Rx photo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF3F0]">
                      <tr><td className="py-2.5 pr-3 font-mono">12 Oct</td><td className="pr-3 font-semibold">Azithromycin 500 mg</td><td className="pr-3 font-mono">6</td><td><Label tone="ok">Attached</Label></td></tr>
                      <tr><td className="py-2.5 pr-3 font-mono">12 Oct</td><td className="pr-3 font-semibold">Levofloxacin 500 mg</td><td className="pr-3 font-mono">5</td><td><Label tone="ok">Attached</Label></td></tr>
                    </tbody>
                  </table>
                </div>
                <SampleNote />
              </Panel>
            }
          >
            <p>
              Mark Schedule H1 and X medicines once. When one is sold, the sale goes into the register and you can attach a
              photo of the prescription to the bill.
            </p>
            <p>
              The app keeps the records in one place. You stay responsible for the accuracy of the entries and for meeting
              the legal requirements for your licence.
            </p>
          </FeatureRow>

          <FeatureRow
            flip
            icon={ScanLine}
            title="Scan distributor bills and return expired stock"
            visual={
              <Panel>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#5B6F66]">Purchase bill, read from a photo</p>
                <ul className="divide-y divide-[#EEF3F0] text-sm">
                  {[
                    ['Paracetamol 650 mg', 'x 20 strips'],
                    ['Cetirizine 10 mg', 'x 15 strips'],
                    ['Pantoprazole 40 mg', 'x 12 strips'],
                  ].map(([n, q]) => (
                    <li key={n} className="flex items-center justify-between py-2.5">
                      <span className="font-semibold">{n}</span>
                      <span className="font-mono text-[#40554B]">{q}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <Label tone="ok">Review</Label>
                  <Label tone="ok">Confirm into stock</Label>
                </div>
                <SampleNote />
              </Panel>
            }
          >
            <p>
              Photograph the purchase invoice and the items are read into your stock. You review them and confirm, so a long
              bill does not mean an hour of typing.
            </p>
            <p>
              When stock expires or arrives damaged, record a supplier return so there is a clear trail of what went back and
              when.
            </p>
          </FeatureRow>

          <FeatureRow
            icon={MessageCircle}
            title="Send the bill on WhatsApp"
            visual={
              <Panel>
                <div className="space-y-2 text-sm">
                  <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-[#DCF8C6] px-3.5 py-2.5 text-[#0D1B16]">
                    Invoice INV/26-27/00418 · ₹153.41
                    <span className="mt-1 block font-mono text-xs text-[#40554B]">Thank you. Visit again.</span>
                  </div>
                </div>
                <SampleNote />
              </Panel>
            }
          >
            <p>
              On the Store Pro plan, send an invoice straight from the billing screen. Your customer gets the bill on their
              phone and you print less paper.
            </p>
          </FeatureRow>
        </section>

        {/* Checklist */}
        <section id="checklist" className="border-y border-[#D5E0DB] bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-6xl space-y-10 px-4">
            <SectionHeading
              eyebrow="Before you choose"
              title="What to look for in medical store billing software"
              intro="Whichever software you pick, check it against this list. A tool that misses expiry or MRP control will cost you stock and customers."
            />
            <ul className="grid gap-4 sm:grid-cols-2">
              {CHECKLIST.map(([t, d]) => (
                <li key={t} className="flex gap-3 rounded-2xl bg-[#F3F7F5] p-5 ring-1 ring-[#E1EAE5]">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0F7B57] text-white">
                    <Check className="h-3.5 w-3.5" aria-hidden={true} />
                  </span>
                  <div>
                    <h3 className="font-bold">{t}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#40554B]">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Compare */}
        <section id="compare" className="mx-auto max-w-6xl space-y-10 px-4 py-16 sm:py-24">
          <SectionHeading
            eyebrow="Paper and Excel vs OBIX 360"
            title="What changes when you move off the register"
          />
          <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-[#D5E0DB]">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <caption className="sr-only">Comparison of a paper register or Excel sheet with OBIX 360</caption>
              <thead className="bg-[#0A3B2C] text-white">
                <tr>
                  <th scope="col" className="px-4 py-3.5 font-bold" />
                  <th scope="col" className="px-4 py-3.5 font-bold">Paper register or Excel</th>
                  <th scope="col" className="px-4 py-3.5 font-bold">OBIX 360</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF3F0]">
                {COMPARE.map(([k, a, b]) => (
                  <tr key={k}>
                    <th scope="row" className="px-4 py-3.5 font-bold">{k}</th>
                    <td className="px-4 py-3.5 text-[#5B6F66]">
                      <span className="inline-flex items-start gap-2"><Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden={true} />{a}</span>
                    </td>
                    <td className="bg-[#F3FBF7] px-4 py-3.5 font-medium text-[#0A5C41]">
                      <span className="inline-flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden={true} />{b}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Who it's for */}
        <section className="bg-[#E3F4EC] py-16 sm:py-20">
          <div className="mx-auto max-w-6xl space-y-10 px-4">
            <SectionHeading eyebrow="Who uses it" title="Made for the way medical stores run" />
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: Smartphone, t: 'The owner at the counter', d: 'Bill and check stock from your phone while you serve customers.' },
                { icon: Users, t: 'Stores with staff', d: 'Give each assistant a login with the access they need and no more.' },
                { icon: Layers, t: 'Wholesale and retail together', d: 'Handle retail counter sales and wholesale orders in the same app.' },
              ].map(({ icon: Icon, t, d }) => (
                <article key={t} className="rounded-2xl bg-white p-6 ring-1 ring-[#B5E0CD]">
                  <Icon className="h-6 w-6 text-[#0F7B57]" aria-hidden={true} />
                  <h3 className="mt-3 text-lg font-bold">{t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#40554B]">{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="mx-auto max-w-6xl space-y-10 px-4 py-16 sm:py-24">
          <SectionHeading eyebrow="Getting started" title="Set up your store in three steps" />
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              ['Create your free account', 'Sign up and choose pharmacy as your business type. It takes a few minutes.'],
              ['Add your medicines', 'Upload your list with a CSV or Excel file, or add items one by one with batch, expiry, MRP and HSN code.'],
              ['Start billing', 'Bill at the counter, send the invoice on WhatsApp, and watch stock and expiry update.'],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl bg-white p-6 ring-1 ring-[#D5E0DB]">
                <span className="font-mono text-sm font-bold text-[#0F7B57]">Step {i + 1}</span>
                <h3 className="mt-2 text-lg font-bold">{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#40554B]">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-[#D5E0DB] bg-white py-16 sm:py-24">
          <div className="mx-auto max-w-3xl space-y-8 px-4">
            <SectionHeading eyebrow="Questions" title="Questions from medical store owners" />
            <div className="space-y-3">
              {FAQS.map((f) => (
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

        {/* Related guides: internal links to the supporting pages */}
        <section className="mx-auto max-w-6xl space-y-6 px-4 py-16">
          <h2 className="text-2xl font-extrabold tracking-tight text-[#0D1B16] sm:text-3xl">
            More guides for medical stores
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {[
              ['/pharmacy-management-software', 'Pharmacy management software', 'Stock, suppliers, customer dues, staff roles and daily reports.'],
              ['/medical-store-software', 'Medical store software', 'What to expect from software, a day at the counter and questions to ask.'],
              ['/gst-billing-software-for-chemists', 'GST billing for chemists', 'CGST, SGST and IGST by HSN code, GSTIN checks and GST-ready reports.'],
            ].map(([href, label, blurb]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group block h-full rounded-2xl bg-white p-5 ring-1 ring-[#D5E0DB] transition-shadow hover:shadow-[0_14px_30px_-18px_rgba(10,59,44,0.6)]"
                >
                  <h3 className="font-bold text-[#0A3B2C] group-hover:text-[#0F7B57]">{label}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#40554B]">{blurb}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#0F7B57]">
                    Read more <ArrowRight className="h-4 w-4" aria-hidden={true} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Final CTA */}
        <section className="bg-[#0A3B2C] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl space-y-6 px-4 text-center">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
              Run your medical store with less paperwork
            </h2>
            <p className="text-lg text-[#C9E6DA]">Start free and set up your medicines in minutes.</p>
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
          <Link href="/#pricing" className="hover:text-white">Pricing</Link>
          <Link href="/privacy-policy" className="hover:text-white">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white">Terms of Service</Link>
          <a href="mailto:support@obix360.com" className="hover:text-white">support@obix360.com</a>
        </nav>
        <p className="mt-4">© OBIX 360</p>
      </footer>
    </div>
  );
}
