'use client';

import { DitsQuoteData } from '@/lib/bsky';
import styles from './PostSlide.module.css';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface QuoteTeaserProps {
  quote: DitsQuoteData;
  onSelect: () => void;
}

export default function QuoteTeaser({ quote, onSelect }: QuoteTeaserProps) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onSelect} className={styles.quoteTeaserBox}>
      <div className={styles.quoteTeaserHeader}>
        {quote.authorAvatar && (
          <img
            src={quote.authorAvatar}
            alt={quote.authorHandle}
            className={styles.quoteTeaserAvatar}
          />
        )}
        <span className={styles.quoteTeaserAuthor}>
          {quote.isReplyContext ? t('quote.replyingTo', { handle: quote.authorHandle }) : `@${quote.authorHandle}`}
        </span>
        <span className={styles.quoteTeaserAction}>{t('quote.swipe')}</span>
      </div>
      <p className={styles.quoteTeaserText}>{quote.text}</p>
    </button>
  );
}
