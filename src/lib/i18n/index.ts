export * from './dictionaries/ca';
export * from './dictionaries/de';
export * from './dictionaries/en';
export * from './dictionaries/es';
export * from './dictionaries/fr';
export * from './dictionaries/ja';
export * from './dictionaries/ko';
export * from './dictionaries/pt';
export * from './dictionaries/ru';
export * from './dictionaries/types';
export * from './I18nProvider';

import { ca } from './dictionaries/ca';
import { de } from './dictionaries/de';
import { en } from './dictionaries/en';
import { es } from './dictionaries/es';
import { fr } from './dictionaries/fr';
import { ja } from './dictionaries/ja';
import { ko } from './dictionaries/ko';
import { pt } from './dictionaries/pt';
import { ru } from './dictionaries/ru';
import type { Dictionary, Locale } from './dictionaries/types';

export const dictionaries: Record<Locale, Dictionary> = {
  en,
  es,
  ca,
  de,
  fr,
  pt,
  ja,
  ko,
  ru,
};

export interface LanguageOption {
  code: Exclude<Locale, 'auto'>;
  nativeName: string;
  regionHint?: string;
}

// Future languages: just add 1 line here + its dictionary file
export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', nativeName: 'English' },
  { code: 'es', nativeName: 'Español' },
  { code: 'ca', nativeName: 'Català' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'pt', nativeName: 'Português' },
  { code: 'ja', nativeName: '日本語' },
  { code: 'ko', nativeName: '한국어' },
  { code: 'ru', nativeName: 'Русский' },
];
