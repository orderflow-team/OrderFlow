import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, isLanguageCode, type LanguageCode } from './config';
import en from './locales/en.json';
import hi from './locales/hi.json';
import gu from './locales/gu.json';
import mr from './locales/mr.json';

// Always boots in English so the server render and first client render match; the saved choice is
// applied after hydration by I18nProvider.
i18next.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, gu: { translation: gu }, mr: { translation: mr } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  initAsync: false,
});

export function getSavedLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguageCode(saved) ? saved : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function setLanguage(code: LanguageCode) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    // storage unavailable — the choice still applies for this session
  }
  void i18next.changeLanguage(code);
}

export default i18next;
