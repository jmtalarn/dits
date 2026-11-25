'use client';

import { useEffect, useState } from 'react';
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

export default function ClientFeed() {
  const [session, setSession] = useState<AtpSessionData | null>(null);
  const [activeTab, setActiveTab] = useState<'following' | 'discover'>('following');
  const [showLogin, setShowLogin] = useState(false);

  const [posts, setPosts] = useState<DitsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore saved session on mount
  useEffect(() => {
    const saved = getSavedSession();
    if (saved) setSession(saved);
  }, []);

  // Load either authenticated feed or public preview feed
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (session) {
          const data = await getAuthenticatedFeed(session, activeTab);
          setPosts(data.posts);
        } else {
          const data = await getVisualFeed();
          setPosts(data.posts);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading feed');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session, activeTab]);

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
        <div className={styles.feedWrapper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Loading Dits...</p>
        </div>
      ) : error ? (
        <div className={styles.feedWrapper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <p>{error}</p>
        </div>
      ) : (
        <main className={styles.feedWrapper}>
          {posts.map((post) => (
            <PostSlide key={post.uri} post={post} />
          ))}
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
