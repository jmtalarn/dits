'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import styles from './PostSlide.module.css';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface MediaLightboxProps {
  imageUrl?: string;
  altText?: string;
  video?: { playlist: string; thumbnail?: string };
  onClose: () => void;
}

export default function MediaLightbox({
  imageUrl,
  altText,
  video,
  onClose,
}: MediaLightboxProps) {
  const { t } = useI18n();
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={styles.lightboxBackdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('lightbox.closeFullscreen')}
        className={styles.lightboxClose}
      >
        <X size={22} />
      </button>

      <div
        className={styles.lightboxContent}
        onClick={(e) => e.stopPropagation()}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt={altText || t('lightbox.fullscreenMediaAlt')}
            className={styles.lightboxImage}
          />
        )}
        {video && (
          <VideoPlayer playlist={video.playlist} poster={video.thumbnail} />
        )}
      </div>

      {altText && <p className={styles.lightboxAlt}>{altText}</p>}
    </div>
  );
}
