import type { Metadata } from 'next';
import Link from 'next/link';
import { ObixMark } from '@/components/obix-logo';

export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 py-16 text-center bg-slate-50">
      <Link href="/" aria-label="OBIX 360 home">
        <ObixMark className="w-14 h-14" />
      </Link>
      <p className="text-sm font-bold tracking-[0.2em] text-emerald-700 uppercase">Error 404</p>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
        We couldn&apos;t find that page
      </h1>
      <p className="max-w-md text-slate-600">
        The link may be broken or the page may have moved. Head back to the home page, or sign in to
        open your dashboard.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <Link
          href="/"
          className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors"
        >
          Back to home
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center justify-center h-12 px-7 rounded-full bg-white ring-1 ring-slate-300 hover:bg-slate-100 text-slate-800 text-sm font-semibold transition-colors"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
