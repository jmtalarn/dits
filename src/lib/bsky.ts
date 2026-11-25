import {
    Agent,
    AtpSessionData,
    RichText,
    AppBskyRichtextFacet,
    AppBskyEmbedImages,
    AppBskyEmbedVideo,
    AppBskyEmbedRecord,
    AppBskyEmbedRecordWithMedia,
    AppBskyFeedDefs,
    AppBskyEmbedExternal
} from '@atproto/api';

const BSKY_PUBLIC_API = 'https://public.api.bsky.app';
const BSKY_PDS_HOST = 'https://bsky.social';
const ENDPOINT_AUTHOR_FEED = '/xrpc/app.bsky.feed.getAuthorFeed';
const ENDPOINT_POST_THREAD = '/xrpc/app.bsky.feed.getPostThread';
const SESSION_STORAGE_KEY = 'dits_bsky_session';
// const DISCOVER_FEED_URI = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';
const FEATURED_ACTORS = ['did:plc:z72i7hdynmk6r22z27h6tvur']; // bsky.app
// const ENDPOINT_CREATE_SESSION = '/xrpc/com.atproto.server.createSession';
const ENDPOINT_TIMELINE = '/xrpc/app.bsky.feed.getTimeline';
const ENDPOINT_GET_FEED = '/xrpc/app.bsky.feed.getFeed';
const ENDPOINT_SEARCH_POSTS = '/xrpc/app.bsky.feed.searchPosts';


export interface DitsQuoteData {
    uri: string;
    cid: string;
    authorName: string;
    authorHandle: string;
    authorAvatar?: string;
    text: string;
    facets?: AppBskyRichtextFacet.Main[];
    image?: string;
    isReplyContext?: boolean;
}

export interface DitsSlideItem {
    type: 'text' | 'image' | 'video' | 'quote' | 'gif';
    text?: string;
    facets?: AppBskyRichtextFacet.Main[];
    gifUrl?: string;
    image?: {
        fullsize: string;
        alt: string;
    };
    video?: {
        playlist: string;
        thumbnail?: string;
    };
    quote?: {
        authorName: string;
        authorHandle: string;
        authorAvatar?: string;
        text: string;
        facets?: AppBskyRichtextFacet.Main[]; // <-- Add this line
        image?: string;
    };
}

export interface DitsPost {
    uri: string;
    cid: string;
    author: {
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
    };
    text: string;
    facets?: AppBskyRichtextFacet.Main[];
    indexedAt: string;
    likeCount: number;
    replyCount: number;
    repostCount: number;
    viewerLikeUri?: string;    // Present if logged-in user already liked this post
    viewerRepostUri?: string;  // Present if logged-in user already reposted this post
    slides: DitsSlideItem[];
    quotePreview?: DitsQuoteData;
}
function extractGifSlide(embed: unknown): DitsSlideItem | null {
    if (!AppBskyEmbedExternal.isView(embed)) return null;

    const view = embed as AppBskyEmbedExternal.View;
    const rawUri = view.external.uri || '';
    if (!rawUri) return null;

    try {
        const parsed = new URL(rawUri);
        const pathname = parsed.pathname.toLowerCase();
        const isTenorOrGiphy =
            parsed.hostname.includes('tenor.com') || parsed.hostname.includes('giphy.com');
        const isMediaFile =
            pathname.endsWith('.mp4') || pathname.endsWith('.gif') || pathname.endsWith('.webm');

        if (isTenorOrGiphy || isMediaFile) {
            return {
                type: 'gif',
                gifUrl: rawUri,
                image: view.external.thumb
                    ? { fullsize: view.external.thumb, alt: view.external.title || 'GIF' }
                    : undefined,
            };
        }
    } catch {
        return null;
    }

    return null;
}


