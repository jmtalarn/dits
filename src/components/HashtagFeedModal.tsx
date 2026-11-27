'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getHashtagFeed, getSavedSession, DitsPost } from '@/lib/bsky';
import PostSlide from './PostSlide';
import { DitsFullLoader } from './DitsLoader';
import styles from './HashtagFeedModal.module.css';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface HashtagFeedModalProps {
  tag: string;
  onClose: () => void;
}

export default function HashtagFeedModal({ tag, onClose }: HashtagFeedModalProps) {
  const { t } = useI18n();
  const [posts, setPosts] = useState<DitsPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSavedSession();
    getHashtagFeed(tag, session)
      .then((data) => setPosts(data.posts))
      .finally(() => setLoading(false));
  }, [tag]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <header className={styles.header}>
        <span className={styles.tagPill}>#{tag.replace(/^#/, '')}</span>
        <button type="button" onClick={onClose} className={styles.closeBtn} aria-label={t('hashtagFeed.closeTagFeed')}>
          <X size={18} />
        </button>
      </header>

      {loading ? (
        <DitsFullLoader />
      ) : posts.length === 0 ? (
        <div className={styles.emptyState}>{t('hashtagFeed.noPosts', { tag })}</div>
      ) : (
        <div className={styles.feedScroll}>
          {posts.map((post) => (
            <PostSlide key={post.uri} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
