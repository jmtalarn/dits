import {
    AppBskyEmbedImages,
    AppBskyEmbedVideo,
    AppBskyEmbedRecord,
    AppBskyEmbedRecordWithMedia,
    AppBskyFeedDefs,
} from '@atproto/api';

const BSKY_PUBLIC_API = 'https://public.api.bsky.app';
const ENDPOINT_AUTHOR_FEED = '/xrpc/app.bsky.feed.getAuthorFeed';
const ENDPOINT_POST_THREAD = '/xrpc/app.bsky.feed.getPostThread';

const FEATURED_ACTORS = ['did:plc:z72i7hdynmk6r22z27h6tvur']; // bsky.app

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
