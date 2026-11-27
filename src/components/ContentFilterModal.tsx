'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import {
  NSFW_LABEL_OPTIONS,
  NsfwLabel,
  NsfwFilterConfig,
  getNsfwFilterConfig,
  setNsfwFilterConfig,
  getHideReposts,
  setHideReposts,
  getMutedWords,
  setMutedWords,
} from '@/lib/bsky';
import styles from './ContentFilterModal.module.css';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface ContentFilterModalProps {
  onClose: () => void;
}

export default function ContentFilterModal({ onClose }: ContentFilterModalProps) {
  const { t, localeSetting, setLocale } = useI18n();
  const [config, setConfig] = useState<NsfwFilterConfig>(() => getNsfwFilterConfig());
  const [hideReposts, setHideRepostsState] = useState<boolean>(() => getHideReposts());
  const [mutedWords, setMutedWordsState] = useState<string[]>(() => getMutedWords());
  const [wordInput, setWordInput] = useState('');

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

  const handleAddMutedWord = () => {
    const cleaned = wordInput.trim().toLowerCase();
    if (!cleaned) return;
    if (!mutedWords.includes(cleaned)) {
      const updated = [...mutedWords, cleaned];
      setMutedWordsState(updated);
      setMutedWords(updated);
    }
    setWordInput('');
  };

  const handleRemoveMutedWord = (word: string) => {
    const updated = mutedWords.filter((w) => w !== word);
    setMutedWordsState(updated);
    setMutedWords(updated);
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{t('contentFilter.title')}</span>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        <p className={styles.subtitle}>
          {t('contentFilter.subtitle')}
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
                  {isHidden ? t('contentFilter.hidden') : t('contentFilter.shown')}
                </button>
              </div>
            );
          })}

          <div className={styles.row}>
            <div className={styles.rowMeta}>
              <span className={styles.rowTitle}>{t('contentFilter.repostsTitle')}</span>
              <span className={styles.rowDesc}>
                {t('contentFilter.repostsDesc')}
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleReposts}
              className={hideReposts ? styles.toggleBtn : styles.toggleBtnOff}
            >
              {hideReposts ? t('contentFilter.hidden') : t('contentFilter.shown')}
            </button>
          </div>

          {/* Muted Words & Phrases Section */}
          <div className={styles.mutedSection}>
            <div className={styles.rowMeta}>
              <span className={styles.rowTitle}>{t('contentFilter.mutedTitle')}</span>
              <span className={styles.rowDesc}>
                {t('contentFilter.mutedDesc')}
              </span>
            </div>

            <form
              className={styles.mutedForm}
              onSubmit={(e) => {
                e.preventDefault();
                handleAddMutedWord();
              }}
            >
              <input
                type="text"
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                placeholder={t('contentFilter.mutedPlaceholder')}
                className={styles.mutedInput}
              />
              <button
                type="submit"
                disabled={!wordInput.trim()}
                className={styles.mutedAddBtn}
                aria-label={t('contentFilter.addMutedWord')}
              >
                <Plus size={16} />
                <span>{t('common.add')}</span>
              </button>
            </form>

            {mutedWords.length > 0 && (
              <div className={styles.chipList}>
                {mutedWords.map((word) => (
                  <span key={word} className={styles.chip}>
                    <span>{word}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMutedWord(word)}
                      className={styles.chipRemoveBtn}
                      aria-label={t('contentFilter.removeWord', { word })}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
