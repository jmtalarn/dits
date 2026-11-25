import {
    AppBskyEmbedImages,
    AppBskyEmbedVideo,
    AppBskyEmbedRecord,
    AppBskyEmbedRecordWithMedia,
    AppBskyFeedDefs,
    Agent, AtpSessionData
} from '@atproto/api';

const BSKY_PUBLIC_API = 'https://public.api.bsky.app';
const BSKY_PDS_HOST = 'https://bsky.social';
const ENDPOINT_AUTHOR_FEED = '/xrpc/app.bsky.feed.getAuthorFeed';
const ENDPOINT_POST_THREAD = '/xrpc/app.bsky.feed.getPostThread';
const SESSION_STORAGE_KEY = 'dits_bsky_session';
const DISCOVER_FEED_URI = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';
const FEATURED_ACTORS = ['did:plc:z72i7hdynmk6r22z27h6tvur']; // bsky.app
const ENDPOINT_CREATE_SESSION = '/xrpc/com.atproto.server.createSession';
const ENDPOINT_TIMELINE = '/xrpc/app.bsky.feed.getTimeline';
const ENDPOINT_GET_FEED = '/xrpc/app.bsky.feed.getFeed';

export interface DitsQuoteData {
    uri: string;
    cid: string;
    authorName: string;
    authorHandle: string;
    authorAvatar?: string;
    text: string;
    image?: string;
}

export interface DitsSlideItem {
    type: 'text' | 'image' | 'video' | 'quote';
    text?: string;
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
    indexedAt: string;
    likeCount: number;
    replyCount: number;
    repostCount: number;
    viewerLikeUri?: string;    // Present if logged-in user already liked this post
    viewerRepostUri?: string;  // Present if logged-in user already reposted this post
    slides: DitsSlideItem[];
    quotePreview?: DitsQuoteData;
}

