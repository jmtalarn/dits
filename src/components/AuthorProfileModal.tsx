'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Play, ArrowLeft } from 'lucide-react';
import {
  getActorProfile,
  toggleFollowActor,
  getSavedSession,
  DitsProfile,
  DitsPost,
} from '@/lib/bsky';
import PostSlide from './PostSlide';
import { DitsMiniSpinner } from './DitsLoader';
import styles from './AuthorProfileModal.module.css';

interface AuthorProfileModalProps {
  actor: string;
  onClose: () => void;
}

export default function AuthorProfileModal({ actor, onClose }: AuthorProfileModalProps) {
  const [profile, setProfile] = useState<DitsProfile | null>(null);
  const [posts, setPosts] = useState<DitsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [followUri, setFollowUri] = useState<string | undefined>(undefined);
  const [followersCount, setFollowersCount] = useState(0);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);

  const feedScrollRef = useRef<HTMLDivElement | null>(null);
  const session = getSavedSession();

  useEffect(() => {
    getActorProfile(actor, session)
      .then((data) => {
        setProfile(data.profile);
        setPosts(data.posts);
        setFollowUri(data.profile.viewerFollowUri);
        setFollowersCount(data.profile.followersCount);
      })
      .finally(() => setLoading(false));
  }, [actor]);

  // Jump straight to the tapped post once the full-screen feed opens
  useEffect(() => {
    if (selectedPostIndex !== null && feedScrollRef.current) {
      const slideHeight = feedScrollRef.current.clientHeight;
      feedScrollRef.current.scrollTo({
        top: selectedPostIndex * slideHeight,
        behavior: 'instant' as ScrollBehavior,
      });
    }
  }, [selectedPostIndex]);

  const handleToggleFollow = async () => {
    if (!session || !profile) return alert('Sign in to follow creators');

    const prevUri = followUri;
    const prevCount = followersCount;
    const isFollowing = Boolean(prevUri);

    setFollowUri(isFollowing ? undefined : 'pending');
    setFollowersCount(isFollowing ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const newUri = await toggleFollowActor(
        session,
        profile.did,
        prevUri === 'pending' ? undefined : prevUri
      );
      setFollowUri(newUri);
    } catch {
      setFollowUri(prevUri);
      setFollowersCount(prevCount);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
          <X size={18} />
        </button>

        {loading || !profile ? (
          <div className={styles.loadingState}>
            <DitsMiniSpinner />
          </div>
        ) : (
          <div className={styles.scrollBody}>
            <div className={styles.banner}>
              {profile.banner && <img src={profile.banner} alt="" className={styles.bannerImg} />}
            </div>

            <div className={styles.profileHeader}>
              {profile.avatar && (
                <img src={profile.avatar} alt={profile.handle} className={styles.avatar} />
              )}

              {session && session.did !== profile.did && (
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  className={followUri ? styles.followingBtn : styles.followBtn}
                >
                  {followUri ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            <div className={styles.bioSection}>
              <h2 className={styles.displayName}>{profile.displayName || profile.handle}</h2>
              <span className={styles.handle}>@{profile.handle}</span>
              {profile.description && <p className={styles.bio}>{profile.description}</p>}

              <div className={styles.statsRow}>
                <span>
                  <strong>{followersCount.toLocaleString()}</strong> Followers
                </span>
                <span>
                  <strong>{profile.followsCount.toLocaleString()}</strong> Following
                </span>
                <span>
                  <strong>{profile.postsCount.toLocaleString()}</strong> Posts
                </span>
              </div>
            </div>

            {/* Tappable 3-Column Visual Grid */}
            <div className={styles.grid}>
              {posts.map((p, idx) => {
                const firstSlide = p.slides.at(0);
                return (
                  <button
                    key={p.uri}
                    type="button"
                    onClick={() => setSelectedPostIndex(idx)}
                    className={styles.gridCell}
                  >
                    {firstSlide?.type === 'image' && firstSlide.image && (
                      <img src={firstSlide.image.fullsize} alt="" className={styles.gridImg} />
                    )}
                    {firstSlide?.type === 'video' && firstSlide.video && (
                      <>
                        {firstSlide.video.thumbnail && (
                          <img src={firstSlide.video.thumbnail} alt="" className={styles.gridImg} />
                        )}
                        <span className={styles.videoBadge}>
                          <Play size={14} fill="currentColor" />
                        </span>
                      </>
                    )}
                    {(firstSlide?.type === 'text' || firstSlide?.type === 'quote') && (
                      <div className={styles.gridTextCard}>
                        <p>{p.text}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Full-Screen Creator Feed starting at the tapped post */}
      {selectedPostIndex !== null && profile && (
        <div className={styles.authorFeedOverlay} onClick={(e) => e.stopPropagation()}>
          <header className={styles.authorFeedHeader}>
            <button
              type="button"
              onClick={() => setSelectedPostIndex(null)}
              className={styles.authorFeedBackBtn}
              aria-label="Back to profile"
            >
              <ArrowLeft size={18} />
            </button>
            <span className={styles.authorFeedPill}>@{profile.handle}</span>
            <button
              type="button"
              onClick={onClose}
              className={styles.authorFeedBackBtn}
              aria-label="Close profile"
            >
              <X size={18} />
            </button>
          </header>

          <div ref={feedScrollRef} className={styles.authorFeedScroll}>
            {posts.map((post) => (
              <PostSlide key={post.uri} post={post} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
