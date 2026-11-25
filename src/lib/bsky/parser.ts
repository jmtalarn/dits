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

  if (AppBskyEmbedRecord.isView(embed) && AppBskyEmbedRecord.isViewRecord(embed.record)) {
    return buildContextFromRecord(embed.record, false);
  }
  if (AppBskyEmbedRecordWithMedia.isView(embed)) {
    const rwm = embed as AppBskyEmbedRecordWithMedia.View;
    if (AppBskyEmbedRecord.isViewRecord(rwm.record.record)) {
      return buildContextFromRecord(rwm.record.record, false);
    }
  }
  if (item.reply && AppBskyFeedDefs.isPostView(item.reply.parent)) {
    return buildContextFromRecord(item.reply.parent, true);
  }

  return null;
}

export function parseFeedItems(feed: AppBskyFeedDefs.FeedViewPost[]): DitsPost[] {
  const seenUris = new Set<string>();
  const ditsPosts: DitsPost[] = [];
  const blockedConfig = getNsfwFilterConfig();

  for (const item of feed) {
    if (isNsfwItem(item, blockedConfig)) continue;

    const post = item.post;
    if (seenUris.has(post.uri)) continue;
    seenUris.add(post.uri);

    const slides = extractPrimarySlides(post);
    const context = extractContextSlide(item);
    if (context) slides.push(context.slide);
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
      externalLink: extractExternalLink(post.embed),
    });
  }

  return ditsPosts;
}
