export type FaqCategory = 'general' | 'pricing' | 'hardware' | 'gst' | 'offline';

export interface FAQItem {
  question: string;
  answer: string;
  category: FaqCategory;
}

export const FAQS: FAQItem[] = [
  {
    category: 'general',
    question: 'What is OBIX 360 all-in-one billing software?',
    answer:
      'OBIX 360 is a single app for GST billing, inventory, orders, POS and WhatsApp invoices. Instead of separate tools for billing, stock and ordering, your counter, staff and stock all run from one account on your phone, tablet or PC.',
  },
  {
    category: 'general',
    question: 'Which businesses can use OBIX 360?',
    answer:
      'OBIX 360 is built for grocery and retail stores, restaurants and cafés, pharmacies, and wholesale distributors. The billing and inventory tools are the same for everyone, and each business type gets the extras it needs, such as table orders and a kitchen display for restaurants, or batch and expiry tracking for pharmacies.',
  },
  {
    category: 'pricing',
    question: 'Is there a free plan?',
    answer:
      'Yes. The Starter plan is free forever and includes up to 200 invoices a month, basic inventory management, thermal printer support and one cashier login. You can upgrade when your shop outgrows it.',
  },
  {
    category: 'pricing',
    question: 'How much do the paid plans cost?',
    answer:
      'Store Pro is ₹999 a month (₹799 a month on annual billing) with unlimited bills, batch and expiry tracking, WhatsApp bill delivery, kitchen display and unlimited staff logins. The Multi-Branch plan is ₹2,499 per branch a month (₹1,999 on annual billing) and adds a central dashboard across outlets.',
  },
  {
    category: 'general',
    question: 'Do I need special hardware to run OBIX 360?',
    answer:
      'No. OBIX runs in any modern browser on Windows PCs, Android tablets, iPads, or smartphones, and there is an Android app on Google Play. You can plug in standard USB/Bluetooth thermal receipt printers (58mm or 80mm) and barcode scanners directly.',
  },
  {
    category: 'gst',
    question: 'Is OBIX 360 compliant with Indian GST laws?',
    answer:
      'Yes. OBIX automatically calculates CGST, SGST, and IGST rates based on item HSN codes. It supports B2B invoices with GSTIN validation, B2C thermal bills, financial-year invoice numbering, and generates monthly GST-ready sales reports.',
  },
  {
    category: 'general',
    question: 'Can I send bills to customers on WhatsApp?',
    answer:
      'Yes. On the Store Pro plan you can send invoices straight to a customer on WhatsApp from the billing screen, so there is no need to print every bill.',
  },
  {
    category: 'general',
    question: 'Does OBIX 360 support pharmacies, including batch and expiry tracking?',
    answer:
      'Yes. Pharmacies can record batch number and expiry for each product and see which batches expire within 30 days. OBIX 360 also includes a Schedule H1/X register and lets you attach a prescription photo to a sale.',
  },
  {
    category: 'general',
    question: 'Can restaurants use it for table orders and the kitchen?',
    answer:
      'Yes. You can take table and takeaway orders, and send KOTs to a kitchen display so cooks see what to prepare. Waiters, cashiers and kitchen staff each get their own login.',
  },
  {
    category: 'general',
    question: 'Can I run more than one branch or outlet?',
    answer:
      'Yes. The Multi-Branch plan gives you a central dashboard across outlets, plus field salesman route tracking for distribution businesses.',
  },
  {
    category: 'general',
    question: 'How do I add stock without typing every item?',
    answer:
      'You can bulk upload products from a CSV or Excel template, and scan a supplier purchase invoice to add its items to inventory instead of entering each line by hand.',
  },
  {
    category: 'offline',
    question: 'What happens if my internet connection drops at the counter?',
    answer:
      'OBIX features offline-first local database caching. You can continue taking orders and printing thermal receipts even during an internet outage. Your sales and inventory updates automatically sync to the cloud once reconnected.',
  },
  {
    category: 'general',
    question: 'Can I import my existing product catalog from Excel or Tally?',
    answer:
      'Yes. You can bulk upload your entire product catalog, pricing, batch numbers, and inventory levels using a standard CSV/Excel template in less than 2 minutes.',
  },
  {
    category: 'general',
    question: 'How do staff logins work for cashiers and waiters?',
    answer:
      'As a store owner or manager, you can add team logins and assign precise role-based access. Cashiers only see the billing screen, waiters see table order taking, cooks see the kitchen display, and accountants see financials.',
  },
];