// 1. Extract the primary slides (text, images, or video) from a post
function extractPrimarySlides(post: AppBskyFeedDefs.PostView): DitsSlideItem[] {
    const record = post.record as { text?: string; facets?: AppBskyRichtextFacet.Main[] };
    const text = record.text || '';
    const facets = record.facets;
    const embed = post.embed;

    // 1. Image gallery
    if (AppBskyEmbedImages.isView(embed)) {
        return embed.images.map((img) => ({
            type: 'image',
            image: { fullsize: img.fullsize, alt: img.alt },
        }));
    }

    // 2. Video
    if (AppBskyEmbedVideo.isView(embed)) {
        return [{
            type: 'video',
            video: { playlist: embed.playlist, thumbnail: embed.thumbnail },
        }];
    }

    // 3. Standalone Tenor / Giphy GIF
    const directGif = extractGifSlide(embed);
    if (directGif) return [directGif];

    // 4. Quote with media (Images, Video, or GIF)
    if (AppBskyEmbedRecordWithMedia.isView(embed)) {
        if (AppBskyEmbedImages.isView(embed.media)) {
            return embed.media.images.map((img) => ({
                type: 'image',
                image: { fullsize: img.fullsize, alt: img.alt },
            }));
        }
        if (AppBskyEmbedVideo.isView(embed.media)) {
            return [{
                type: 'video',
                video: { playlist: embed.media.playlist, thumbnail: embed.media.thumbnail },
            }];
        }
        const quotedGif = extractGifSlide(embed.media);
        if (quotedGif) return [quotedGif];
    }

    // 5. Text-only fallback
    if (text.trim().length > 0) {
        return [{ type: 'text', text, facets }];
    }

    return [];
}

// 2. Build a context slide + teaser from either a Quoted Post OR a Reply Parent
function buildContextFromRecord(
    view: AppBskyEmbedRecord.ViewRecord | AppBskyFeedDefs.PostView,
    isReplyContext = false
): { slide: DitsSlideItem; preview: DitsQuoteData } {
    const isViewRecord = 'value' in view;
    const rawRecord = isViewRecord ? view.value : view.record;
    const record = rawRecord as { text?: string; facets?: AppBskyRichtextFacet.Main[] };
    const embeds = isViewRecord ? view.embeds : view.embed ? [view.embed] : [];


    let image: string | undefined;
    const firstEmbed = embeds?.at(0);
    if (firstEmbed && AppBskyEmbedImages.isView(firstEmbed)) {
        image = firstEmbed.images.at(0)?.fullsize;
    }

    const authorName = view.author.displayName || view.author.handle;
    const text = record.text || '';

    return {
        slide: {
            type: 'quote',
            quote: {
                authorName,
                authorHandle: view.author.handle,
                authorAvatar: view.author.avatar,
                text,
                facets: record.facets,
                image,
            },
        },
        preview: {
            uri: view.uri,
            cid: view.cid,
            authorName,
            authorHandle: view.author.handle,
            authorAvatar: view.author.avatar,
            text,
            facets: record.facets,
            image,
            isReplyContext,
        },
    };
}

function extractContextSlide(
    item: AppBskyFeedDefs.FeedViewPost
): { slide: DitsSlideItem; preview: DitsQuoteData } | null {
    const embed = item.post.embed;

    // Priority 1: Quoted post
    if (AppBskyEmbedRecord.isView(embed) && AppBskyEmbedRecord.isViewRecord(embed.record)) {
        return buildContextFromRecord(embed.record, false);
    }
    if (
        AppBskyEmbedRecordWithMedia.isView(embed) &&
        AppBskyEmbedRecord.isViewRecord(embed.record.record)
    ) {
        return buildContextFromRecord(embed.record.record, false);
    }

    // Priority 2: Parent post when this item is a reply
    if (item.reply && AppBskyFeedDefs.isPostView(item.reply.parent)) {
        return buildContextFromRecord(item.reply.parent, true);
    }

    return null;
}

// 3. Clean, readable coordinator
function parseFeedItems(feed: AppBskyFeedDefs.FeedViewPost[]): DitsPost[] {
    const seenUris = new Set<string>();
    const ditsPosts: DitsPost[] = [];

    for (const item of feed) {
        const post = item.post;
        if (seenUris.has(post.uri)) continue;
        seenUris.add(post.uri);

        const slides = extractPrimarySlides(post);
        const context = extractContextSlide(item);

        if (context) {
            slides.push(context.slide);
        }

        if (slides.length === 0) continue;

        const record = post.record as { text?: string; facets?: AppBskyRichtextFacet.Main[] };

        ditsPosts.push({
            uri: post.uri,
            cid: post.cid,
            author: {
                did: post.author.did,
                handle: post.author.handle,
                displayName: post.author.displayName,
                avatar: post.author.avatar,
            },
            text: record.text || '',
            facets: record.facets,
            indexedAt: post.indexedAt,
            likeCount: post.likeCount || 0,
            replyCount: post.replyCount || 0,
            repostCount: post.repostCount || 0,
            viewerLikeUri: post.viewer?.like,
            viewerRepostUri: post.viewer?.repost,
            slides,
            quotePreview: context?.preview,
        });
    }

    return ditsPosts;
}



