import { SeoPage, seoMetadata, type SeoPageConfig } from '@/components/seo/seo-page';

const config: SeoPageConfig = {
  path: '/medical-store-software',
  title: 'Medical Store Software with GST, Expiry and MRP | OBIX 360',
  description:
    'Medical store software for India: bill with GST, track expiry, keep prices within MRP and keep your Schedule H1 register. Android and web. Start free.',
  eyebrow: 'For small and growing medical stores',
  h1: 'Medical store software for India',
  intro:
    'If you run a medical store, you want software that is quick at the counter, tells you what is about to expire and keeps your GST bills right. This guide explains what to expect from medical store software, what a normal day looks like with it and what to ask before you buy.',
  blocks: [
    {
      id: 'what-you-need',
      heading: 'What a medical store needs from software',
      paragraphs: [
        'A medical store is different from a general shop. Medicines have batch numbers and expiry dates, a printed MRP you cannot exceed, GST by HSN code and, for some medicines, a register you must keep.',
      ],
      bullets: [
        { title: 'Quick billing', body: 'Search a medicine, add it, print or send the bill.' },
        { title: 'Expiry visibility', body: 'See what expires soon without checking every shelf.' },
        { title: 'MRP protection', body: 'No bill above the printed MRP by accident.' },
        { title: 'Correct GST', body: 'CGST, SGST and IGST by HSN code, numbered invoices.' },
        { title: 'Schedule H1 and X records', body: 'The register and prescription photos in one place.' },
        { title: 'Credit tracking', body: 'Know which regular customers owe you and how much.' },
      ],
    },
    {
      id: 'a-day-at-the-counter',
      heading: 'A day at the counter with OBIX 360',
      steps: [
        {
          title: 'Morning: check what is expiring',
          body: 'Open the list of batches expiring within 30 days. Set aside what can be returned to the distributor.',
        },
        {
          title: 'Billing: search, add, bill',
          body: 'Each sale takes stock from the batch that expires first. The price is kept within the MRP you entered, and GST is split by HSN code.',
        },
        {
          title: 'Schedule H1 sale: attach the prescription',
          body: 'Mark the medicine as Schedule H1 or X, and attach a photo of the prescription to the bill. The sale goes into the register.',
        },
        {
          title: 'Stock arrives: scan the distributor bill',
          body: 'Photograph the purchase invoice. The items are read into stock for you to review and confirm.',
        },
        {
          title: 'Evening: close the day',
          body: 'Check the Day Book and the money in and out report to see sales, cash against UPI, expenses and purchases for the day.',
        },
      ],
    },
    {
      id: 'on-your-phone',
      heading: 'Works on the phone you already have',
      paragraphs: [
        'OBIX 360 runs on Android and in a web browser. You can bill from a phone or a computer, send an invoice on WhatsApp on the Store Pro plan, and give your assistants separate logins so they only see what they need.',
      ],
    },
    {
      id: 'switching',
      heading: 'Moving from a notebook or older software',
      paragraphs: [
        'You do not have to enter everything on day one. Upload your medicine list with batch numbers, prices and stock from a CSV or Excel file, then start billing. Many stores begin with their fastest-moving medicines and fill in the rest as they go.',
      ],
    },
    {
      id: 'cost',
      heading: 'What it costs to start',
      paragraphs: [
        'You can start free. Some features, such as WhatsApp bill delivery, need a paid plan. The home page pricing section lists the current plans, so you can try the free version first and upgrade only if you need more.',
      ],
    },
    {
      id: 'questions-to-ask',
      heading: 'Questions to ask any vendor before you buy',
      bullets: [
        { title: 'Can I see what expires soon in one list?', body: 'Ask them to show you, not just say yes.' },
        { title: 'Does it stop a bill above MRP?', body: 'Try changing the price at the counter and see what happens.' },
        { title: 'Is there a Schedule H1 and X register?', body: 'Ask whether prescription photos can be attached.' },
        { title: 'How is GST handled?', body: 'Check CGST, SGST and IGST by HSN code and the invoice numbering.' },
        { title: 'Who can see the profit?', body: 'Reports should be limited to owner-level roles.' },
        { title: 'Can I get my reports out?', body: 'Look for CSV export and print.' },
      ],
    },
  ],
  faqs: [
    {
      question: 'What is the best software for a medical store in India?',
      answer:
        'The best choice is the one that covers batch and expiry tracking, MRP control, GST with HSN codes and a Schedule H1 register, and that you and your staff find quick to use. OBIX 360 covers all of these on Android and the web, and you can try it free.',
    },
    {
      question: 'Do I need a computer, or can I use my phone?',
      answer:
        'You can use either. OBIX 360 runs on Android and in a web browser, so a phone is enough to bill and check stock.',
    },
    {
      question: 'Will it warn me about expiring medicines?',
      answer:
        'Yes. It lists batches expiring within 30 days and sends expiry reminders, so you can return or sell the stock in time.',
    },
    {
      question: 'Can I stop prices going above MRP?',
      answer:
        'Yes. Enter the MRP for a medicine and the selling price is capped at it, including prices changed at the billing counter. Medicines without an MRP set are not capped.',
    },
    {
      question: 'Can I send bills to customers on WhatsApp?',
      answer:
        'Yes, on the Store Pro plan you can send an invoice straight from the billing screen.',
    },
    {
      question: 'Is it free to try?',
      answer:
        'Yes, you can start free. Paid plans add features such as WhatsApp bill delivery. See the home page for current plans.',
    },
  ],
  ctaTitle: 'Set up your medical store in minutes',
  ctaBody: 'Start free, upload your medicines and bill your first customer today.',
};

export const metadata = seoMetadata(config);

export default function MedicalStoreSoftwarePage() {
  return <SeoPage config={config} />;
}
