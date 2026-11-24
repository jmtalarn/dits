'use client';

import { useEffect, useState } from 'react';
import { getVisualFeed, DitsPost } from '@/lib/bsky';
import PostSlide from './PostSlide';
import styles from './FeedContainer.module.css';

export default function ClientFeed() {
  const [posts, setPosts] = useState<DitsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getVisualFeed();
        setPosts(data.posts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconegut');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className={styles.feedWrapper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Carregant Dits...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.feedWrapper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
        <p>No s&apos;ha pogut carregar el feed: {error}</p>
      </div>
    );
  }

  return (
    <main className={styles.feedWrapper}>
      {posts.map((post) => (
        <PostSlide key={post.uri} post={post} />
      ))}
    </main>
  );
}
