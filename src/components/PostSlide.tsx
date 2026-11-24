'use client';

import { Heart, MessageCircle, Repeat2 } from 'lucide-react';
import { DitsPost } from '@/lib/bsky';
import VideoPlayer from './VideoPlayer';
import styles from './PostSlide.module.css';

interface PostSlideProps {
  post: DitsPost;
}

export default function PostSlide({ post }: PostSlideProps) {
  return (
    <article className={styles.slide}>
      {/* Contingut multimèdia */}
      {post.mediaType === 'video' && post.video ? (
        <VideoPlayer
          playlist={post.video.playlist}
          poster={post.video.thumbnail}
        />
      ) : (
        <>
          {post.images && post.images.length > 1 && (
            <span className={styles.imageCounter}>
              1 / {post.images.length} (llisca →)
            </span>
          )}
          <div className={styles.horizontalCarousel}>
            {post.images?.map((img, index) => (
              <div key={index} className={styles.carouselItem}>
                <img
                  src={img.fullsize}
                  alt={img.alt || 'Imatge de Bluesky'}
                  className={styles.imageElement}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Ombra inferior */}
      <div className={styles.overlayGradient} />

      {/* Dades de l'autor i text */}
      <div className={styles.postInfo}>
        <div className={styles.authorRow}>
          {post.author.avatar && (
            <img
              src={post.author.avatar}
              alt={post.author.handle}
              className={styles.avatar}
            />
          )}
          <div>
            <div className={styles.authorName}>
              {post.author.displayName || post.author.handle}
            </div>
            <div className={styles.authorHandle}>@{post.author.handle}</div>
          </div>
        </div>
        {post.text && <p className={styles.postText}>{post.text}</p>}
      </div>

      {/* Accions laterals */}
      <div className={styles.actionsBar}>
        <button className={styles.actionButton} aria-label="M'agrada">
          <Heart size={28} />
          <span>{post.likeCount}</span>
        </button>

        <button className={styles.actionButton} aria-label="Comentaris">
          <MessageCircle size={28} />
          <span>{post.replyCount}</span>
        </button>

        <button className={styles.actionButton} aria-label="Republicar">
          <Repeat2 size={28} />
          <span>{post.repostCount}</span>
        </button>
      </div>
    </article>
  );
}