export async function getVisualFeed(cursor?: string) {
    const actor = FEATURED_ACTORS.at(0) || 'did:plc:z72i7hdynmk6r22z27h6tvur';
    const url = new URL(ENDPOINT_AUTHOR_FEED, BSKY_PUBLIC_API);
    url.searchParams.set('actor', actor);
    url.searchParams.set('limit', '30');
    if (cursor) {
        url.searchParams.set('cursor', cursor);
    }

    const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
        throw new Error(`Error Bluesky (${res.status})`);
    }

    const data = (await res.json()) as {
        feed: AppBskyFeedDefs.FeedViewPost[];
        cursor?: string;
    };

    return {
        posts: parseFeedItems(data.feed),
        cursor: data.cursor,
    };
}


// Fetches consecutive self-replies of a quoted post so swiping expands the full thread
export async function getQuotedThreadSlides(
    quoteUri: string
): Promise<DitsSlideItem[]> {
    const url = new URL(ENDPOINT_POST_THREAD, BSKY_PUBLIC_API);
    url.searchParams.set('uri', quoteUri);
    url.searchParams.set('depth', '10');
    url.searchParams.set('parentHeight', '0');

    const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const thread = data.thread;
    if (!thread?.post) return [];

    const rootAuthorDid = thread.post.author.did;
    const threadSlides: DitsSlideItem[] = [];

    let currentNode = thread;
    while (currentNode && currentNode.post) {
        const post = currentNode.post;
        const record = post.record as { text?: string };
        const embed = post.embed;

        let imageUrl: string | undefined;
        if (AppBskyEmbedImages.isView(embed)) {
            imageUrl = embed.images.at(0)?.fullsize;
        }

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

        const nextAuthorReply = (currentNode.replies || []).find(
            (r: { post?: { author?: { did?: string } } }) =>
                r.post?.author?.did === rootAuthorDid
        );

        currentNode = nextAuthorReply;
    }

    return threadSlides;
}

// Log in using Handle + App Password (https://bsky.app)
export async function loginWithAppPassword(identifier: string, password: string) {
    const res = await fetch(`${BSKY_PDS_HOST}/xrpc/com.atproto.server.createSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            identifier: identifier.replace(/^@/, '').trim(),
            password: password.trim(),
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Invalid handle or App Password');
    }

    const session: AtpSessionData = await res.json();
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return session;
}

export function getSavedSession(): AtpSessionData | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AtpSessionData) : null;
}

export function logoutSession() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
}
let activeRefreshPromise: Promise<AtpSessionData | null> | null = null;

// Exchange the stored refreshJwt for a fresh accessJwt + refreshJwt pair
export async function refreshStoredSession(
    currentSession: AtpSessionData
): Promise<AtpSessionData | null> {
    // Deduplicate concurrent refresh calls if multiple requests fail at the same millisecond
    if (activeRefreshPromise) return activeRefreshPromise;

    activeRefreshPromise = (async () => {
        try {
            const res = await fetch(`${BSKY_PDS_HOST}/xrpc/com.atproto.server.refreshSession`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${currentSession.refreshJwt}`,
                },
            });

            if (!res.ok) {
                // Refresh token itself expired or was revoked -> clear session
                logoutSession();
                window.dispatchEvent(new Event('dits-session-expired'));
                return null;
            }

            const data = await res.json();
            const updatedSession: AtpSessionData = {
                ...currentSession,
                accessJwt: data.accessJwt,
                refreshJwt: data.refreshJwt,
                handle: data.handle || currentSession.handle,
                did: data.did || currentSession.did,
            };

            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedSession));
            window.dispatchEvent(new CustomEvent('dits-session-updated', { detail: updatedSession }));
            return updatedSession;
        } catch {
            return null;
        } finally {
            activeRefreshPromise = null;
        }
    })();

    return activeRefreshPromise;
}

