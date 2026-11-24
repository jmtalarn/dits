import { Suspense } from 'react';
import { getVisualFeed } from '@/lib/bsky';
import PostSlide from '@/components/PostSlide';
import styles from '@/components/FeedContainer.module.css';

// Component intern que fa la petició a Bluesky
async function FeedList() {
  const { posts } = await getVisualFeed();

  return (
    <>
      {posts.map((post) => (
        <PostSlide key={post.uri} post={post} />
      ))}
    </>
  );
}

// Pantalla de càrrega instantània mentre arriba el feed
function FeedLoading() {
  return (
    <div style={{
      height: '100dvh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000',
      color: '#fff',
      fontSize: '16px'
    }}>
      Carregant Dits...
    </div>
  );
}

export default function HomePage() {
  return (
    <main className={styles.feedWrapper}>
      <Suspense fallback={<FeedLoading />}>
        <FeedList />
      </Suspense>
    </main>
  );
}
