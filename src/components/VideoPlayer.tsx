'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Maximize2 } from 'lucide-react';
import styles from './PostSlide.module.css';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface VideoPlayerProps {
  playlist: string;
  poster?: string;
  onFullscreen?: () => void;
}

export default function VideoPlayer({
  playlist,
  poster,
  onFullscreen,
}: VideoPlayerProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const pointerStartX = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(playlist);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playlist;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.6 }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      if (hls) hls.destroy();
    };
  }, [playlist]);

  const handleVideoClick = (e: React.MouseEvent) => {
    // Prevent toggling mute if the user was dragging horizontally
    if (Math.abs(e.clientX - pointerStartX.current) > 8) return;
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div
      className={styles.mediaWrapper}
      onPointerDown={(e) => (pointerStartX.current = e.clientX)}
      onClick={handleVideoClick}
    >
      <video
        ref={videoRef}
        poster={poster}
        loop
        muted={isMuted}
        playsInline
        className={styles.videoElement}
      />

      <span className={styles.muteBadge}>
        {isMuted ? t('videoPlayer.tapForSound') : t('videoPlayer.soundOn')}
      </span>

      {onFullscreen && (
        <button
          type="button"
          aria-label={t('videoPlayer.fullscreenVideo')}
          className={styles.fullscreenVideoBtn}
          onClick={(e) => {
            e.stopPropagation(); // Prevents toggling mute when opening fullscreen
            onFullscreen();
          }}
        >
          <Maximize2 size={16} />
        </button>
      )}
    </div>
  );
}
