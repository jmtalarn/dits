'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, User, LogOut, Shield } from 'lucide-react';
import { AtpSessionData } from '@atproto/api';
import {
    getVisualFeed,
    getAuthenticatedFeed,
    getSavedSession,
    logoutSession,
    getMyAvatar,
    DEFAULT_DISCOVER_FEED,
    DitsFeedGenerator,
    DitsPost,
    markThreadUrisSeen,
} from '@/lib/bsky';
import PostSlide from './PostSlide';
import LoginModal from './LoginModal';
import ComposerModal from './ComposerModal';
import AuthorProfileModal from './AuthorProfileModal';
import { DitsFullLoader, DitsMiniSpinner } from './DitsLoader';
import styles from './FeedContainer.module.css';
import FeedPickerModal from './FeedPickerModal';
import { resetSeenThreads } from '@/lib/bsky';
import ContentFilterModal from './ContentFilterModal';

const FEED_CACHE_KEY = 'dits_feed_cache_v2';

interface CachedFeedState {
    tab: 'following' | 'custom';
    feedUri: string;
    posts: DitsPost[];
    cursor?: string;
    scrollTop: number;
}

export default function ClientFeed() {
    const [session, setSession] = useState<AtpSessionData | null>(null);
    const [sessionChecked, setSessionChecked] = useState(false);
    const [myAvatar, setMyAvatar] = useState<string | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<'following' | 'custom'>('following');
    const [selectedFeed, setSelectedFeed] = useState<DitsFeedGenerator>(DEFAULT_DISCOVER_FEED);
    const [showFeedPicker, setShowFeedPicker] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [filterVersion, setFilterVersion] = useState(0);

    const [showLogin, setShowLogin] = useState(false);
    const [showComposer, setShowComposer] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showMyProfile, setShowMyProfile] = useState(false);

    const [posts, setPosts] = useState<DitsPost[]>([]);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const feedRef = useRef<HTMLElement | null>(null);

    // Restore saved session & fetch user avatar
    useEffect(() => {
        const saved = getSavedSession();
        if (saved) {
            setSession(saved);
            getMyAvatar(saved).then(setMyAvatar);
        }
        setSessionChecked(true);
    }, []);
    
    const saveFeedCache = useCallback(
        (currentPosts: DitsPost[], currentCursor?: string, currentScroll = 0) => {
            const payload: CachedFeedState = {
                tab: activeTab,
                feedUri: selectedFeed.uri,
                posts: currentPosts.slice(0, 60),
                cursor: currentCursor,
                scrollTop: currentScroll,
            };
            sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(payload));
        },
        [activeTab, selectedFeed.uri]
    );

    // Load feed whenever session or active tab changes
    useEffect(() => {
        if (!sessionChecked) return;

        let cancelled = false;

        async function loadInitial() {
            // Check if we have a cached feed for this exact tab & feedUri
            const rawCache = sessionStorage.getItem(FEED_CACHE_KEY);
            if (rawCache) {
                try {
                    const cached = JSON.parse(rawCache) as CachedFeedState;
                    if (
                        cached.tab === activeTab &&
                        cached.feedUri === selectedFeed.uri &&
                        cached.posts.length > 0
                    ) {
                        resetSeenThreads();
                        markThreadUrisSeen(cached.posts.map((p) => p.uri));
                        
                        setPosts(cached.posts);
                        setCursor(cached.cursor);
                        setLoading(false);

                        // Restore exact vertical scroll position after DOM paints
                        requestAnimationFrame(() => {
                            if (feedRef.current) {
                                feedRef.current.scrollTop = cached.scrollTop;
                            }
                        });
                        return;
                    }
                } catch {
                    // Ignore malformed cache and fetch fresh
                }
            }
            // Otherwise fetch fresh posts from Bluesky
            resetSeenThreads();
            setLoading(true);
            setError(null);
            setCursor(undefined);

            try {
                const data = session
                    ? await getAuthenticatedFeed(session, activeTab, selectedFeed.uri)
                    : await getVisualFeed();

                if (!cancelled) {
                    setPosts(data.posts);
                    setCursor(data.cursor);
                    saveFeedCache(data.posts, data.cursor, 0);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Error loading feed');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadInitial();
        return () => {
            cancelled = true;
        };
    }, [sessionChecked, session, activeTab, selectedFeed.uri, filterVersion, saveFeedCache]);

    const loadMore = useCallback(async () => {
        if (loadingMore || !cursor) return;
        setLoadingMore(true);

        try {
            const data = session
                ? await getAuthenticatedFeed(session, activeTab, selectedFeed.uri, cursor)
                : await getVisualFeed(cursor);


            setPosts((prev) => {
                const existingUris = new Set(prev.map((p) => p.uri));
                const uniqueNewPosts = data.posts.filter((p) => !existingUris.has(p.uri));
                const updated = [...prev, ...uniqueNewPosts];
                saveFeedCache(updated, data.cursor, feedRef.current?.scrollTop || 0);
                return updated;
            });
            setCursor(data.cursor);
        } catch {
            // Ignore background pagination errors
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, cursor, session, activeTab, selectedFeed.uri]);
   

   
    // Trigger loadMore AND save your current scroll position
    const handleFeedScroll = () => {
        const el = feedRef.current;
        if (!el) return;

        // 1. Save current position to sessionStorage
        saveFeedCache(posts, cursor, el.scrollTop);

        // 2. Load next page if within 2 slides of the bottom
        if (!loadingMore && cursor) {
        if (el.scrollHeight - el.scrollTop - el.clientHeight < el.clientHeight * 2) {
            loadMore();
        }
        }
    };

    const handleLogout = () => {
        logoutSession();
        setSession(null);
        setMyAvatar(undefined);
        setShowMenu(false);
    };

    return (
        <>
            {/* Redesigned 3-Slot Top Navigation Bar */}
            <header className={styles.topBar}>
                {/* Left Slot: Profile Avatar Menu (or Brand Mark when logged out) */}
                {session ? (
                    <div className={styles.profileMenuWrapper}>
                        <button
                            type="button"
                            onClick={() => setShowMenu((prev) => !prev)}
                            className={styles.avatarBtn}
                            aria-label="Account menu"
                        >
                            {myAvatar ? (
                                <img src={myAvatar} alt={session.handle} className={styles.navAvatarImg} />
                            ) : (
                                <User size={18} />
                            )}
                        </button>

                        {showMenu && (
                            <div className={styles.dropdownMenu}>
                                <div className={styles.dropdownHeader}>@{session.handle}</div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowMenu(false);
                                        setShowMyProfile(true);
                                    }}
                                    className={styles.dropdownItem}
                                >
                                    <User size={15} />
                                    <span>My Profile</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowMenu(false);
                                        setShowFilters(true);
                                    }}
                                    className={styles.dropdownItem}
                                >
                                    <Shield size={15} />
                                    <span>Content Filters</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className={styles.dropdownItemDanger}
                                >
                                    <LogOut size={15} />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <span className={styles.brandPill}>dits</span>
                )}

                {/* Center Slot: Segmented Feed Switcher */}
                {session ? (
                    <div className={styles.tabs}>
                        <button
                            type="button"
                            onClick={() => setActiveTab('following')}
                            className={`${styles.tabBtn} ${activeTab === 'following' ? styles.tabBtnActive : ''}`}
                        >
                            Following
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (activeTab === 'custom') {
                                    setShowFeedPicker(true);
                                } else {
                                    setActiveTab('custom');
                                }
                            }}
                            className={`${styles.tabBtn} ${activeTab === 'custom' ? styles.tabBtnActive : ''}`}
                        >
                            {selectedFeed.displayName} ▾
                        </button>
                    </div>
                ) : (
                    <span className={styles.brandPill}>Explore</span>
                )}

                {/* Right Slot: + Compose Button (or Sign In) */}
                {session ? (
                    <button
                        type="button"
                        onClick={() => setShowComposer(true)}
                        aria-label="New post"
                        className={styles.composeBtn}
                    >
                        <Plus size={20} strokeWidth={2.5} />
                    </button>
                ) : (
                    <button type="button" onClick={() => setShowLogin(true)} className={styles.authBtn}>
                        Sign in
                    </button>
                )}
            </header>

            {loading ? (
                <DitsFullLoader />
            ) : error ? (
                <div className={styles.centeredState}>
                    <p>{error}</p>
                </div>
            ) : (
                <main
                    ref={feedRef}
                    onScroll={handleFeedScroll}
                    onClick={() => showMenu && setShowMenu(false)}
                    className={styles.feedWrapper}
                >
                    {posts.map((post) => (
                        <PostSlide key={post.uri} post={post} />
                    ))}

                    {loadingMore && (
                        <div className={styles.loadMoreRow}>
                            <DitsMiniSpinner />
                        </div>
                    )}
                </main>
            )}

            {showLogin && (
                <LoginModal
                    onSuccess={(newSession) => {
                        setSession(newSession);
                        getMyAvatar(newSession).then(setMyAvatar);
                        setShowLogin(false);
                    }}
                    onClose={() => setShowLogin(false)}
                />
            )}

            {session && showComposer && (
                <ComposerModal
                    session={session}
                    onPostCreated={(newPost) => {
                        setPosts((prev) => [newPost, ...prev]);
                        setShowComposer(false);
                        feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onClose={() => setShowComposer(false)}
                />
            )}

            {session && showMyProfile && (
                <AuthorProfileModal
                    actor={session.did}
                    onClose={() => setShowMyProfile(false)}
                />
            )}
            {session && showFeedPicker && (
                <FeedPickerModal
                    session={session}
                    selectedUri={selectedFeed.uri}
                    onSelectFeed={(feed) => {
                        setSelectedFeed(feed);
                        setActiveTab('custom');
                        setShowFeedPicker(false);
                    }}
                    onClose={() => setShowFeedPicker(false)}
                />
            )}
            {showFilters && (
                <ContentFilterModal
                    onClose={() => {
                        setShowFilters(false);
                        sessionStorage.removeItem(FEED_CACHE_KEY);
                        setFilterVersion((v) => v + 1);
                    }}
                />
            )}
        </>
    );
}