// Drop-in replacement for authenticated fetch() that silently refreshes expired tokens and retries once
export async function authorizedFetch(
    url: string,
    init: RequestInit = {},
    explicitSession?: AtpSessionData | null
): Promise<Response> {
    const session = explicitSession ?? getSavedSession();

    // If no user is logged in, behave just like normal fetch()
    if (!session) {
        return fetch(url, init);
    }

    const makeRequest = (token: string) =>
        fetch(url, {
            ...init,
            headers: {
                ...init.headers,
                Authorization: `Bearer ${token}`,
            },
        });

    let res = await makeRequest(session.accessJwt);

    if (res.status === 400 || res.status === 401) {
        const cloned = res.clone();
        const errBody = await cloned.json().catch(() => ({}));

        if (res.status === 401 || errBody?.error === 'ExpiredToken') {
            const refreshed = await refreshStoredSession(session);
            if (refreshed) {
                res = await makeRequest(refreshed.accessJwt);
            }
        }
    }

    return res;
}

export interface DitsComment {
    uri: string;
    cid: string;
    authorName: string;
    authorHandle: string;
    authorAvatar?: string;
    text: string;
    facets?: AppBskyRichtextFacet.Main[];
    indexedAt: string;
    likeCount: number;
}

// Fetch replies (comments) for a specific post
export async function getPostComments(postUri: string): Promise<DitsComment[]> {
    const url = new URL('/xrpc/app.bsky.feed.getPostThread', BSKY_PUBLIC_API);
    url.searchParams.set('uri', postUri);
    url.searchParams.set('depth', '2');
    url.searchParams.set('parentHeight', '0');

    const res = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const replies = data.thread?.replies || [];
    const comments: DitsComment[] = [];

    for (const item of replies) {
        const p = item.post;
        if (!p) continue;
        const record = p.record as { text?: string; facets?: AppBskyRichtextFacet.Main[] };

        comments.push({
            uri: p.uri,
            cid: p.cid,
            authorName: p.author.displayName || p.author.handle,
            authorHandle: p.author.handle,
            authorAvatar: p.author.avatar,
            text: record.text || '',
            indexedAt: p.indexedAt,
            facets: record.facets,
            likeCount: p.likeCount || 0,
        });
    }

    return comments;
}

// Publish a new reply (comment) using the logged-in session
// Publish a new reply (comment) with auto-detected links, mentions, and hashtags
export async function postComment(
    session: AtpSessionData,
    rootPost: { uri: string; cid: string },
    text: string
) {
    const rt = new RichText({ text: text.trim() });
    await rt.detectFacets(new Agent(BSKY_PUBLIC_API));

    const res = await authorizedFetch(
        `${BSKY_PDS_HOST}/xrpc/com.atproto.repo.createRecord`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                repo: session.did,
                collection: 'app.bsky.feed.post',
                record: {
                    $type: 'app.bsky.feed.post',
                    text: rt.text,
                    facets: rt.facets,
                    createdAt: new Date().toISOString(),
                    reply: {
                        root: { uri: rootPost.uri, cid: rootPost.cid },
                        parent: { uri: rootPost.uri, cid: rootPost.cid },
                    },
                },
            }),
        }, session
    );

    if (!res.ok) {
        throw new Error('Failed to post comment');
    }

    const created = await res.json();
    return {
        ...created,
        facets: rt.facets, // Returned so optimistic UI in CommentsDrawer renders clickable links immediately
    };
}

// Create or delete a Like / Repost record on Bluesky
export async function toggleReaction(
    session: AtpSessionData,
    collection: 'app.bsky.feed.like' | 'app.bsky.feed.repost',
    subject: { uri: string; cid: string },
    existingRecordUri?: string
): Promise<string | undefined> {
    // If already liked/reposted, delete the existing record using its rkey (last segment of URI)
    if (existingRecordUri) {
        const rkey = existingRecordUri.split('/').pop();
        const res = await authorizedFetch(`${BSKY_PDS_HOST}/xrpc/com.atproto.repo.deleteRecord`,  {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.accessJwt}`,
            },
            body: JSON.stringify({
                repo: session.did,
                collection,
                rkey,
            }),
        }, session);

        if (!res.ok) throw new Error('Failed to remove reaction');
        return undefined;
    }

    // Otherwise, create a new like or repost record
    const res = await authorizedFetch(`${BSKY_PDS_HOST}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
            repo: session.did,
            collection,
            record: {
                $type: collection,
                subject: { uri: subject.uri, cid: subject.cid },
                createdAt: new Date().toISOString(),
            },
        }),
    }, session);

    if (!res.ok) throw new Error('Failed to add reaction');
    const data = (await res.json()) as { uri: string };
    return data.uri;
}

