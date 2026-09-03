import Link from 'next/link';
import { ShieldCheck, Lock, Eye, Database, Trash2, Mail, ArrowLeft } from 'lucide-react';
import { ObixMark } from '@/components/obix-logo';

export const metadata = {
  title: 'Privacy Policy | OBIX OrderFlow',
  description: 'Privacy Policy and data safety commitments for OBIX (OrderFlow Business & Store Management).',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = 'September 3, 2026';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-sky-500/30 relative overflow-hidden">
      {/* Background Sheen Effect */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90vw] h-[400px] max-w-[1000px] rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute top-1/3 -left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-200/30 blur-3xl" />
      </div>

      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <ObixMark className="w-9 h-9 transition-transform group-hover:scale-105" />
            <span className="font-extrabold text-xl tracking-tight text-slate-900">OBIX</span>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-12 relative z-10">
        {/* Title Banner */}
        <div className="bg-white rounded-3xl p-8 md:p-10 border border-slate-200/80 shadow-sm mb-10 text-center flex flex-col items-center justify-center">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-sky-100 text-sky-700 mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight text-center">
            Privacy Policy
          </h1>
          <p className="text-slate-500 mt-2 text-sm md:text-base font-medium text-center max-w-xl mx-auto">
            Effective Date: {lastUpdated} &nbsp;|&nbsp; OBIX OrderFlow Platform
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200/80 shadow-sm space-y-10">
          {/* Introduction */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-sky-600 shrink-0" />
              1. Introduction & Overview
            </h2>
            <p className="text-slate-600 leading-relaxed text-sm md:text-base text-justify">
              Welcome to <strong>OBIX</strong> (operated under OrderFlow Business Management). We are committed to protecting the privacy, security, and integrity of the business and personal data entrusted to us by store owners, managers, cashiers, and users of our mobile applications and web services.
            </p>
            <p className="text-slate-600 leading-relaxed text-sm md:text-base text-justify">
              This Privacy Policy explains how OBIX collects, uses, stores, and safeguards your information when you use our mobile app or web platform across Pharmacies, Retail Stores, Restaurants, and Commercial Outlets.
            </p>
          </section>

          <hr className="border-slate-100" />

          {/* Data We Collect */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-sky-600 shrink-0" />
              2. Information We Collect
            </h2>
            <p className="text-slate-600 leading-relaxed text-sm text-justify">
              We only collect data necessary to provide seamless Point-of-Sale (POS) billing, inventory tracking, order management, and multi-user business operations:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60">
                <h3 className="font-bold text-slate-900 text-sm mb-1">Account & User Credentials</h3>
                <p className="text-xs text-slate-600 leading-normal text-justify">
                  User names, email addresses, phone numbers, staff login credentials, and user role assignments.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60">
                <h3 className="font-bold text-slate-900 text-sm mb-1">Store & Operational Data</h3>
                <p className="text-xs text-slate-600 leading-normal text-justify">
                  Product catalog items, inventory levels, order records, customer invoices, supplier data, and sales transactions.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60">
                <h3 className="font-bold text-slate-900 text-sm mb-1">Device & Technical Info</h3>
                <p className="text-xs text-slate-600 leading-normal text-justify">
                  Device model, operating system version, unique device identifiers, IP address, and app crash diagnostics for over-the-air sync.
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/60">
                <h3 className="font-bold text-slate-900 text-sm mb-1">Hardware Permissions</h3>
                <p className="text-xs text-slate-600 leading-normal text-justify">
                  Camera permission (solely used for in-app barcode and product scanning) and Push Notifications (order & low-stock alerts).
                </p>
              </div>
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* How We Use Your Data */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-sky-600 shrink-0" />
              3. How We Use Your Information
            </h2>
            <ul className="list-disc list-inside text-slate-600 text-sm space-y-2 leading-relaxed text-justify">
              <li>To operate, sync, and deliver Point-of-Sale (POS) order fulfillment and inventory tracking services.</li>
              <li>To synchronize real-time store transactions across authorized staff devices.</li>
              <li>To send critical system alerts, low-stock warnings, and over-the-air (OTA) application updates.</li>
              <li>To protect against unauthorized access, fraudulent billing transactions, and system abuse.</li>
              <li>To generate analytics reports for store managers to optimize inventory and sales.</li>
            </ul>
          </section>

          <hr className="border-slate-100" />

          {/* Third Party Sharing */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0" />
              4. Data Sharing & Third Parties
            </h2>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/70 text-amber-900 text-sm leading-relaxed text-justify">
              <strong>Zero Data Selling Guarantee:</strong> We do <u>NOT</u> sell, rent, trade, or monetize your personal or business data to third-party advertisers or data brokers under any circumstances.
            </div>
            <p className="text-slate-600 leading-relaxed text-sm text-justify">
              Data is shared strictly with essential infrastructure providers (such as encrypted cloud hosting and database backup servers) necessary to operate the OBIX platform securely.
            </p>
          </section>

          <hr className="border-slate-100" />

          {/* Data Security & Deletion */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-sky-600 shrink-0" />
              5. Data Protection & Account Deletion Rights
            </h2>
            <p className="text-slate-600 leading-relaxed text-sm text-justify">
              All communications between your devices and OBIX servers are encrypted using industry-standard TLS/SSL (HTTPS) protocols. Data stored at rest is protected with strict multi-tenant access controls.
            </p>
            <p className="text-slate-600 leading-relaxed text-sm text-justify">
              <strong>Account & Data Deletion:</strong> You have the right to request complete deletion of your user account, store records, and associated data at any time. You may request account deletion by emailing our support team at <a href="mailto:admin.cleverminds@gmail.com" className="text-sky-600 underline font-semibold">admin.cleverminds@gmail.com</a> or via the Account Settings panel in the app.
            </p>
          </section>

          <hr className="border-slate-100" />

          {/* Contact Information */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-sky-600 shrink-0" />
              6. Contact Us
            </h2>
            <p className="text-slate-600 leading-relaxed text-sm text-justify">
              If you have any questions or privacy concerns regarding this policy, please contact our privacy compliance team:
            </p>
            <div className="p-6 rounded-2xl bg-slate-900 text-white space-y-2">
              <p className="font-bold text-base">OBIX OrderFlow Privacy Team</p>
              <p className="text-xs text-slate-300">Email: admin.cleverminds@gmail.com</p>
              <p className="text-xs text-slate-300">Website: https://orderflow-web-iota.vercel.app</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} OBIX OrderFlow. All rights reserved. Play Store & App Store Compliant.
        </footer>
      </main>
    </div>
  );
}
