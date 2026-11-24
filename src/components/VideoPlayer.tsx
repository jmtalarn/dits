'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import styles from './PostSlide.module.css';

interface VideoPlayerProps {
  playlist: string;
  poster?: string;
}

export default function VideoPlayer({ playlist, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(playlist);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Suport natiu a Safari / iOS
      video.src = playlist;
    }

    // Reproducció automàtica només quan el vídeo és visible a la pantalla
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {
              // El navegador pot bloquejar autoplay si no està mutat
            });
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.6 } // S'activa quan es veu almenys el 60% del vídeo
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      if (hls) {
        hls.destroy();
      }
    };
  }, [playlist]);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className={styles.mediaWrapper} onClick={toggleMute}>
      <video
        ref={videoRef}
        poster={poster}
        loop
        muted={isMuted}
        playsInline
        className={styles.videoElement}
      />
      <span className={styles.muteBadge}>
        {isMuted ? '🔇 Toca per activar so' : '🔊 So activat'}
      </span>
    </div>
  );
}
