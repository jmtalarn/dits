'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowLeft, Play, ChevronRight } from 'lucide-react';
import {
  searchActors,
  searchPosts,
  getSavedSession,
  DitsActorSearchResult,
  DitsPost,
} from '@/lib/bsky';
import PostSlide from './PostSlide';
import AuthorProfileModal from './AuthorProfileModal';
import { DitsMiniSpinner } from './DitsLoader';
import styles from './SearchModal.module.css';

interface SearchModalProps {
  onClose: () => void;
}

export default function SearchModal({ onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'posts' | 'people'>('posts');
  const [sort, setSort] = useState<'top' | 'latest'>('top');
  const [actors, setActors] = useState<DitsActorSearchResult[]>([]);
  const [posts, setPosts] = useState<DitsPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedActor, setSelectedActor] = useState<string | null>(null);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const feedScrollRef = useRef<HTMLDivElement | null>(null);
  const session = getSavedSession();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setActors([]);
      setPosts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const [foundActors, foundPosts] = await Promise.all([
          searchActors(trimmed, session),
          searchPosts(trimmed, sort, session),
        ]);
        if (cancelled) return;

        setActors(foundActors);
        setPosts(foundPosts);

        // Auto-switch tab when only one category returns results
        if (foundPosts.length === 0 && foundActors.length > 0) {
          setActiveTab('people');
        } else if (foundActors.length === 0 && foundPosts.length > 0) {
          setActiveTab('posts');
        }
      } catch (err) {
        if (!cancelled) console.error('Search failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, sort, session?.did]);

  useEffect(() => {
    if (selectedPostIndex !== null && feedScrollRef.current) {
      const slideHeight = feedScrollRef.current.clientHeight;
      feedScrollRef.current.scrollTo({
        top: selectedPostIndex * slideHeight,
        behavior: 'instant' as ScrollBehavior,
      });
    }
  }, [selectedPostIndex]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.container} onClick={(e) => e.stopPropagation()}>
        {/* Top Search Bar */}
        <div className={styles.header}>
          <div className={styles.inputWrap}>
            <Search size={17} className={styles.searchIcon} />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Bluesky posts & people..."
              className={styles.input}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className={styles.clearBtn}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button type="button" onClick={onClose} className={styles.cancelBtn}>
            Cancel
          </button>
        </div>

        {/* Result Tabs with Live Counts */}
        {query.trim() && (
          <div className={styles.tabsRow}>
            <button
              type="button"
              onClick={() => setActiveTab('posts')}
              className={activeTab === 'posts' ? styles.tabActive : styles.tabBtn}
            >
              Posts <span className={styles.tabCount}>{posts.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('people')}
              className={activeTab === 'people' ? styles.tabActive : styles.tabBtn}
            >
              People <span className={styles.tabCount}>{actors.length}</span>
            </button>
          </div>
        )}

        {/* Top / Latest Sort Pills (Posts Tab Only) */}
        {query.trim() && activeTab === 'posts' && posts.length > 0 && (
          <div className={styles.sortRow}>
            <button
              type="button"
              onClick={() => setSort('top')}
              className={sort === 'top' ? styles.sortActive : styles.sortBtn}
            >
              Top
            </button>
            <button
              type="button"
              onClick={() => setSort('latest')}
              className={sort === 'latest' ? styles.sortActive : styles.sortBtn}
            >
              Latest
            </button>
          </div>
        )}

        {/* Results Body */}
        <div className={styles.resultsBody}>
          {loading ? (
            <div className={styles.centerState}>
              <DitsMiniSpinner />
            </div>
          ) : !query.trim() ? (
            <div className={styles.emptyState}>
              Search by keyword, #hashtag, or @handle
            </div>
          ) : activeTab === 'posts' ? (
            posts.length > 0 ? (
              <div className={styles.grid}>
                {posts.map((p, idx) => {
                  const firstSlide = p.slides.at(0);
                  const isImage = firstSlide?.type === 'image' && firstSlide.image;
                  const isVideo = firstSlide?.type === 'video' && firstSlide.video;

                  return (
                    <button
                      key={p.uri}
                      type="button"
                      onClick={() => setSelectedPostIndex(idx)}
                      className={styles.gridCell}
                    >
                      {isImage && (
                        <img src={firstSlide.image!.fullsize} alt="" className={styles.gridImg} />
                      )}
                      {isVideo && (
                        <>
                          {firstSlide.video!.thumbnail && (
                            <img
                              src={firstSlide.video!.thumbnail}
                              alt=""
                              className={styles.gridImg}
                            />
                          )}
                          <span className={styles.videoBadge}>
                            <Play size={14} fill="currentColor" />
                          </span>
                        </>
                      )}
                      {!isImage && !isVideo && (
                        <div className={styles.gridTextCard}>
                          <p>{p.text || firstSlide?.quote?.text || 'Post'}</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyState}>No posts found for “{query}”</div>
            )
          ) : actors.length > 0 ? (
            <div className={styles.peopleList}>
              {actors.map((actor) => (
                <button
                  key={actor.did}
                  type="button"
                  onClick={() => setSelectedActor(actor.did)}
                  className={styles.personRow}
                >
                  {actor.avatar ? (
                    <img src={actor.avatar} alt="" className={styles.personAvatar} />
                  ) : (
                    <div className={styles.personAvatarFallback}>
                      {(actor.displayName || actor.handle).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={styles.personMeta}>
                    <span className={styles.personName}>
                      {actor.displayName || actor.handle}
                    </span>
                    <span className={styles.personHandle}>@{actor.handle}</span>
                    {actor.description && (
                      <p className={styles.personBio}>{actor.description}</p>
                    )}
                  </div>
                  <ChevronRight size={18} className={styles.personChevron} />
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>No people found for “{query}”</div>
          )}
        </div>
      </div>

      {/* Full-Screen Vertical Feed Overlay */}
      {selectedPostIndex !== null && (
        <div className={styles.feedOverlay} onClick={(e) => e.stopPropagation()}>
          <header className={styles.feedHeader}>
            <button
              type="button"
              onClick={() => setSelectedPostIndex(null)}
              className={styles.feedBackBtn}
              aria-label="Back to search"
            >
              <ArrowLeft size={18} />
            </button>
            <span className={styles.feedPill}>“{query}”</span>
            <button
              type="button"
              onClick={onClose}
              className={styles.feedBackBtn}
              aria-label="Close search"
            >
              <X size={18} />
            </button>
          </header>

          <div ref={feedScrollRef} className={styles.feedScroll}>
            {posts.map((post) => (
              <PostSlide key={post.uri} post={post} />
            ))}
          </div>
        </div>
      )}

      {/* Nested Creator Profile Sheet */}
      {selectedActor && (
        <AuthorProfileModal actor={selectedActor} onClose={() => setSelectedActor(null)} />
      )}
    </div>
  );
}
