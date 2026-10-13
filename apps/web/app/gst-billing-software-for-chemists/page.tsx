import { SeoPage, seoMetadata, type SeoPageConfig } from '@/components/seo/seo-page';

const config: SeoPageConfig = {
  path: '/gst-billing-software-for-chemists',
  title: 'GST Billing Software for Chemists in India | OBIX 360',
  description:
    'GST billing software for chemists and medical shops: CGST, SGST and IGST by HSN code, GSTIN checks, financial-year invoice numbers and GST-ready reports.',
  eyebrow: 'GST made routine',
  h1: 'GST billing software for chemists and medical shops',
  intro:
    'Every bill at a chemist carries GST, and every month your accountant asks for the numbers. Good GST billing software gets the tax split right on each bill, numbers your invoices properly and gives you reports you can hand over without retyping anything.',
  blocks: [
    {
      id: 'what-gst-billing-involves',
      heading: 'What GST billing for a chemist involves',
      bullets: [
        { title: 'CGST and SGST', body: 'For a sale within your state, tax is split into central and state parts.' },
        { title: 'IGST', body: 'For a sale to another state, the whole tax is charged as IGST.' },
        { title: 'HSN code on every item', body: 'Each medicine needs its HSN code and the GST rate that applies to it.' },
        { title: 'Invoice numbering', body: 'Invoices should run in a clear series for each financial year.' },
        { title: 'B2B and B2C bills', body: 'A business customer’s bill carries their GSTIN; a walk-in customer gets a simple bill.' },
        { title: 'Records for your accountant', body: 'A monthly summary that matches your sales.' },
      ],
    },
    {
      id: 'how-obix-handles-gst',
      heading: 'How OBIX 360 handles GST on every bill',
      paragraphs: [
        'OBIX 360 calculates CGST, SGST and IGST for each item based on the HSN code and GST rate you set for the medicine. Invoices are numbered by financial year, from April to March, and the invoice carries the details a tax invoice needs.',
        'For business customers and suppliers, the GSTIN is checked when you enter it: the format and the check digit are validated, so a mistyped number is caught before it ends up on an invoice. You can issue B2B invoices with the customer’s GSTIN, and B2C thermal bills for walk-in customers.',
      ],
    },
    {
      id: 'rates',
      heading: 'GST rates: set them once per medicine',
      paragraphs: [
        'GST rates on medicines are set by the government and have changed over time. In OBIX 360 you enter the rate that applies to each product, and you can update it when the rate changes. Keep the MRP and the GST rate on every medicine so bills stay consistent.',
      ],
      note: 'This page is general information, not tax advice. Confirm the HSN code and GST rate for each medicine with your chartered accountant or on the GST portal.',
    },
    {
      id: 'reports',
      heading: 'GST-ready reports for your accountant',
      paragraphs: [
        'OBIX 360 produces monthly GST-ready reports from your bills, so the figures your accountant files with come straight from your sales instead of a separate spreadsheet. You can also open any invoice as a PDF, and returns are recorded against the original bill.',
        'OBIX 360 prepares the numbers. Filing your GST returns is still done on the GST portal, by you or your accountant.',
      ],
    },
    {
      id: 'before-you-file',
      heading: 'A short checklist before the monthly filing',
      bullets: [
        { title: 'Every medicine has an HSN code', body: 'Items without one cannot be reported correctly.' },
        { title: 'GST rates are current', body: 'Check any medicine whose rate changed this month.' },
        { title: 'Business customers have a valid GSTIN', body: 'The check digit catches most typing mistakes.' },
        { title: 'Returns are recorded', body: 'A returned item should reduce the original bill.' },
        { title: 'The monthly report matches your books', body: 'Compare the totals with your sales before filing.' },
      ],
    },
    {
      id: 'beyond-gst',
      heading: 'GST billing plus the rest of the pharmacy',
      paragraphs: [
        'GST is one part of the counter. The same app tracks batch and expiry, keeps prices within MRP, holds the Schedule H1 register and scans distributor bills into stock. See the pharmacy billing software page for the full list.',
      ],
    },
  ],
  faqs: [
    {
      question: 'Does OBIX 360 split CGST, SGST and IGST?',
      answer:
        'Yes. It calculates CGST, SGST and IGST for each item based on the HSN code and GST rate you set, using CGST and SGST within your state and IGST between states.',
    },
    {
      question: 'Can I put HSN codes on my medicines?',
      answer:
        'Yes. Each product can carry an HSN code, and the invoice uses it to work out the tax. You can bulk upload HSN codes along with your product list.',
    },
    {
      question: 'How are invoices numbered?',
      answer:
        'Invoices are numbered in a series for each financial year, April to March, so numbers are continuous and easy to trace.',
    },
    {
      question: 'Does it check GSTIN numbers?',
      answer:
        'Yes. When you enter a customer or supplier GSTIN, its format and check digit are validated, which catches most typing mistakes.',
    },
    {
      question: 'Will it file my GST returns?',
      answer:
        'No. OBIX 360 prepares GST-ready monthly reports from your bills. The return itself is filed on the GST portal by you or your accountant.',
    },
    {
      question: 'What if the GST rate on a medicine changes?',
      answer:
        'Update the GST rate on that product. New bills use the new rate, and bills already made keep the rate they were issued with.',
    },
  ],
  ctaTitle: 'Get your GST bills right the first time',
  ctaBody: 'Start free and set up your medicines with their HSN codes.',
};

export const metadata = seoMetadata(config);

export default function GstBillingSoftwareForChemistsPage() {
  return <SeoPage config={config} />;
}
