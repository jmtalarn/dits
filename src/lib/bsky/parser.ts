import {
  AppBskyEmbedExternal,
  AppBskyEmbedImages,
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyEmbedVideo,
  AppBskyFeedDefs,
  AppBskyRichtextFacet,
} from '@atproto/api';
import { getNsfwFilterConfig, isNsfwItem } from './moderation';
import { DitsExternalLink, DitsPost, DitsQuoteData, DitsSlideItem } from './types';
import { getMutedWords, matchesMutedWords } from '../bsky';

const globalSeenThreadUris = new Set<string>();

export function resetSeenThreads(): void {
  globalSeenThreadUris.clear();
}

export function markThreadUrisSeen(uris: string[]): void {
  for (const uri of uris) {
    globalSeenThreadUris.add(uri);
  }
}

const HIDE_REPOSTS_KEY = 'dits_hide_reposts_v1';

export function getHideReposts(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(HIDE_REPOSTS_KEY) === 'true';
}

export function setHideReposts(hide: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HIDE_REPOSTS_KEY, String(hide));
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

function extractExternalLink(embed: unknown): DitsExternalLink | undefined {
  if (extractGifSlide(embed)) return undefined;

  let externalObj: AppBskyEmbedExternal.ViewExternal | undefined;
  if (AppBskyEmbedExternal.isView(embed)) {
    externalObj = (embed as AppBskyEmbedExternal.View).external;
  } else if (AppBskyEmbedRecordWithMedia.isView(embed)) {
    const rwm = embed as AppBskyEmbedRecordWithMedia.View;
    if (AppBskyEmbedExternal.isView(rwm.media)) {
      externalObj = (rwm.media as AppBskyEmbedExternal.View).external;
    }
  }

  if (!externalObj?.uri) return undefined;

  let domain = externalObj.uri;
  try {
    domain = new URL(externalObj.uri).hostname.replace(/^www\./, '');
  } catch {
    // Keep raw URI
  }

  return {
    uri: externalObj.uri,
    title: externalObj.title || domain,
    description: externalObj.description || '',
    thumb: externalObj.thumb,
    domain,
  };
}

function extractPrimarySlides(post: AppBskyFeedDefs.PostView): DitsSlideItem[] {
  const record = post.record as { text?: string; facets?: AppBskyRichtextFacet.Main[] };
  const text = record.text || '';
  const facets = record.facets;
  const embed = post.embed;

  if (AppBskyEmbedImages.isView(embed)) {
    return embed.images.map((img) => ({
      type: 'image',
      image: { fullsize: img.fullsize, alt: img.alt },
    }));
  }

  if (AppBskyEmbedVideo.isView(embed)) {
    return [{
      type: 'video',
      video: { playlist: embed.playlist, thumbnail: embed.thumbnail },
    }];
  }

  const directGif = extractGifSlide(embed);
  if (directGif) return [directGif];

  if (AppBskyEmbedRecordWithMedia.isView(embed)) {
    const rwm = embed as AppBskyEmbedRecordWithMedia.View;
    if (AppBskyEmbedImages.isView(rwm.media)) {
      return rwm.media.images.map((img) => ({
        type: 'image',
        image: { fullsize: img.fullsize, alt: img.alt },
      }));
    }
    if (AppBskyEmbedVideo.isView(rwm.media)) {
      return [{
        type: 'video',
        video: { playlist: rwm.media.playlist, thumbnail: rwm.media.thumbnail },
      }];
    }
    const quotedGif = extractGifSlide(rwm.media);
    if (quotedGif) return [quotedGif];
  }

  if (text.trim().length > 0 || extractExternalLink(embed)) {
    return [{ type: 'text', text, facets }];
  }

  return [];
}

// 1st function buildContextFromRecord(
//   view: AppBskyEmbedRecord.ViewRecord | AppBskyFeedDefs.PostView,
//   isReplyContext = false
// ): { slide: DitsSlideItem; preview: DitsQuoteData } {
//   const isViewRecord = 'value' in view;
//   const rawRecord = isViewRecord ? view.value : view.record;
//   const record = rawRecord as { text?: string; facets?: AppBskyRichtextFacet.Main[] };
//   const embeds = isViewRecord ? view.embeds : view.embed ? [view.embed] : [];

