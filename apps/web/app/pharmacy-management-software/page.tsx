import { SeoPage, seoMetadata, type SeoPageConfig } from '@/components/seo/seo-page';

const config: SeoPageConfig = {
  path: '/pharmacy-management-software',
  title: 'Pharmacy Management Software for India | OBIX 360',
  description:
    'Pharmacy management software for India: stock with batch and expiry, suppliers, customer dues, staff roles and daily reports in one app. Start free.',
  eyebrow: 'Beyond the billing counter',
  h1: 'Pharmacy management software for India',
  intro:
    'Billing is only one part of running a pharmacy. Stock arrives from distributors, expires on the shelf, goes back to suppliers and sells on credit. Pharmacy management software keeps that whole loop in one place, so you know what you have, what you are owed and what you earned.',
  blocks: [
    {
      id: 'what-it-covers',
      heading: 'What pharmacy management software should cover',
      paragraphs: [
        'Billing software prints a bill. Management software also answers the questions you ask when the counter is quiet: what is about to expire, who has not paid, which supplier do I owe, and how did we do this week.',
      ],
      bullets: [
        { title: 'Billing at the counter', body: 'GST invoices with HSN codes and prices kept within MRP.' },
        { title: 'Stock with batch and expiry', body: 'Every medicine tracked by batch number and expiry date.' },
        { title: 'Purchases and suppliers', body: 'Purchase orders, received stock, returns and what you owe.' },
        { title: 'Customers on credit', body: 'Outstanding amounts and a statement for each customer.' },
        { title: 'Staff and access', body: 'Separate logins with roles, so each person sees what they need.' },
        { title: 'Reports and records', body: 'Daily books, profit per bill and the Schedule H1 register.' },
      ],
    },
    {
      id: 'stock-and-expiry',
      heading: 'Stock and expiry, medicine by medicine',
      paragraphs: [
        'Record the batch number and expiry date when stock comes in. When you sell, OBIX 360 takes stock from the batch that expires first, so older stock moves before newer stock.',
        'You can see every batch that expires within 30 days and get reminders, which gives you time to return the stock to the distributor. If a batch is ever recalled, you can look up which orders received it.',
      ],
    },
    {
      id: 'purchases-and-suppliers',
      heading: 'Purchases, distributor bills and supplier returns',
      paragraphs: [
        'Raise purchase orders to your suppliers and mark them received when the goods arrive. For long distributor bills, photograph the invoice and the items are read into your stock for you to review and confirm, so there is no line-by-line typing.',
        'When stock expires or arrives damaged, record a supplier return. Each supplier also shows what you still owe, with the amount split by how old the bill is.',
      ],
    },
    {
      id: 'customer-dues',
      heading: 'Customer credit and dues',
      paragraphs: [
        'Many medical stores sell on credit to regular customers. OBIX 360 tracks each customer’s outstanding amount, and the receivables report ages those dues into 0 to 30, 31 to 60, 61 to 90 and over 90 days, so you can see who to call first.',
        'Open a customer’s statement to see every bill and payment in a date range with the opening and closing balance. It is the page to show when a customer disputes what they owe.',
      ],
    },
    {
      id: 'staff-and-access',
      heading: 'Staff logins with the right access',
      paragraphs: [
        'Give each person their own login with a role such as manager, accountant or cashier. A counter assistant can bill without seeing the owner-level settings, and the money and profit reports are limited to the owner, manager and accountant roles.',
      ],
    },
    {
      id: 'reports',
      heading: 'Reports an owner actually reads',
      bullets: [
        { title: 'Day Book', body: 'Sales, payments, expenses and purchases for a day, in time order.' },
        { title: 'Money in and out', body: 'Cash against UPI and bank receipts, expenses and purchases, with a daily net.' },
        { title: 'Profit per bill', body: 'Revenue, cost and margin for each bill, net of returns.' },
        { title: 'Staff-wise sales', body: 'Who billed how much in the period.' },
        { title: 'Stock summary', body: 'Current stock and value, with what was bought and sold.' },
        { title: 'Export', body: 'Download reports as CSV or print them.' },
      ],
      paragraphs: [
        'Profit uses each medicine’s current purchase price, so treat it as a close estimate rather than an audited figure.',
      ],
    },
    {
      id: 'compliance',
      heading: 'Compliance records in the same system',
      paragraphs: [
        'Mark Schedule H1 and X medicines, keep the register in the app and attach a prescription photo to the sale. GST invoices carry HSN codes and are numbered by financial year.',
      ],
      note: 'The app keeps the records in one place. You remain responsible for the accuracy of entries and for meeting the legal requirements for your drug licence and GST.',
    },
    {
      id: 'getting-started',
      heading: 'Moving your existing stock in',
      paragraphs: [
        'Upload your medicine list with batch numbers, prices and stock from a CSV or Excel file, or add items one by one. Most stores start with their fastest-selling medicines and add the rest over a few days.',
      ],
    },
  ],
  faqs: [
    {
      question: 'What is the difference between pharmacy billing software and pharmacy management software?',
      answer:
        'Billing software focuses on the counter: making bills. Management software also covers stock and expiry, suppliers and purchases, customer dues, staff access and reports. OBIX 360 covers both in one app.',
    },
    {
      question: 'Can it manage suppliers and purchase orders?',
      answer:
        'Yes. You can raise purchase orders, mark them received, scan distributor bills into stock, record supplier returns and see what you owe each supplier.',
    },
    {
      question: 'Can I track customers who buy on credit?',
      answer:
        'Yes. Each customer has an outstanding amount, an ageing view that groups dues by how old they are, and a statement with opening and closing balance for any date range.',
    },
    {
      question: 'Can I limit what my staff can see?',
      answer:
        'Yes. Staff get their own logins with roles such as manager, accountant and cashier. The money and profit reports are available to the owner, manager and accountant roles.',
    },
    {
      question: 'Can I import my existing medicines and stock?',
      answer:
        'Yes. You can bulk upload your products, prices, batch numbers and stock levels from a CSV or Excel file.',
    },
    {
      question: 'Does it work on a phone?',
      answer:
        'Yes. OBIX 360 runs on Android and in a web browser, so you can bill and check reports from your phone or a computer.',
    },
  ],
  ctaTitle: 'Run the whole pharmacy from one app',
  ctaBody: 'Start free and add your medicines in minutes.',
};

export const metadata = seoMetadata(config);

export default function PharmacyManagementSoftwarePage() {
  return <SeoPage config={config} />;
}
