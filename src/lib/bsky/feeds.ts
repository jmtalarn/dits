import { AppBskyEmbedImages, AppBskyFeedDefs, AtpSessionData } from '@atproto/api';
import { authorizedFetch, BSKY_PDS_HOST, BSKY_PUBLIC_API } from './auth';
import { parseFeedItems } from './parser';
import { DitsFeedGenerator, DitsSlideItem } from './types';

const ENDPOINT_AUTHOR_FEED = '/xrpc/app.bsky.feed.getAuthorFeed';
const ENDPOINT_POST_THREAD = '/xrpc/app.bsky.feed.getPostThread';
const ENDPOINT_TIMELINE = '/xrpc/app.bsky.feed.getTimeline';
const ENDPOINT_GET_FEED = '/xrpc/app.bsky.feed.getFeed';
const ENDPOINT_SEARCH_POSTS = '/xrpc/app.bsky.feed.searchPosts';

export const DEFAULT_DISCOVER_FEED: DitsFeedGenerator = {
  uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
  displayName: 'Discover',
  creatorHandle: 'bsky.app',
};

export async function getVisualFeed(cursor?: string) {
  const url = new URL(ENDPOINT_AUTHOR_FEED, BSKY_PUBLIC_API);
  url.searchParams.set('actor', 'did:plc:z72i7hdynmk6r22z27h6tvur');
  url.searchParams.set('limit', '30');
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await authorizedFetch(url.toString(), { headers: { Accept: 'application/json' } }, null);
  if (!res.ok) throw new Error(`Error Bluesky (${res.status})`);

  const data = (await res.json()) as { feed: AppBskyFeedDefs.FeedViewPost[]; cursor?: string };
  return { posts: parseFeedItems(data.feed), cursor: data.cursor };
}

export async function getAuthenticatedFeed(
  session: AtpSessionData,
  mode: 'following' | 'custom',
  feedUri: string = DEFAULT_DISCOVER_FEED.uri,
  cursor?: string
) {
  const endpoint = mode === 'following' ? ENDPOINT_TIMELINE : ENDPOINT_GET_FEED;
  const url = new URL(endpoint, BSKY_PDS_HOST);
  url.searchParams.set('limit', '30');
  if (mode === 'custom') url.searchParams.set('feed', feedUri);
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await authorizedFetch(url.toString(), { headers: { Accept: 'application/json' } }, session);
  if (!res.ok) throw new Error(`Session expired or feed error (${res.status})`);

  const data = (await res.json()) as { feed: AppBskyFeedDefs.FeedViewPost[]; cursor?: string };
  return { posts: parseFeedItems(data.feed), cursor: data.cursor };
}

export async function getQuotedThreadSlides(quoteUri: string): Promise<DitsSlideItem[]> {
  const url = new URL(ENDPOINT_POST_THREAD, BSKY_PUBLIC_API);
  url.searchParams.set('uri', quoteUri);
  url.searchParams.set('depth', '10');
  url.searchParams.set('parentHeight', '0');

  const res = await authorizedFetch(url.toString(), { headers: { Accept: 'application/json' } }, null);
  if (!res.ok) return [];

  const data = await res.json();
  const thread = data.thread;
  if (!thread?.post) return [];

  const rootAuthorDid = thread.post.author.did;
  const threadSlides: DitsSlideItem[] = [];
  let currentNode = thread;

  while (currentNode?.post) {
    const post = currentNode.post;
    const record = post.record as { text?: string };
    const imageUrl = AppBskyEmbedImages.isView(post.embed)
      ? post.embed.images.at(0)?.fullsize
      : undefined;

    threadSlides.push({
      type: 'quote',
      quote: {
        authorName: post.author.displayName || post.author.handle,
        authorHandle: post.author.handle,
        authorAvatar: post.author.avatar,
        text: record.text || '',
        image: imageUrl,
      },
    });

    currentNode = (currentNode.replies || []).find(
      (r: { post?: { author?: { did?: string } } }) => r.post?.author?.did === rootAuthorDid
    );
  }

  return threadSlides;
}

export async function getHashtagFeed(
  tag: string,
  session?: AtpSessionData | null,
  cursor?: string
) {
  const host = session ? BSKY_PDS_HOST : BSKY_PUBLIC_API;
  const url = new URL(ENDPOINT_SEARCH_POSTS, host);
  url.searchParams.set('q', `#${tag.replace(/^#/, '')}`);
  url.searchParams.set('tag', tag.replace(/^#/, ''));
  url.searchParams.set('sort', 'top');
  url.searchParams.set('limit', '25');
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await authorizedFetch(url.toString(), { headers: { Accept: 'application/json' } }, session);
  if (!res.ok) throw new Error('Could not load hashtag feed');

  const data = (await res.json()) as { posts: AppBskyFeedDefs.PostView[]; cursor?: string };
  return {
    posts: parseFeedItems((data.posts || []).map((post) => ({ post }))),
    cursor: data.cursor,
  };
}

export async function getAvailableFeeds(
  session: AtpSessionData
): Promise<{ saved: DitsFeedGenerator[]; popular: DitsFeedGenerator[] }> {
  const headers = { Accept: 'application/json' };
  const prefUrl = new URL('/xrpc/app.bsky.actor.getPreferences', BSKY_PDS_HOST);
  const popUrl = new URL('/xrpc/app.bsky.unspecced.getPopularFeedGenerators', BSKY_PDS_HOST);
  popUrl.searchParams.set('limit', '15');

  const [prefRes, popRes] = await Promise.all([
    authorizedFetch(prefUrl.toString(), { headers }, session),
    authorizedFetch(popUrl.toString(), { headers }, session),
  ]);

  let savedUris: string[] = [];
  if (prefRes.ok) {
    const prefData = await prefRes.json();
    const savedPref = (prefData.preferences || []).find(
      (p: { $type?: string; items?: { type: string; value: string }[] }) =>
        p.$type === 'app.bsky.actor.defs#savedFeedsPrefV2'
    );
    if (savedPref?.items) {
      savedUris = savedPref.items
        .filter((item: { type: string; value: string }) => item.type === 'feed')
        .map((item: { value: string }) => item.value);
    }
  }

  let savedFeeds: DitsFeedGenerator[] = [DEFAULT_DISCOVER_FEED];
  if (savedUris.length > 0) {
    const genUrl = new URL('/xrpc/app.bsky.feed.getFeedGenerators', BSKY_PDS_HOST);
    savedUris.forEach((uri) => genUrl.searchParams.append('feeds', uri));

    const genRes = await authorizedFetch(genUrl.toString(), { headers }, session);
    if (genRes.ok) {
      const genData = await genRes.json();
      const hydrated = (genData.feeds || []).map((f: any) => ({
        uri: f.uri,
        displayName: f.displayName,
        description: f.description,
        avatar: f.avatar,
        creatorHandle: f.creator.handle,
      }));
      if (hydrated.length > 0) savedFeeds = hydrated;
    }
  }

  const popData = popRes.ok ? await popRes.json() : { feeds: [] };
  const popularFeeds: DitsFeedGenerator[] = (popData.feeds || []).map((f: any) => ({
    uri: f.uri,
    displayName: f.displayName,
    description: f.description,
    avatar: f.avatar,
    creatorHandle: f.creator.handle,
  }));

  return { saved: savedFeeds, popular: popularFeeds };
}
