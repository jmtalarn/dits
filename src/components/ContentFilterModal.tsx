'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import {
  NSFW_LABEL_OPTIONS,
  NsfwLabel,
  NsfwFilterConfig,
  getNsfwFilterConfig,
  setNsfwFilterConfig,
  getHideReposts,
  setHideReposts,
} from '@/lib/bsky';
import styles from './ContentFilterModal.module.css';

interface ContentFilterModalProps {
  onClose: () => void;
}

export default function ContentFilterModal({ onClose }: ContentFilterModalProps) {
  const [config, setConfig] = useState<NsfwFilterConfig>(() => getNsfwFilterConfig());
  const [hideReposts, setHideRepostsState] = useState<boolean>(() => getHideReposts());

  const handleToggle = (id: NsfwLabel) => {
    const updated: NsfwFilterConfig = {
      ...config,
      [id]: !config[id],
    };
    setConfig(updated);
    setNsfwFilterConfig(updated);
  };

  const handleToggleReposts = () => {
    const next = !hideReposts;
    setHideRepostsState(next);
    setHideReposts(next);
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Content Moderation</span>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className={styles.subtitle}>
          Choose which Bluesky sensitivity labels and post types are hidden from your feeds.
        </p>

        <div className={styles.list}>
          {NSFW_LABEL_OPTIONS.map((item) => {
            const isHidden = config[item.id];
            return (
              <div key={item.id} className={styles.row}>
                <div className={styles.rowMeta}>
                  <span className={styles.rowTitle}>{item.label}</span>
                  <span className={styles.rowDesc}>{item.description}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(item.id)}
                  className={isHidden ? styles.toggleBtn : styles.toggleBtnOff}
                >
                  {isHidden ? 'Hidden' : 'Shown'}
                </button>
              </div>
            );
          })}

          <div className={styles.row}>
            <div className={styles.rowMeta}>
              <span className={styles.rowTitle}>Reposts in Following</span>
              <span className={styles.rowDesc}>
                Hide reposts from people you follow to see only original posts.
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleReposts}
              className={hideReposts ? styles.toggleBtn : styles.toggleBtnOff}
            >
              {hideReposts ? 'Hidden' : 'Shown'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
