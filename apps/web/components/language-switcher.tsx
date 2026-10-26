'use client';

import { useTranslation } from 'react-i18next';
import { LANGUAGES, isLanguageCode } from '@/lib/i18n/config';
import { setLanguage } from '@/lib/i18n';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();
  return (
    <select
      aria-label={t('common.language')}
      value={i18n.resolvedLanguage}
      onChange={(e) => isLanguageCode(e.target.value) && setLanguage(e.target.value)}
      className={`rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 ${className}`}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
