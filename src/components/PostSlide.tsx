'use client';

import { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Repeat2 } from 'lucide-react';
import { DitsPost, DitsSlideItem, getQuotedThreadSlides } from '@/lib/bsky';
import SlideCard from './SlideCard';
import styles from './PostSlide.module.css';

export default function PostSlide({ post }: { post: DitsPost }) {
  const [slides, setSlides] = useState<DitsSlideItem[]>(post.slides);
  const [activeSlide, setActiveSlide] = useState(0);
  const [threadLoaded, setThreadLoaded] = useState(false);

  const carouselRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);

  useEffect(() => {
    if (activeSlide === 1 && post.quotePreview?.uri && !threadLoaded) {
      setThreadLoaded(true);
      getQuotedThreadSlides(post.quotePreview.uri).then((threadSlides) => {
        if (threadSlides.length > 1) {
          setSlides((prev) => (prev.at(0) ? [prev.at(0)!, ...threadSlides] : prev));
        }
      });
    }
  }, [activeSlide, post.quotePreview?.uri, threadLoaded]);

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const width = carouselRef.current.clientWidth;
    if (width > 0) setActiveSlide(Math.round(carouselRef.current.scrollLeft / width));
  };

  const goToSlide = (index: number) => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollTo({ left: index * carouselRef.current.clientWidth, behavior: 'smooth' });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!carouselRef.current || slides.length <= 1) return;
    isDragging.current = true;
    startX.current = e.pageX - carouselRef.current.offsetLeft;
    scrollLeftStart.current = carouselRef.current.scrollLeft;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !carouselRef.current) return;
    e.preventDefault();
    const walk = (e.pageX - carouselRef.current.offsetLeft - startX.current) * 1.5;
    carouselRef.current.scrollLeft = scrollLeftStart.current - walk;
  };

  // Switch the big bottom author dynamically when swiping into a quoted post
  const currentSlide = slides.at(activeSlide);
  const activeAuthor =
    currentSlide?.type === 'quote' && currentSlide.quote
      ? {
          name: currentSlide.quote.authorName,
          handle: currentSlide.quote.authorHandle,
          avatar: currentSlide.quote.authorAvatar,
        }
      : {
          name: post.author.displayName || post.author.handle,
          handle: post.author.handle,
          avatar: post.author.avatar,
        };

  return (
    <article className={styles.slide}>
      {slides.length > 1 && (
        <div className={styles.progressBars}>
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => goToSlide(idx)}
              className={`${styles.progressSegment} ${idx === activeSlide ? styles.progressSegmentActive : ''}`}
            />
          ))}
        </div>
      )}

      {slides.length > 1 && activeSlide < slides.length - 1 && (
        <button type="button" onClick={() => goToSlide(activeSlide + 1)} className={styles.swipeHint}>
          {slides.at(activeSlide + 1)?.type === 'quote' ? 'See quote →' : `${activeSlide + 1}/${slides.length} →`}
        </button>
      )}

      {slides.length > 1 && activeSlide > 0 && (
        <button type="button" onClick={() => goToSlide(activeSlide - 1)} className={styles.swipeBackHint}>
          ← Back
        </button>
      )}

      <div
        ref={carouselRef}
        onScroll={handleScroll}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={() => (isDragging.current = false)}
        onMouseLeave={() => (isDragging.current = false)}
        className={styles.horizontalCarousel}
      >
        {slides.map((slide, index) => (
          <div key={index} className={styles.carouselItem}>
            <SlideCard slide={slide} index={index} post={post} onGoToQuote={() => goToSlide(1)} />
          </div>
        ))}
      </div>

      {/* Big Bottom Footer: Author on Left, Actions on Right */}
      <div className={styles.bottomFooter}>
        <div className={styles.authorRow}>
          {activeAuthor.avatar && (
            <img src={activeAuthor.avatar} alt={activeAuthor.handle} className={styles.avatarLarge} />
          )}
          <div className={styles.authorMeta}>
            <span className={styles.authorNameLarge}>{activeAuthor.name}</span>
            <span className={styles.authorHandle}>@{activeAuthor.handle}</span>
          </div>
        </div>

        <div className={styles.actionsRow}>
          <button type="button" className={styles.actionButton} aria-label="Like">
            <Heart size={20} />
            <span>{post.likeCount}</span>
          </button>
          <button type="button" className={styles.actionButton} aria-label="Comments">
            <MessageCircle size={20} />
            <span>{post.replyCount}</span>
          </button>
          <button type="button" className={styles.actionButton} aria-label="Repost">
            <Repeat2 size={20} />
            <span>{post.repostCount}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