//   let image: string | undefined;
//   const firstEmbed = embeds?.at(0);
//   if (firstEmbed && AppBskyEmbedImages.isView(firstEmbed)) {
//     image = firstEmbed.images.at(0)?.fullsize;
//   }

//   const authorName = view.author.displayName || view.author.handle;
//   const text = record.text || '';

//   const quoteData: DitsQuoteData = {
//     uri: view.uri,
//     cid: view.cid,
//     authorName,
//     authorHandle: view.author.handle,
//     authorAvatar: view.author.avatar,
//     text,
//     facets: record.facets,
//     image,
//     isReplyContext,
//   };

//   return {
//     slide: {
//       type: 'quote',
//       quote: quoteData,
//     },
//     preview: quoteData,
//   };
// }

// 2nd function buildContextFromRecord(
//   view: AppBskyEmbedRecord.ViewRecord | AppBskyFeedDefs.PostView,
//   isReplyContext = false
// ): { slide: DitsSlideItem; preview: DitsQuoteData } {
//   const isViewRecord = 'value' in view;
//   const rawRecord = isViewRecord ? view.value : view.record;
//   const record = rawRecord as { text?: string; facets?: AppBskyRichtextFacet.Main[] };
//   const embeds = isViewRecord ? view.embeds : view.embed ? [view.embed] : [];

//   let image: string | undefined;
//   let video: DitsQuoteData['video'] | undefined;
//   let externalLink: DitsExternalLink | undefined;

//   const firstEmbed = embeds?.at(0) as { $type?: string; media?: { $type?: string } } | undefined;
//   const mediaEmbed =
//     firstEmbed?.$type === 'app.bsky.embed.recordWithMedia#view' && firstEmbed.media
//       ? firstEmbed.media
//       : firstEmbed;

//   if (mediaEmbed?.$type === 'app.bsky.embed.images#view') {
//     const imgView = mediaEmbed as unknown as {
//       images?: Array<{ fullsize?: string }>;
//     };
//     image = imgView.images?.at(0)?.fullsize;
//   } else if (mediaEmbed?.$type === 'app.bsky.embed.video#view') {
//     const vidView = mediaEmbed as unknown as {
//       playlist: string;
//       thumbnail?: string;
//       alt?: string;
//       aspectRatio?: { width: number; height: number };
//     };
//     image = vidView.thumbnail;
//     video = {
//       playlist: vidView.playlist,
//       thumbnail: vidView.thumbnail,
//       alt: vidView.alt,
//       aspectRatio: vidView.aspectRatio,
//     };
//   } else if (mediaEmbed?.$type === 'app.bsky.embed.external#view') {
//     const extView = mediaEmbed as unknown as {
//       external: {
//         uri: string;
//         title: string;
//         description: string;
//         thumb?: string;
//       };
//     };
//     let domain = '';
//     try {
//       domain = new URL(extView.external.uri).hostname.replace(/^www\./, '');
//     } catch {
//       domain = extView.external.uri;
//     }
//     image = extView.external.thumb;
//     externalLink = {
//       uri: extView.external.uri,
//       domain,
//       title: extView.external.title,
//       description: extView.external.description,
//       thumb: extView.external.thumb,
//     };
//   }

//   const authorName = view.author.displayName || view.author.handle;
//   const text = record.text || '';

//   const quoteData: DitsQuoteData = {
//     uri: view.uri,
//     cid: view.cid,
//     authorName,
//     authorHandle: view.author.handle,
//     authorAvatar: view.author.avatar,
//     text,
//     facets: record.facets,
//     image,
//     video,
//     externalLink,
//     isReplyContext,
//   };

//   return {
//     slide: {
//       type: 'quote',
//       quote: quoteData,
//     },
//     preview: quoteData,
//   };
// }