// Extracts both the full Slide 2 item and the Slide 1 mini-teaser data
function extractQuoteData(recordView: unknown): {
    slide: DitsSlideItem;
    preview: DitsQuoteData;
} | null {
    if (!AppBskyEmbedRecord.isViewRecord(recordView)) return null;

    const view = recordView as AppBskyEmbedRecord.ViewRecord;
    const value = view.value as { text?: string };
    let quoteImage: string | undefined;

    const firstEmbed = view.embeds?.at(0);
    if (firstEmbed && AppBskyEmbedImages.isView(firstEmbed)) {
        quoteImage = firstEmbed.images.at(0)?.fullsize;
    }

    const authorName = view.author.displayName || view.author.handle;
    const authorHandle = view.author.handle;
    const authorAvatar = view.author.avatar;
    const text = value.text || '';

    return {
        slide: {
            type: 'quote',
            quote: {
                authorName,
                authorHandle,
                authorAvatar,
                text,
                image: quoteImage,
            },
        },
        preview: {
            uri: view.uri,
            cid: view.cid,
            authorName,
            authorHandle,
            authorAvatar,
            text,
            image: quoteImage,
        },
    };
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
        headers: {
            Accept: 'application/json',
        },
    });

    if (!res.ok) {
        throw new Error(`Error Bluesky (${res.status})`);
    }

    const data = (await res.json()) as {
        feed: AppBskyFeedDefs.FeedViewPost[];
        cursor?: string;
    };

    const ditsPosts: DitsPost[] = [];

    for (const item of data.feed) {
        const post = item.post;
        const record = post.record as { text?: string };
        const embed = post.embed;
        const postText = record.text || '';
        const slides: DitsSlideItem[] = [];
        let quotePreview: DitsQuoteData | undefined;

        // CASE 1: Text-only post
        if (!embed && postText.trim().length > 0) {
            slides.push({
                type: 'text',
                text: postText,
            });
        }
        // CASE 2: Image gallery
        else if (AppBskyEmbedImages.isView(embed)) {
            embed.images.forEach((img) => {
                slides.push({
                    type: 'image',
                    image: { fullsize: img.fullsize, alt: img.alt },
                });
            });
        }
        // CASE 3: Video post
        else if (AppBskyEmbedVideo.isView(embed)) {
            slides.push({
                type: 'video',
                video: { playlist: embed.playlist, thumbnail: embed.thumbnail },
            });
        }
        // CASE 4: Quote post (Repost with comment)
        else if (AppBskyEmbedRecord.isView(embed)) {
            if (postText.trim().length > 0) {
                slides.push({
                    type: 'text',
                    text: postText,
                });
            }
            const extracted = extractQuoteData(embed.record);
            if (extracted) {
                slides.push(extracted.slide);
                quotePreview = extracted.preview;
            }
        }
        // CASE 5: Quote post + Media (Image or Video)
        else if (AppBskyEmbedRecordWithMedia.isView(embed)) {
            if (AppBskyEmbedImages.isView(embed.media)) {
                embed.media.images.forEach((img) => {
                    slides.push({
                        type: 'image',
                        image: { fullsize: img.fullsize, alt: img.alt },
                    });
                });
            } else if (AppBskyEmbedVideo.isView(embed.media)) {
                slides.push({
                    type: 'video',
                    video: {
                        playlist: embed.media.playlist,
                        thumbnail: embed.media.thumbnail,
                    },
                });
            }
            const extracted = extractQuoteData(embed.record.record);
            if (extracted) {
                slides.push(extracted.slide);
                quotePreview = extracted.preview;
            }
        }

        if (slides.length > 0) {
            ditsPosts.push({
                uri: post.uri,
                cid: post.cid,
                author: {
                    did: post.author.did,
                    handle: post.author.handle,
                    displayName: post.author.displayName,
                    avatar: post.author.avatar,
                },
                text: postText,
                indexedAt: post.indexedAt,
                likeCount: post.likeCount || 0,
                replyCount: post.replyCount || 0,
                repostCount: post.repostCount || 0,
                viewerLikeUri: post.viewer?.like,
                viewerRepostUri: post.viewer?.repost,
                slides,
                quotePreview,
            });
        }
    }

    return {
        posts: ditsPosts,
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
// Shared parser to turn raw Bluesky FeedViewPost items into DitsPost[]
function parseFeedItems(feed: AppBskyFeedDefs.FeedViewPost[]): DitsPost[] {
    const ditsPosts: DitsPost[] = [];

    for (const item of feed) {
        const post = item.post;
        const record = post.record as { text?: string };
        const embed = post.embed;
        const postText = record.text || '';
        const slides: DitsSlideItem[] = [];
        let quotePreview: DitsQuoteData | undefined;

        if (!embed && postText.trim().length > 0) {
            slides.push({ type: 'text', text: postText });
        } else if (AppBskyEmbedImages.isView(embed)) {
            embed.images.forEach((img) => {
                slides.push({ type: 'image', image: { fullsize: img.fullsize, alt: img.alt } });
            });
        } else if (AppBskyEmbedVideo.isView(embed)) {
            slides.push({
                type: 'video',
                video: { playlist: embed.playlist, thumbnail: embed.thumbnail },
            });
        } else if (AppBskyEmbedRecord.isView(embed)) {
            if (postText.trim().length > 0) slides.push({ type: 'text', text: postText });
            const extracted = extractQuoteData(embed.record);
            if (extracted) {
                slides.push(extracted.slide);
                quotePreview = extracted.preview;
            }
        } else if (AppBskyEmbedRecordWithMedia.isView(embed)) {
            if (AppBskyEmbedImages.isView(embed.media)) {
                embed.media.images.forEach((img) => {
                    slides.push({ type: 'image', image: { fullsize: img.fullsize, alt: img.alt } });
                });
            } else if (AppBskyEmbedVideo.isView(embed.media)) {
                slides.push({
                    type: 'video',
                    video: { playlist: embed.media.playlist, thumbnail: embed.media.thumbnail },
                });
            }
            const extracted = extractQuoteData(embed.record.record);
            if (extracted) {
                slides.push(extracted.slide);
                quotePreview = extracted.preview;
            }
        }

        if (slides.length > 0) {
            ditsPosts.push({
                uri: post.uri,
                cid: post.cid,
                author: {
                    did: post.author.did,
                    handle: post.author.handle,
                    displayName: post.author.displayName,
                    avatar: post.author.avatar,
                },
                text: postText,
                indexedAt: post.indexedAt,
                likeCount: post.likeCount || 0,
                replyCount: post.replyCount || 0,
                repostCount: post.repostCount || 0,
                viewerLikeUri: post.viewer?.like,
                viewerRepostUri: post.viewer?.repost,
                slides,
                quotePreview,
            });
        }
    }

    return ditsPosts;
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

// Fetch Authenticated Timeline ("Following") or Discover Feed
export async function getAuthenticatedFeed(
    session: AtpSessionData,
    tab: 'following' | 'discover',
    cursor?: string
) {
    const endpoint = tab === 'following' ? ENDPOINT_TIMELINE : ENDPOINT_GET_FEED;
    const url = new URL(endpoint, BSKY_PDS_HOST);
    url.searchParams.set('limit', '30');
    if (tab === 'discover') {
        url.searchParams.set('feed', DISCOVER_FEED_URI);
    }
    if (cursor) {
        url.searchParams.set('cursor', cursor);
    }

    const res = await fetch(url.toString(), {
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${session.accessJwt}`,
        },
    });

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

export interface DitsComment {
    uri: string;
    cid: string;
    authorName: string;
    authorHandle: string;
    authorAvatar?: string;
    text: string;
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
        const record = p.record as { text?: string };

        comments.push({
            uri: p.uri,
            cid: p.cid,
            authorName: p.author.displayName || p.author.handle,
            authorHandle: p.author.handle,
            authorAvatar: p.author.avatar,
            text: record.text || '',
            indexedAt: p.indexedAt,
            likeCount: p.likeCount || 0,
        });
    }

    return comments;
}

// Publish a new reply (comment) using the logged-in session
export async function postComment(
    session: AtpSessionData,
    rootPost: { uri: string; cid: string },
    text: string
) {
    const res = await fetch(`${BSKY_PDS_HOST}/xrpc/com.atproto.repo.createRecord`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessJwt}`,
        },
        body: JSON.stringify({
            repo: session.did,
            collection: 'app.bsky.feed.post',
            record: {
                $type: 'app.bsky.feed.post',
                text: text.trim(),
                createdAt: new Date().toISOString(),
                reply: {
                    root: { uri: rootPost.uri, cid: rootPost.cid },
                    parent: { uri: rootPost.uri, cid: rootPost.cid },
                },
            },
        }),
    });

    if (!res.ok) {
        throw new Error('Failed to post comment');
    }

    return res.json();
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
    const res = await fetch(`${BSKY_PDS_HOST}/xrpc/com.atproto.repo.deleteRecord`, {
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
    });

    if (!res.ok) throw new Error('Failed to remove reaction');
    return undefined;
  }

  // Otherwise, create a new like or repost record
  const res = await fetch(`${BSKY_PDS_HOST}/xrpc/com.atproto.repo.createRecord`, {
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
  });

  if (!res.ok) throw new Error('Failed to add reaction');
  const data = (await res.json()) as { uri: string };
  return data.uri;
}
