import { Agent, AppBskyRichtextFacet, AtpSessionData, RichText } from '@atproto/api';
import { authorizedFetch, BSKY_PDS_HOST, BSKY_PUBLIC_API } from './auth';
import { DitsComment, DitsPost, DitsSlideItem } from './types';

export async function getPostComments(postUri: string): Promise<DitsComment[]> {
  const url = new URL('/xrpc/app.bsky.feed.getPostThread', BSKY_PUBLIC_API);
  url.searchParams.set('uri', postUri);
  url.searchParams.set('depth', '2');
  url.searchParams.set('parentHeight', '0');

  const res = await authorizedFetch(url.toString(), { headers: { Accept: 'application/json' } }, null);
  if (!res.ok) return [];

  const data = await res.json();
  const comments: DitsComment[] = [];

  for (const item of data.thread?.replies || []) {
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
      facets: record.facets,
      indexedAt: p.indexedAt,
      likeCount: p.likeCount || 0,
    });
  }

  return comments;
}

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
    },
    session
  );

  if (!res.ok) throw new Error('Failed to post comment');
  const created = await res.json();
  return { ...created, facets: rt.facets };
}

export async function toggleReaction(
  session: AtpSessionData,
  collection: 'app.bsky.feed.like' | 'app.bsky.feed.repost',
  subject: { uri: string; cid: string },
  existingRecordUri?: string
): Promise<string | undefined> {
  if (existingRecordUri) {
    const rkey = existingRecordUri.split('/').pop();
    const res = await authorizedFetch(
      `${BSKY_PDS_HOST}/xrpc/com.atproto.repo.deleteRecord`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: session.did, collection, rkey }),
      },
      session
    );
    if (!res.ok) throw new Error('Failed to remove reaction');
    return undefined;
  }

  const res = await authorizedFetch(
    `${BSKY_PDS_HOST}/xrpc/com.atproto.repo.createRecord`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: session.did,
        collection,
        record: {
          $type: collection,
          subject: { uri: subject.uri, cid: subject.cid },
          createdAt: new Date().toISOString(),
        },
      }),
    },
    session
  );

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

  for (const file of imageFiles.slice(0, 4)) {
    const uploadRes = await authorizedFetch(
      `${BSKY_PDS_HOST}/xrpc/com.atproto.repo.uploadBlob`,
      {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body: file,
      },
      session
    );

    if (!uploadRes.ok) throw new Error(`Failed to upload image: ${file.name}`);
    const uploadData = await uploadRes.json();
    uploadedImages.push({ alt: '', image: uploadData.blob });
    localPreviews.push({ fullsize: URL.createObjectURL(file), alt: file.name });
  }

  const rt = new RichText({ text: text.trim() });
  await rt.detectFacets(new Agent(BSKY_PUBLIC_API));

  const record: Record<string, unknown> = {
    $type: 'app.bsky.feed.post',
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
  };

  if (uploadedImages.length > 0) {
    record.embed = { $type: 'app.bsky.embed.images', images: uploadedImages };
  }

  const res = await authorizedFetch(
    `${BSKY_PDS_HOST}/xrpc/com.atproto.repo.createRecord`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', record }),
    },
    session
  );

  if (!res.ok) throw new Error('Failed to publish post');
  const created = (await res.json()) as { uri: string; cid: string };

  const slides: DitsSlideItem[] =
    localPreviews.length > 0
      ? localPreviews.map((img) => ({ type: 'image', image: img }))
      : [{ type: 'text', text: rt.text, facets: rt.facets }];

  return {
    uri: created.uri,
    cid: created.cid,
    author: { did: session.did, handle: session.handle, displayName: session.handle },
    text: rt.text,
    facets: rt.facets,
    indexedAt: new Date().toISOString(),
    likeCount: 0,
    replyCount: 0,
    repostCount: 0,
    slides,
  };
}