function buildContextFromRecord(
  view: AppBskyEmbedRecord.ViewRecord | AppBskyFeedDefs.PostView,
  isReplyContext = false
): { slide: DitsSlideItem; preview: DitsQuoteData } {
  const isViewRecord = 'value' in view;
  const rawRecord = isViewRecord ? view.value : view.record;
  const record = rawRecord as { text?: string; facets?: AppBskyRichtextFacet.Main[] };
  const embeds = isViewRecord ? view.embeds : view.embed ? [view.embed] : [];

  const { image, video, externalLink } = extractMediaFromEmbedList(embeds);

  const authorName = view.author.displayName || view.author.handle;
  const text = record.text || '';

  const quoteData: DitsQuoteData = {
    uri: view.uri,
    cid: view.cid,
    authorName,
    authorHandle: view.author.handle,
    authorAvatar: view.author.avatar,
    text,
    facets: record.facets,
    image,
    video,
    externalLink,
    isReplyContext,
  };

  return {
    slide: {
      type: 'quote',
      quote: quoteData,
    },
    preview: quoteData,
  };
}


function extractMediaFromEmbedList(embeds?: unknown[]): {
  image?: string;
  video?: DitsQuoteData['video'];
  externalLink?: DitsExternalLink;
} {
  const firstEmbed = embeds?.at(0) as
    | {
        $type?: string;
        media?: { $type?: string };
        record?: { embeds?: unknown[]; record?: { embeds?: unknown[] } };
      }
    | undefined;

  if (!firstEmbed) return {};

  // Unwrap recordWithMedia#view -> media, or check direct embed
  const candidate =
    firstEmbed.$type === 'app.bsky.embed.recordWithMedia#view' && firstEmbed.media
      ? firstEmbed.media
      : firstEmbed;

  if (candidate.$type === 'app.bsky.embed.images#view') {
    const imgView = candidate as unknown as { images?: Array<{ fullsize?: string }> };
    return { image: imgView.images?.at(0)?.fullsize };
  }

  if (candidate.$type === 'app.bsky.embed.video#view') {
    const vidView = candidate as unknown as {
      playlist: string;
      thumbnail?: string;
      alt?: string;
      aspectRatio?: { width: number; height: number };
    };
    return {
      image: vidView.thumbnail,
      video: {
        playlist: vidView.playlist,
        thumbnail: vidView.thumbnail,
        alt: vidView.alt,
        aspectRatio: vidView.aspectRatio,
      },
    };
  }

  if (candidate.$type === 'app.bsky.embed.external#view') {
    const extView = candidate as unknown as {
      external: { uri: string; title: string; description: string; thumb?: string };
    };
    let domain = '';
    try {
      domain = new URL(extView.external.uri).hostname.replace(/^www\./, '');
    } catch {
      domain = extView.external.uri;
    }
    return {
      image: extView.external.thumb,
      externalLink: {
        uri: extView.external.uri,
        domain,
        title: extView.external.title,
        description: extView.external.description,
        thumb: extView.external.thumb,
      },
    };
  }

  // Fallback for "reply to a quote": look inside the nested quoted record's embeds
  const nestedRecord = firstEmbed.record?.record ?? firstEmbed.record;
  if (nestedRecord?.embeds?.length) {
    return extractMediaFromEmbedList(nestedRecord.embeds);
  }

  return {};
}


function extractContextSlide(
  item: AppBskyFeedDefs.FeedViewPost
): { slide: DitsSlideItem; preview: DitsQuoteData } | null {
  const embed = item.post.embed;

  if (AppBskyEmbedRecord.isView(embed) && AppBskyEmbedRecord.isViewRecord(embed.record)) {
    return buildContextFromRecord(embed.record, false);
  }
  if (AppBskyEmbedRecordWithMedia.isView(embed)) {
    const rwm = embed as AppBskyEmbedRecordWithMedia.View;
    if (AppBskyEmbedRecord.isViewRecord(rwm.record.record)) {
      return buildContextFromRecord(rwm.record.record, false);
    }
  }

  // Only treat as "Replying to @user" if replying to SOMEONE ELSE (not a self-thread)
  if (
    item.reply &&
    AppBskyFeedDefs.isPostView(item.reply.parent) &&
    item.reply.parent.author.did !== item.post.author.did
  ) {
    return buildContextFromRecord(item.reply.parent, true);
  }

  return null;
}


