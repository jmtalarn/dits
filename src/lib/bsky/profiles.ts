import { AtpSessionData } from '@atproto/api';
import { authorizedFetch, BSKY_PDS_HOST, BSKY_PUBLIC_API } from './auth';
import { parseFeedItems } from './parser';
import { DitsPost, DitsProfile } from './types';

export async function getActorProfile(
  actor: string,
  session?: AtpSessionData | null
): Promise<{ profile: DitsProfile; posts: DitsPost[] }> {
  const host = session ? BSKY_PDS_HOST : BSKY_PUBLIC_API;
  const headers = { Accept: 'application/json' };

  const profileUrl = new URL('/xrpc/app.bsky.actor.getProfile', host);
  profileUrl.searchParams.set('actor', actor);

  const feedUrl = new URL('/xrpc/app.bsky.feed.getAuthorFeed', host);
  feedUrl.searchParams.set('actor', actor);
  feedUrl.searchParams.set('filter', 'posts_no_replies');
  feedUrl.searchParams.set('limit', '30');

  const [profileRes, feedRes] = await Promise.all([
    authorizedFetch(profileUrl.toString(), { headers }, session),
    authorizedFetch(feedUrl.toString(), { headers }, session),
  ]);

  if (!profileRes.ok) throw new Error('Could not load profile');
  const p = await profileRes.json();
  const feedData = feedRes.ok ? await feedRes.json() : { feed: [] };

  return {
    profile: {
      did: p.did,
      handle: p.handle,
      displayName: p.displayName,
      avatar: p.avatar,
      banner: p.banner,
      description: p.description,
      followersCount: p.followersCount || 0,
      followsCount: p.followsCount || 0,
      postsCount: p.postsCount || 0,
      viewerFollowUri: p.viewer?.following,
    },
    posts: parseFeedItems(feedData.feed || []),
  };
}

export async function toggleFollowActor(
  session: AtpSessionData,
  targetDid: string,
  existingFollowUri?: string
): Promise<string | undefined> {
  if (existingFollowUri) {
    const rkey = existingFollowUri.split('/').pop();
    const res = await authorizedFetch(
      `${BSKY_PDS_HOST}/xrpc/com.atproto.repo.deleteRecord`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: session.did, collection: 'app.bsky.graph.follow', rkey }),
      },
      session
    );
    if (!res.ok) throw new Error('Failed to unfollow');
    return undefined;
  }

  const res = await authorizedFetch(
    `${BSKY_PDS_HOST}/xrpc/com.atproto.repo.createRecord`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: session.did,
        collection: 'app.bsky.graph.follow',
        record: {
          $type: 'app.bsky.graph.follow',
          subject: targetDid,
          createdAt: new Date().toISOString(),
        },
      }),
    },
    session
  );

  if (!res.ok) throw new Error('Failed to follow');
  const data = (await res.json()) as { uri: string };
  return data.uri;
}

export async function getMyAvatar(session: AtpSessionData): Promise<string | undefined> {
  const url = new URL('/xrpc/app.bsky.actor.getProfile', BSKY_PDS_HOST);
  url.searchParams.set('actor', session.did);

  const res = await authorizedFetch(url.toString(), { headers: { Accept: 'application/json' } }, session);
  if (!res.ok) return undefined;
  const data = await res.json();
  return data.avatar;
}
