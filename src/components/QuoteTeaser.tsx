'use client';

import { DitsQuoteData } from '@/lib/bsky';
import styles from './PostSlide.module.css';

interface QuoteTeaserProps {
  quote: DitsQuoteData;
  onSelect: () => void;
}

export default function QuoteTeaser({ quote, onSelect }: QuoteTeaserProps) {
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
        <span className={styles.quoteTeaserAuthor}>@{quote.authorHandle}</span>
        <span className={styles.quoteTeaserAction}>Llisca →</span>
      </div>
      <p className={styles.quoteTeaserText}>{quote.text}</p>
    </button>
  );
}