export function parseFeedItems(
    feed: AppBskyFeedDefs.FeedViewPost[],
    options?: { mode?: 'following' | 'custom' }
): DitsPost[] {
  const seenUris = new Set<string>();
  const ditsPosts: DitsPost[] = [];
  const blockedConfig = getNsfwFilterConfig();
  const hideReposts = getHideReposts();   
  const mutedWords = getMutedWords();

  for (const item of feed) {
    if (isNsfwItem(item, blockedConfig)) continue;
    
    // Check post text against muted words/phrases
    const itemRecord = item.post.record as { text?: string } | undefined;
    if (matchesMutedWords(itemRecord?.text, mutedWords)) continue;
    
    const rawReason = item.reason as {
      $type?: string;
      by?: { handle?: string; displayName?: string };
    } | undefined;

    const isRepost = Boolean(rawReason?.by?.handle);

    // Skip reposts in Following feed when enabled
    if (hideReposts && options?.mode === 'following' && isRepost) {
      continue;
    }
    // 1. Check if this feed item is a continuation of the author's own self-thread
    const isSelfReply =
      item.reply &&
      AppBskyFeedDefs.isPostView(item.reply.parent) &&
      item.reply.parent.author.did === item.post.author.did;

    // 2. Only promote reply.root if the root was ALSO written by the same author
    const rootPost =
      isSelfReply &&
      item.reply &&
      AppBskyFeedDefs.isPostView(item.reply.root) &&
      item.reply.root.author.did === item.post.author.did
        ? item.reply.root
        : item.post;

    // 3. Skip if either the root post or this specific post was already seen
    if (seenUris.has(rootPost.uri) || globalSeenThreadUris.has(rootPost.uri)) continue;
    if (seenUris.has(item.post.uri) || globalSeenThreadUris.has(item.post.uri)) continue;

    seenUris.add(rootPost.uri);
    seenUris.add(item.post.uri);
    globalSeenThreadUris.add(rootPost.uri);
    globalSeenThreadUris.add(item.post.uri);

    const slides = extractPrimarySlides(rootPost);
    const context = rootPost.uri === item.post.uri ? extractContextSlide(item) : null;

    if (context) slides.push(context.slide);
    if (slides.length === 0) continue;

    const record = rootPost.record as { text?: string; facets?: AppBskyRichtextFacet.Main[] };
    const externalLink = extractExternalLink(rootPost.embed);
    if (
      matchesMutedWords(record.text, mutedWords) ||
      matchesMutedWords(context?.preview.text, mutedWords) ||
      matchesMutedWords(externalLink?.title, mutedWords)
    ) {
      continue;
    }

    const hasThreadContinuation = isSelfReply || (rootPost.replyCount || 0) > 0;
    const repostedBy =
        AppBskyFeedDefs.isReasonRepost(item.reason)
            ? {
                handle: item.reason.by.handle,
                displayName: item.reason.by.displayName,
            }
            : undefined;

    ditsPosts.push({
      uri: rootPost.uri,
      cid: rootPost.cid,
      author: {
        did: rootPost.author.did,
        handle: rootPost.author.handle,
        displayName: rootPost.author.displayName,
        avatar: rootPost.author.avatar,
      },
      text: record.text || '',
      facets: record.facets,
      indexedAt: rootPost.indexedAt,
      likeCount: rootPost.likeCount || 0,
      replyCount: rootPost.replyCount || 0,
      repostCount: rootPost.repostCount || 0,
      viewerLikeUri: rootPost.viewer?.like,
      viewerRepostUri: rootPost.viewer?.repost,
      slides,
      quotePreview: context?.preview,
      externalLink: extractExternalLink(rootPost.embed),
      threadRootUri: hasThreadContinuation ? rootPost.uri : undefined, 
      repostedBy: repostedBy,
    });
  }

  return ditsPosts;
}
