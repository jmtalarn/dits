'use client';

import { X, Check, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { SUPPORTED_LANGUAGES, DEFAULT_LOCALE, Locale } from '@/lib/i18n';
import styles from './LanguageModal.module.css';

interface LanguageModalProps {
  onClose: () => void;
}

function getDetectedBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const candidates =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];

  for (const lang of candidates) {
    const short = lang?.slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGUAGES.some((l) => l.code === short)) {
      return short as Locale;
    }
  }
  return DEFAULT_LOCALE;
}

export default function LanguageModal({ onClose }: LanguageModalProps) {
  const { localeSetting, setLocale, t } = useI18n();

  const handleSelect = (nextLocale: Locale | 'auto') => {
    setLocale(nextLocale);
    onClose();
  };

  const browserLocale = getDetectedBrowserLocale();
  const detectedLanguageName =
    SUPPORTED_LANGUAGES.find((l) => l.code === browserLocale)?.nativeName || browserLocale;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <Globe size={18} />
            <span className={styles.title}>{t('language.title')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            aria-label={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.list}>
          {/* Automatic browser detection option */}
          <button
            type="button"
            onClick={() => handleSelect('auto')}
            className={localeSetting === 'auto' ? styles.optionRowActive : styles.optionRow}
          >
            <div className={styles.optionMeta}>
              <span className={styles.optionTitle}>{t('language.auto')}</span>
              <span className={styles.optionDesc}>{detectedLanguageName}</span>
            </div>
            {localeSetting === 'auto' && <Check size={18} className={styles.checkIcon} />}
          </button>

          {/* All supported languages */}
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = localeSetting === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={isSelected ? styles.optionRowActive : styles.optionRow}
              >
                <div className={styles.optionMeta}>
                  <span className={styles.optionTitle}>{lang.nativeName}</span>
                </div>
                {isSelected && <Check size={18} className={styles.checkIcon} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
