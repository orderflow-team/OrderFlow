import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import hi from './locales/hi.json';
import gu from './locales/gu.json';
import mr from './locales/mr.json';

const flatten = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flatten(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe('locale files', () => {
  const englishKeys = flatten(en).sort();

  it.each([
    ['hi', hi],
    ['gu', gu],
    ['mr', mr],
  ])('%s has exactly the same keys as English', (_code, locale) => {
    expect(flatten(locale).sort()).toEqual(englishKeys);
  });

  it.each([
    ['hi', hi],
    ['gu', gu],
    ['mr', mr],
  ])('%s keeps the {{placeholders}} of every English string', (_code, locale) => {
    const placeholders = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort();
    const get = (o: any, path: string) => path.split('.').reduce((a, k) => a?.[k], o) as string;
    for (const key of englishKeys) {
      expect(placeholders(get(locale, key)), key).toEqual(placeholders(get(en, key)));
    }
  });
});