export async function createDitsPost(
    session: AtpSessionData,
    text: string,
    imageFiles: File[] = []
): Promise<DitsPost> {
    const uploadedImages: { alt: string; image: unknown }[] = [];
    const localPreviews: { fullsize: string; alt: string }[] = [];

    // 1. Upload any attached images as blobs first
    for (const file of imageFiles.slice(0, 4)) {
        const uploadRes = await authorizedFetch(`${BSKY_PDS_HOST}/xrpc/com.atproto.repo.uploadBlob`, {
            method: 'POST',
            headers: {
                'Content-Type': file.type || 'image/jpeg',
                Authorization: `Bearer ${session.accessJwt}`,
            },
            body: file,
        }, session);

        if (!uploadRes.ok) {
            throw new Error(`Failed to upload image: ${file.name}`);
        }

        const uploadData = await uploadRes.json();
        uploadedImages.push({
            alt: '',
            image: uploadData.blob,
        });
        localPreviews.push({
            fullsize: URL.createObjectURL(file),
            alt: file.name,
        });
    }

    // 2. Build the AT Protocol post record
    const rt = new RichText({ text: text.trim() });
    await rt.detectFacets(new Agent(BSKY_PUBLIC_API));

    const record: Record<string, unknown> = {
        $type: 'app.bsky.feed.post',
        text: rt.text,
        facets: rt.facets,
        createdAt: new Date().toISOString(),
    };

    if (uploadedImages.length > 0) {
        record.embed = {
            $type: 'app.bsky.embed.images',
            images: uploadedImages,
        };
    }

    const res = await authorizedFetch(`${BSKY_PDS_HOST}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
            repo: session.did,
            collection: 'app.bsky.feed.post',
            record,
        }),
    }, session);

    if (!res.ok) {
        throw new Error('Failed to publish post');
    }

    const created = (await res.json()) as { uri: string; cid: string };

    // Build slides for immediate optimistic insertion into Dits
    const slides: DitsSlideItem[] =
        localPreviews.length > 0
            ? localPreviews.map((img) => ({ type: 'image', image: img }))
            : [{ type: 'text', text: text.trim() }];

    return {
        uri: created.uri,
        cid: created.cid,
        author: {
            did: session.did,
            handle: session.handle,
            displayName: session.handle,
        },
        text: text.trim(),
        indexedAt: new Date().toISOString(),
        likeCount: 0,
        replyCount: 0,
        repostCount: 0,
        slides,
    };
}

export interface DitsProfile {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
    banner?: string;
    description?: string;
    followersCount: number;
    followsCount: number;
    postsCount: number;
    viewerFollowUri?: string;
}

export async function getActorProfile(
  actor: string,
  session?: AtpSessionData | null
): Promise<{ profile: DitsProfile; posts: DitsPost[] }> {
  const host = session ? BSKY_PDS_HOST : BSKY_PUBLIC_API;
  const headers = { Accept: 'application/json' };

  const profileUrl = new URL('/xrpc/app.bsky.actor.getProfile', host);
  profileUrl.searchParams.set('actor', actor);

  const feedUrl = new URL(ENDPOINT_AUTHOR_FEED, host);
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
        const res = await fetch(`${BSKY_PDS_HOST}/xrpc/com.atproto.repo.deleteRecord`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.accessJwt}`,
            },
            body: JSON.stringify({
                repo: session.did,
                collection: 'app.bsky.graph.follow',
                rkey,
            }),
        });
        if (!res.ok) throw new Error('Failed to unfollow');
        return undefined;
    }

    const res = await fetch(`${BSKY_PDS_HOST}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
            repo: session.did,
            collection: 'app.bsky.graph.follow',
            record: {
                $type: 'app.bsky.graph.follow',
                subject: targetDid,
                createdAt: new Date().toISOString(),
            },
        }),
    });

    if (!res.ok) throw new Error('Failed to follow');
    const data = (await res.json()) as { uri: string };
    return data.uri;
}

// Fetch posts matching a specific #hashtag (sorted by top or latest)
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
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }

  const res = await authorizedFetch(
    url.toString(),
    { headers: { Accept: 'application/json' } },
    session
  );
  if (!res.ok) throw new Error('Could not load hashtag feed');

  const data = (await res.json()) as {
    posts: AppBskyFeedDefs.PostView[];
    cursor?: string;
  };

  const wrappedFeed = (data.posts || []).map((post) => ({ post }));

  return {
    posts: parseFeedItems(wrappedFeed),
    cursor: data.cursor,
  };
}

export async function getMyAvatar(session: AtpSessionData): Promise<string | undefined> {
    const url = new URL('/xrpc/app.bsky.actor.getProfile', BSKY_PDS_HOST);
    url.searchParams.set('actor', session.did);

    const res = await authorizedFetch(url.toString(), { headers: { Accept: 'application/json' } }, session);
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.avatar;
}

export interface DitsFeedGenerator {
    uri: string;
    displayName: string;
    description?: string;
    avatar?: string;
    creatorHandle: string;
}

export const DEFAULT_DISCOVER_FEED: DitsFeedGenerator = {
    uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
    displayName: 'Discover',
    creatorHandle: 'bsky.app',
};

// Fetch the logged-in user's saved/pinned feeds + popular Bluesky feeds
export async function getAvailableFeeds(
    session: AtpSessionData
): Promise<{ saved: DitsFeedGenerator[]; popular: DitsFeedGenerator[] }> {
    const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${session.accessJwt}`,
    };

    // 1. Get user preferences to extract saved feed URIs
    const prefUrl = new URL('/xrpc/app.bsky.actor.getPreferences', BSKY_PDS_HOST);
    const popUrl = new URL('/xrpc/app.bsky.unspecced.getPopularFeedGenerators', BSKY_PDS_HOST);
    popUrl.searchParams.set('limit', '15');

    const [prefRes, popRes] = await Promise.all([
        authorizedFetch(prefUrl.toString(), { headers: { Accept: 'application/json' } }),
        authorizedFetch(popUrl.toString(), { headers: { Accept: 'application/json' } }),
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

    // 2. Hydrate metadata (name, avatar, description) for saved feed URIs
    let savedFeeds: DitsFeedGenerator[] = [DEFAULT_DISCOVER_FEED];
    if (savedUris.length > 0) {
        const genUrl = new URL('/xrpc/app.bsky.feed.getFeedGenerators', BSKY_PDS_HOST);
        savedUris.forEach((uri) => genUrl.searchParams.append('feeds', uri));

        const genRes = await fetch(genUrl.toString(), { headers });
        if (genRes.ok) {
            const genData = await genRes.json();
            const hydrated = (genData.feeds || []).map(
                (f: {
                    uri: string;
                    displayName: string;
                    description?: string;
                    avatar?: string;
                    creator: { handle: string };
                }) => ({
                    uri: f.uri,
                    displayName: f.displayName,
                    description: f.description,
                    avatar: f.avatar,
                    creatorHandle: f.creator.handle,
                })
            );
            if (hydrated.length > 0) savedFeeds = hydrated;
        }
    }

    // 3. Map popular feeds
    const popData = popRes.ok ? await popRes.json() : { feeds: [] };
    const popularFeeds: DitsFeedGenerator[] = (popData.feeds || []).map(
        (f: {
            uri: string;
            displayName: string;
            description?: string;
            avatar?: string;
            creator: { handle: string };
        }) => ({
            uri: f.uri,
            displayName: f.displayName,
            description: f.description,
            avatar: f.avatar,
            creatorHandle: f.creator.handle,
        })
    );

    return { saved: savedFeeds, popular: popularFeeds };
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

    if (mode === 'custom') {
        url.searchParams.set('feed', feedUri);
    }
    if (cursor) {
        url.searchParams.set('cursor', cursor);
    }

    const res = await authorizedFetch(url.toString(),  {
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${session.accessJwt}`,
        },
    }, session);

    if (!res.ok) {
        throw new Error(`Session expired or feed error (${res.status})`);
    }

    const data = (await res.json()) as {
        feed: AppBskyFeedDefs.FeedViewPost[];
        cursor?: string;
    };

    return {
        posts: parseFeedItems(data.feed),
        cursor: data.cursor,
    };
}
