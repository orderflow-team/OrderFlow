'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
  category: 'general' | 'hardware' | 'gst' | 'offline';
}

const FAQS: FAQItem[] = [
  {
    category: 'hardware',
    question: 'Do I need special hardware to run OBIX?',
    answer: 'No. OBIX runs in any modern browser on Windows PCs, Android tablets, iPads, or smartphones. You can plug in standard USB/Bluetooth thermal receipt printers (58mm or 80mm) and barcode scanners directly.',
  },
  {
    category: 'gst',
    question: 'Is OBIX compliant with Indian GST laws?',
    answer: 'Yes! OBIX automatically calculates CGST, SGST, and IGST rates based on item HSN codes. It supports B2B invoices with GSTIN validation, B2C thermal bills, and generates monthly GST-ready sales reports.',
  },
  {
    category: 'offline',
    question: 'What happens if my internet connection drops at the counter?',
    answer: 'OBIX features offline-first local database caching. You can continue taking orders and printing thermal receipts even during an internet outage. Your sales and stock updates automatically sync to the cloud once reconnected.',
  },
  {
    category: 'general',
    question: 'Can I import my existing product catalog from Excel or Tally?',
    answer: 'Yes! You can bulk upload your entire product catalog, pricing, batch numbers, and stock levels using a standard CSV/Excel template in less than 2 minutes.',
  },
  {
    category: 'general',
    question: 'How do staff logins work for cashiers and waiters?',
    answer: 'As a store owner or manager, you can add team logins and assign precise role-based access. Cashiers only see the billing screen, waiters see table order taking, cooks see the kitchen display, and accountants see financials.',
  },
];

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredFaqs = FAQS.filter((faq) => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    const matchesQuery =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Search Input & Category Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions (e.g. GST, printer, offline mode)..."
            className="w-full pl-11 pr-4 py-3 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: 'All Questions' },
            { id: 'hardware', label: 'Hardware & Printers' },
            { id: 'gst', label: 'GST & Invoices' },
            { id: 'offline', label: 'Offline Mode' },
            { id: 'general', label: 'General' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white/60 text-slate-600 hover:bg-white/90 border border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* FAQ Accordion List */}
      <div className="space-y-4">
        {filteredFaqs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No questions found matching &quot;{searchQuery}&quot;.
          </div>
        ) : (
          filteredFaqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={faq.question}
                className={`rounded-2xl bg-white/70 backdrop-blur-xl border transition-all duration-200 overflow-hidden ${
                  isOpen ? 'border-emerald-300 shadow-md ring-1 ring-emerald-200/50' : 'border-white/80 shadow-sm hover:border-slate-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 font-semibold text-slate-900 text-base sm:text-lg hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <HelpCircle className={`w-5 h-5 shrink-0 transition-colors ${isOpen ? 'text-emerald-600' : 'text-slate-400'}`} />
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      isOpen ? 'rotate-180 text-emerald-600' : ''
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-6 pb-6 pt-0 text-slate-600 text-sm leading-relaxed border-t border-slate-100/80">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
