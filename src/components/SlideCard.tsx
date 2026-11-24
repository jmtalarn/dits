'use client';

import { useState, useRef } from 'react';
import { Maximize2 } from 'lucide-react';
import { DitsPost, DitsSlideItem } from '@/lib/bsky';
import VideoPlayer from './VideoPlayer';
import QuoteTeaser from './QuoteTeaser';
import MediaLightbox from './MediaLightbox';
import styles from './PostSlide.module.css';

interface SlideCardProps {
  slide: DitsSlideItem;
  index: number;
  post: DitsPost;
  onGoToQuote: () => void;
}

export default function SlideCard({ slide, index, post, onGoToQuote }: SlideCardProps) {
  const [fullscreenMedia, setFullscreenMedia] = useState<{
    imageUrl?: string;
    altText?: string;
    video?: { playlist: string; thumbnail?: string };
  } | null>(null);

  const pointerStartX = useRef(0);

  const hasText = post.text.trim().length > 0;
  const showTeaser = index === 0 && Boolean(post.quotePreview);

  const getTextClass = (text?: string, isMediaCaption = false) => {
    const len = text?.length || 0;
    if (!isMediaCaption && len <= 110) return styles.textLarge;
    if (len <= 210) return styles.textMedium;
    return styles.textCompact;
  };

  const handleImageClick = (imageUrl: string, altText?: string, endX?: number) => {
    if (endX !== undefined && Math.abs(endX - pointerStartX.current) > 8) return;
    setFullscreenMedia({ imageUrl, altText });
  };

  return (
    <>
      <div className={styles.unifiedCard}>
        {/* 1. TEXT SLIDE */}
        {slide.type === 'text' && (
          <div className={styles.textOnlyBody}>
            <p className={getTextClass(slide.text)}>{slide.text}</p>
            {showTeaser && post.quotePreview && (
              <QuoteTeaser quote={post.quotePreview} onSelect={onGoToQuote} />
            )}
          </div>
        )}

        {/* 2. IMAGE OR VIDEO SLIDE */}
        {(slide.type === 'image' || slide.type === 'video') && (
          <>
            <div className={`${styles.cardMediaBox} ${!hasText && !showTeaser ? styles.cardMediaBoxFull : ''}`}>
              {slide.type === 'image' && slide.image && (
                <>
                  <img
                    src={slide.image.fullsize}
                    alt={slide.image.alt || 'Image'}
                    className={styles.imageElement}
                    draggable={false}
                    loading="lazy"
                    onPointerDown={(e) => (pointerStartX.current = e.clientX)}
                    onClick={(e) => handleImageClick(slide.image!.fullsize, slide.image!.alt, e.clientX)}
                  />
                  <button
                    type="button"
                    aria-label="Expand image"
                    className={styles.fullscreenVideoBtn}
                    onClick={() => setFullscreenMedia({ imageUrl: slide.image!.fullsize, altText: slide.image!.alt })}
                  >
                    <Maximize2 size={16} />
                  </button>
                </>
              )}
              {slide.type === 'video' && slide.video && (
                <VideoPlayer
                  playlist={slide.video.playlist}
                  poster={slide.video.thumbnail}
                  onFullscreen={() => setFullscreenMedia({ video: slide.video })}
                />
              )}
            </div>
            {(hasText || showTeaser) && (
              <div className={styles.cardCaptionBody}>
                {hasText && <p className={getTextClass(post.text, true)}>{post.text}</p>}
                {showTeaser && post.quotePreview && (
                  <QuoteTeaser quote={post.quotePreview} onSelect={onGoToQuote} />
                )}
              </div>
            )}
          </>
        )}

        {/* 3. QUOTE / THREAD SLIDE */}
        {slide.type === 'quote' && slide.quote && (
          <>
            <div className={styles.quotedByHeader}>
              {post.author.avatar && (
                <img src={post.author.avatar} alt={post.author.handle} className={styles.quotedByAvatar} />
              )}
              <span>
                Quoted by <strong>@{post.author.handle}</strong>
                {index > 1 ? ` · Part ${index}` : ''}
              </span>
            </div>

            {slide.quote.image && (
              <div className={`${styles.cardMediaBox} ${!slide.quote.text ? styles.cardMediaBoxFull : ''}`}>
                <img
                  src={slide.quote.image}
                  alt="Quoted media"
                  className={styles.imageElement}
                  draggable={false}
                  onPointerDown={(e) => (pointerStartX.current = e.clientX)}
                  onClick={(e) => handleImageClick(slide.quote!.image!, undefined, e.clientX)}
                />
                <button
                  type="button"
                  aria-label="Expand quoted image"
                  className={styles.fullscreenVideoBtn}
                  onClick={() => setFullscreenMedia({ imageUrl: slide.quote!.image! })}
                >
                  <Maximize2 size={16} />
                </button>
              </div>
            )}

            {slide.quote.text && (
              <div className={slide.quote.image ? styles.cardCaptionBody : styles.textOnlyBody}>
                <p className={getTextClass(slide.quote.text, Boolean(slide.quote.image))}>
                  {slide.quote.text}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {fullscreenMedia && (
        <MediaLightbox
          imageUrl={fullscreenMedia.imageUrl}
          altText={fullscreenMedia.altText}
          video={fullscreenMedia.video}
          onClose={() => setFullscreenMedia(null)}
        />
      )}
    </>
  );
}
