import { AtpSessionData, AppBskyFeedDefs } from "@atproto/api";
import { BSKY_PDS_HOST, BSKY_PUBLIC_API, authorizedFetch } from "./auth";
import { parseFeedItems } from "./parser";
import { DitsActorSearchResult, DitsPost } from "./types";

export async function searchActors(
  query: string,
  session?: AtpSessionData | null
): Promise<DitsActorSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const host = session ? BSKY_PDS_HOST : BSKY_PUBLIC_API;
  const url = new URL('/xrpc/app.bsky.actor.searchActorsTypeahead', host);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '8');

  const res = await authorizedFetch(url.toString(), { headers: { Accept: 'application/json' } }, session);
  if (!res.ok) return [];

  const data = await res.json();
  return (data.actors || []).map((a: DitsActorSearchResult) => ({
    did: a.did,
    handle: a.handle,
    displayName: a.displayName,
    avatar: a.avatar,
    description: a.description,
  }));
}

export async function searchPosts(
  query: string,
  sort: 'top' | 'latest' = 'top',
  session?: AtpSessionData | null
): Promise<DitsPost[]> {
  const q = query.trim();
  if (!q) return [];

  const host = session ? BSKY_PDS_HOST : BSKY_PUBLIC_API;
  const url = new URL('/xrpc/app.bsky.feed.searchPosts', host);
  url.searchParams.set('q', q);
  url.searchParams.set('sort', sort);
  url.searchParams.set('limit', '25');

  const res = await authorizedFetch(url.toString(), { headers: { Accept: 'application/json' } }, session);
  if (!res.ok) return [];

  const data = await res.json();
  // searchPosts returns PostView[], wrap each into FeedViewPost shape for parseFeedItems
  const wrappedFeed = (data.posts || []).map((post: AppBskyFeedDefs.PostView) => ({
    post,
  }));

  return parseFeedItems(wrappedFeed, { ignoreGlobalSeen: true });
}