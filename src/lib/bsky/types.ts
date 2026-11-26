import { AppBskyRichtextFacet } from '@atproto/api';

export interface DitsQuoteData {
  uri: string;
  cid: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  text: string;
  facets?: AppBskyRichtextFacet.Main[];
  image?: string;
  video?: {
    playlist: string;
    thumbnail?: string;
    alt?: string;
    aspectRatio?: { width: number; height: number };
  };
  isReplyContext?: boolean;
  externalLink?: DitsExternalLink;
}

export interface DitsSlideItem {
  type: 'text' | 'image' | 'video' | 'quote' | 'gif';
  text?: string;
  facets?: AppBskyRichtextFacet.Main[];
  gifUrl?: string;
    image?: {
    fullsize: string;
    alt?: string;
    aspectRatio?: { width: number; height: number };
  };

  video?: {
    playlist: string;
    thumbnail?: string;
    alt?: string;
    aspectRatio?: { width: number; height: number };
  };
  quote?: DitsQuoteData;
}

export interface DitsExternalLink {
  uri: string;
  title: string;
  description: string;
  thumb?: string;
  domain: string;
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
  viewerLikeUri?: string;
  viewerRepostUri?: string;
  slides: DitsSlideItem[];
  quotePreview?: DitsQuoteData;
  externalLink?: DitsExternalLink;
  threadRootUri?: string;
  repostedBy?: {
    handle: string;
    displayName?: string;
  };
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

export interface DitsFeedGenerator {
  uri: string;
  displayName: string;
  description?: string;
  avatar?: string;
  creatorHandle: string;
}

export type NsfwLabel = 'porn' | 'sexual' | 'nudity' | 'graphic-media' | 'gore';
export type NsfwFilterConfig = Record<NsfwLabel, boolean>;
