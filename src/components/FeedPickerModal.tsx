'use client';

import { useEffect, useState } from 'react';
import { X, Check, Compass } from 'lucide-react';
import { AtpSessionData } from '@atproto/api';
import { getAvailableFeeds, DitsFeedGenerator } from '@/lib/bsky';
import { DitsMiniSpinner } from './DitsLoader';
import styles from './FeedPickerModal.module.css';

interface FeedPickerModalProps {
  session: AtpSessionData;
  selectedUri: string;
  onSelectFeed: (feed: DitsFeedGenerator) => void;
  onClose: () => void;
}

export default function FeedPickerModal({
  session,
  selectedUri,
  onSelectFeed,
  onClose,
}: FeedPickerModalProps) {
  const [savedFeeds, setSavedFeeds] = useState<DitsFeedGenerator[]>([]);
  const [popularFeeds, setPopularFeeds] = useState<DitsFeedGenerator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAvailableFeeds(session)
      .then((data) => {
        setSavedFeeds(data.saved);
        setPopularFeeds(data.popular);
      })
      .finally(() => setLoading(false));
  }, [session]);

  const renderFeedRow = (feed: DitsFeedGenerator) => {
    const isActive = feed.uri === selectedUri;
    return (
      <button
        key={feed.uri}
        type="button"
        onClick={() => onSelectFeed(feed)}
        className={`${styles.feedRow} ${isActive ? styles.feedRowActive : ''}`}
      >
        {feed.avatar ? (
          <img src={feed.avatar} alt="" className={styles.feedAvatar} />
        ) : (
          <div className={styles.feedAvatar}>
            <Compass size={18} />
          </div>
        )}
        <div className={styles.feedMeta}>
          <span className={styles.feedName}>{feed.displayName}</span>
          <span className={styles.feedDesc}>
            {feed.description || `by @${feed.creatorHandle}`}
          </span>
        </div>
        {isActive && <Check size={18} color="#38bdf8" />}
      </button>
    );
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Choose a Feed</span>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DitsMiniSpinner />
          </div>
        ) : (
          <div className={styles.list}>
            <span className={styles.sectionLabel}>Your Saved Feeds</span>
            {savedFeeds.map(renderFeedRow)}

            {popularFeeds.length > 0 && (
              <>
                <span className={styles.sectionLabel}>Popular on Bluesky</span>
                {popularFeeds.map(renderFeedRow)}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
