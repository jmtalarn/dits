'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { AtpSessionData } from '@atproto/api';
import {
    getVisualFeed,
    getAuthenticatedFeed,
    getSavedSession,
    logoutSession,
    DitsPost,
} from '@/lib/bsky';
import PostSlide from './PostSlide';
import LoginModal from './LoginModal';
import styles from './FeedContainer.module.css';
import navStyles from './LoginModal.module.css';
import { DitsFullLoader, DitsMiniSpinner } from './DitsLoader';

export default function ClientFeed() {
    const [session, setSession] = useState<AtpSessionData | null>(null);
    const [activeTab, setActiveTab] = useState<'following' | 'discover'>('following');
    const [showLogin, setShowLogin] = useState(false);

    const [posts, setPosts] = useState<DitsPost[]>([]);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const feedRef = useRef<HTMLElement | null>(null);

    // Restore saved session on mount
    useEffect(() => {
        const saved = getSavedSession();
        if (saved) setSession(saved);
    }, []);

    // Initial load whenever session or active tab changes
    useEffect(() => {
        async function loadInitial() {
            setLoading(true);
            setError(null);
            setCursor(undefined);

            try {
                const data = session
                    ? await getAuthenticatedFeed(session, activeTab)
                    : await getVisualFeed();

                setPosts(data.posts);
                setCursor(data.cursor);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error loading feed');
            } finally {
                setLoading(false);
            }
        }
        loadInitial();
    }, [session, activeTab]);

    // Fetch next page using the saved Bluesky cursor
    const loadMore = useCallback(async () => {
        if (loadingMore || !cursor) return;
        setLoadingMore(true);

        try {
            const data = session
                ? await getAuthenticatedFeed(session, activeTab, cursor)
                : await getVisualFeed(cursor);

            setPosts((prev) => {
                const existingUris = new Set(prev.map((p) => p.uri));
                const uniqueNewPosts = data.posts.filter((p) => !existingUris.has(p.uri));
                return [...prev, ...uniqueNewPosts];
            });
            setCursor(data.cursor);
        } catch {
            // Silently ignore background pagination errors so user can retry by scrolling
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, cursor, session, activeTab]);

    // Trigger loadMore when user is within 2 slides of the bottom
    const handleFeedScroll = () => {
        const el = feedRef.current;
        if (!el || loadingMore || !cursor) return;

        const remainingScroll = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (remainingScroll < el.clientHeight * 2) {
            loadMore();
        }
    };

    const handleLogout = () => {
        logoutSession();
        setSession(null);
    };

    return (
        <>
            {/* Top Floating Bar: Feed Tabs + Login/Logout */}
            <header className={navStyles.topBar}>
                {session ? (
                    <div className={navStyles.tabs}>
                        <button
                            type="button"
                            onClick={() => setActiveTab('following')}
                            className={`${navStyles.tabBtn} ${activeTab === 'following' ? navStyles.tabBtnActive : ''}`}
                        >
                            Following
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('discover')}
                            className={`${navStyles.tabBtn} ${activeTab === 'discover' ? navStyles.tabBtnActive : ''}`}
                        >
                            Discover
                        </button>
                    </div>
                ) : (
                    <div className={navStyles.tabs}>
                        <span className={navStyles.tabBtnActive}>Dits · Explore</span>
                    </div>
                )}

                {session ? (
                    <button type="button" onClick={handleLogout} className={navStyles.authBtn}>
                        @{session.handle.split('.').at(0)} · Exit
                    </button>
                ) : (
                    <button type="button" onClick={() => setShowLogin(true)} className={navStyles.authBtn}>
                        Sign in
                    </button>
                )}
            </header>

            {loading ? (
                <DitsFullLoader />
            ) : error ? (
                <div className={styles.feedWrapper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <p>{error}</p>
                </div>
            ) : (
                <main
                    ref={feedRef}
                    onScroll={handleFeedScroll}
                    className={styles.feedWrapper}
                >
                    {posts.map((post) => (
                        <PostSlide key={post.uri} post={post} />
                    ))}

                    {loadingMore && (
                        <div
                            style={{
                                height: '90px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <DitsMiniSpinner />
                        </div>
                    )}
                </main>
            )}

            {showLogin && (
                <LoginModal
                    onSuccess={(newSession) => {
                        setSession(newSession);
                        setShowLogin(false);
                    }}
                    onClose={() => setShowLogin(false)}
                />
            )}
        </>
    );
}
