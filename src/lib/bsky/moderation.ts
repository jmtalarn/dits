import {
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyFeedDefs,
} from '@atproto/api';
import { NsfwFilterConfig, NsfwLabel } from './types';

export const NSFW_LABEL_OPTIONS: { id: NsfwLabel; label: string; description: string }[] = [
  { id: 'porn', label: 'Adult / Porn', description: 'Explicit adult images and videos' },
  { id: 'sexual', label: 'Sexually Suggestive', description: 'Suggestive or mature themes' },
  { id: 'nudity', label: 'Nudity', description: 'Non-sexual artistic or general nudity' },
  { id: 'graphic-media', label: 'Graphic Media', description: 'Disturbing or sensitive imagery' },
  { id: 'gore', label: 'Violence / Gore', description: 'Blood, injury, or violent content' },
];

const NSFW_PREF_KEY = 'dits_nsfw_filters_v1';

const DEFAULT_NSFW_FILTERS: NsfwFilterConfig = {
  porn: true,
  sexual: true,
  nudity: true,
  'graphic-media': true,
  gore: true,
};

export function getNsfwFilterConfig(): NsfwFilterConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_NSFW_FILTERS };
  try {
    const raw = localStorage.getItem(NSFW_PREF_KEY);
    return raw ? { ...DEFAULT_NSFW_FILTERS, ...JSON.parse(raw) } : { ...DEFAULT_NSFW_FILTERS };
  } catch {
    return { ...DEFAULT_NSFW_FILTERS };
  }
}

export function setNsfwFilterConfig(config: NsfwFilterConfig) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NSFW_PREF_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('dits-nsfw-pref-changed', { detail: config }));
}

function hasBlockedLabel(
  labels: { val: string }[] | undefined,
  blockedConfig: NsfwFilterConfig
): boolean {
  if (!labels || labels.length === 0) return false;
  return labels.some((l) => blockedConfig[l.val.toLowerCase() as NsfwLabel] === true);
}

export function isNsfwItem(
  item: AppBskyFeedDefs.FeedViewPost,
  blockedConfig: NsfwFilterConfig
): boolean {
  const post = item.post;
  if (
    hasBlockedLabel(post.labels, blockedConfig) ||
    hasBlockedLabel(post.author.labels, blockedConfig)
  ) {
    return true;
  }

  const embed = post.embed;
  if (AppBskyEmbedRecord.isView(embed) && AppBskyEmbedRecord.isViewRecord(embed.record)) {
    if (
      hasBlockedLabel(embed.record.labels, blockedConfig) ||
      hasBlockedLabel(embed.record.author.labels, blockedConfig)
    ) {
      return true;
    }
  }

  // Fixed explicit cast to AppBskyEmbedRecordWithMedia.View
  if (AppBskyEmbedRecordWithMedia.isView(embed)) {
    const rwm = embed as AppBskyEmbedRecordWithMedia.View;
    if (AppBskyEmbedRecord.isViewRecord(rwm.record.record)) {
      if (
        hasBlockedLabel(rwm.record.record.labels, blockedConfig) ||
        hasBlockedLabel(rwm.record.record.author.labels, blockedConfig)
      ) {
        return true;
      }
    }
  }

  if (item.reply && AppBskyFeedDefs.isPostView(item.reply.parent)) {
    if (
      hasBlockedLabel(item.reply.parent.labels, blockedConfig) ||
      hasBlockedLabel(item.reply.parent.author.labels, blockedConfig)
    ) {
      return true;
    }
  }

  return false;
}
