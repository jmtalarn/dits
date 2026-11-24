'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import styles from './PostSlide.module.css';

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
        aria-label="Close fullscreen"
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
            alt={altText || 'Fullscreen media'}
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
