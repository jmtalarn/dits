// Strongly typed translation dictionaries for Dits.
//
// `en` is the source of truth for the shape of the dictionary; `es` (and any
// future locale) must satisfy the exact same shape via the `Dictionary` type.
//
// `en` is imported with `import type` only, so this stays a type-only
// reference and does not create a runtime circular dependency with `./en`.
import type { en } from './en';

export type Dictionary = typeof en;

// `SUPPORTED_LOCALES` is the single source of truth for which locales exist;
// `Locale` is derived from it, so adding a new locale here is enough to widen
// the type everywhere it's used.
// Future languages: just add 1 line here + its dictionary file
export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'ca',
  'de',
  'fr',
  'pt',
  'ja',
  'ko',
  'ru',
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
