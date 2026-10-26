'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { getSavedLanguage } from '@/lib/i18n';

/** Applies the saved language after hydration and keeps <html lang> in step with it. */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const sync = (lng: string) => {
      document.documentElement.lang = lng === 'en' ? 'en-IN' : lng;
    };
    i18n.on('languageChanged', sync);
    void i18n.changeLanguage(getSavedLanguage());
    return () => i18n.off('languageChanged', sync);
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
