import { Agent, AppBskyEmbedImages, AppBskyEmbedVideo } from '@atproto/api';

// Endpoint públic oficial (funciona sempre per a getAuthorFeed i getPostThread)
const publicAgent = new Agent('https://public.api.bsky.app');

// Comptes públics amb molt contingut visual (imatges i vídeos) per al mode sense login
const FEATURED_VISUAL_ACTORS = [
  'bsky.app',
];

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
  mediaType: 'images' | 'video';
  images?: {
    thumb: string;
    fullsize: string;
    alt: string;
  }[];
  video?: {
    playlist: string;
    thumbnail?: string;
    aspectRatio?: { width: number; height: number };
  };
}

export async function getVisualFeed(cursor?: string) {
  // Demanem els posts amb multimèdia (filter: 'posts_with_media') d'un compte públic
  const response = await publicAgent.app.bsky.feed.getAuthorFeed({
    actor: FEATURED_VISUAL_ACTORS[0],
    filter: 'posts_with_media',
    limit: 30,
    cursor,
  });

  const visualPosts: DitsPost[] = [];

  for (const item of response.data.feed) {
    const post = item.post;
    const record = post.record as { text?: string };
    const embed = post.embed;

    if (AppBskyEmbedImages.isView(embed)) {
      visualPosts.push({
        uri: post.uri,
        cid: post.cid,
        author: {
          did: post.author.did,
          handle: post.author.handle,
          displayName: post.author.displayName,
          avatar: post.author.avatar,
        },
        text: record.text || '',
        indexedAt: post.indexedAt,
        likeCount: post.likeCount || 0,
        replyCount: post.replyCount || 0,
        repostCount: post.repostCount || 0,
        mediaType: 'images',
        images: embed.images.map((img) => ({
          thumb: img.thumb,
          fullsize: img.fullsize,
          alt: img.alt,
        })),
      });
    } else if (AppBskyEmbedVideo.isView(embed)) {
      visualPosts.push({
        uri: post.uri,
        cid: post.cid,
        author: {
          did: post.author.did,
          handle: post.author.handle,
          displayName: post.author.displayName,
          avatar: post.author.avatar,
        },
        text: record.text || '',
        indexedAt: post.indexedAt,
        likeCount: post.likeCount || 0,
        replyCount: post.replyCount || 0,
        repostCount: post.repostCount || 0,
        mediaType: 'video',
        video: {
          playlist: embed.playlist,
          thumbnail: embed.thumbnail,
          aspectRatio: embed.aspectRatio,
        },
      });
    }
  }

  return {
    posts: visualPosts,
    cursor: response.data.cursor,
  };
}
