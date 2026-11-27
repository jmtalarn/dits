'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_LOCALE, Dictionary, Locale, SUPPORTED_LOCALES, dictionaries } from '.';

const STORAGE_KEY = 'dits_locale_v1';

type StoredLocale = Locale | 'auto';

// Recursively builds every dot-notation path to a string leaf in the dictionary,
// e.g. "comments.title" | "common.close" | ...
type LeafPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
  ? `${Prefix}${K}`
  : T[K] extends Record<string, unknown>
  ? LeafPaths<T[K], `${Prefix}${K}.`>
  : never;
}[keyof T & string];

export type TranslationKey = LeafPaths<Dictionary>;

function resolveKey(dict: Dictionary, key: string): string {
  const parts = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = dict;
  for (const part of parts) {
    value = value?.[part];
  }
  return typeof value === 'string' ? value : key;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{(.*?)\}\}/g, (_, token: string) => {
    const value = params[token.trim()];
    return value === undefined ? '' : String(value);
  });
}

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const candidates = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language];

  for (const lang of candidates) {
    const short = lang?.slice(0, 2).toLowerCase();
    if (SUPPORTED_LOCALES.includes(short as Locale)) {
      return short as Locale;
    }
  }
  return DEFAULT_LOCALE;
}

interface I18nContextValue {
  locale: Locale;
  localeSetting: StoredLocale;
  setLocale: (next: StoredLocale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  // Server-rendered markup always uses the default locale; the client
  // reconciles with the persisted preference right after mount, and
  // `suppressHydrationWarning` on <html>/elements prevents a mismatch flash.
  const [localeSetting, setLocaleSetting] = useState<StoredLocale>(DEFAULT_LOCALE);
  const [resolvedLocale, setResolvedLocale] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    let stored: StoredLocale | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) as StoredLocale | null;
    } catch {
      stored = null;
    }

    const initial: StoredLocale =
      stored === 'auto' || (stored && SUPPORTED_LOCALES.includes(stored))
        ? stored
        : 'auto';
    setLocaleSetting(initial);
    setResolvedLocale(initial === 'auto' ? detectBrowserLocale() : initial);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = resolvedLocale;
    }
  }, [resolvedLocale]);

  const setLocale = useCallback((next: StoredLocale) => {
    setLocaleSetting(next);
    setResolvedLocale(next === 'auto' ? detectBrowserLocale() : next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage write failures (e.g. private browsing)
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const dict = dictionaries[resolvedLocale] ?? dictionaries[DEFAULT_LOCALE];
      return interpolate(resolveKey(dict, key), params);
    },
    [resolvedLocale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale: resolvedLocale, localeSetting, setLocale, t }),
    [resolvedLocale, localeSetting, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
