import { AtpSessionData } from "@atproto/api";
import { BSKY_PDS_HOST, authorizedFetch } from "./auth";
import { DitsNotification } from "./types";

const ENDPOINT_LIST_NOTIFICATIONS = '/xrpc/app.bsky.notification.listNotifications';
const ENDPOINT_UNREAD_COUNT = '/xrpc/app.bsky.notification.getUnreadCount';
const ENDPOINT_UPDATE_SEEN = '/xrpc/app.bsky.notification.updateSeen';

export async function getUnreadNotificationCount(session: AtpSessionData): Promise<number> {
  const url = new URL(ENDPOINT_UNREAD_COUNT, BSKY_PDS_HOST);
  const res = await authorizedFetch(url.toString(), { headers: { Accept: 'application/json' } }, session);
  if (!res.ok) return 0;
  const data = (await res.json()) as { count?: number };
  return data.count || 0;
}

export async function getNotifications(
  session: AtpSessionData,
  cursor?: string
): Promise<{ notifications: DitsNotification[]; cursor?: string }> {
  const url = new URL(ENDPOINT_LIST_NOTIFICATIONS, BSKY_PDS_HOST);
  url.searchParams.set('limit', '35');
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await authorizedFetch(url.toString(), { headers: { Accept: 'application/json' } }, session);
  if (!res.ok) throw new Error(`Failed to fetch notifications (${res.status})`);

  const data = (await res.json()) as {
    notifications: Array<{
      uri: string;
      cid: string;
      reason: string;
      reasonSubject?: string;
      isRead: boolean;
      indexedAt: string;
      author: {
        did: string;
        handle: string;
        displayName?: string;
        avatar?: string;
      };
      record?: { text?: string };
    }>;
    cursor?: string;
  };

  const notifications: DitsNotification[] = (data.notifications || []).map((n) => ({
    uri: n.uri,
    cid: n.cid,
    reason: n.reason,
    reasonSubject: n.reasonSubject,
    isRead: Boolean(n.isRead),
    indexedAt: n.indexedAt,
    author: {
      did: n.author.did,
      handle: n.author.handle,
      displayName: n.author.displayName,
      avatar: n.author.avatar,
    },
    recordText: typeof n.record?.text === 'string' ? n.record.text : undefined,
  }));

  return { notifications, cursor: data.cursor };
}

export async function markNotificationsSeen(session: AtpSessionData): Promise<void> {
  const url = new URL(ENDPOINT_UPDATE_SEEN, BSKY_PDS_HOST);
  await authorizedFetch(
    url.toString(),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seenAt: new Date().toISOString() }),
    },
    session
  );
}
