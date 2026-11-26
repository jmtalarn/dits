'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Heart,
  Repeat2,
  UserPlus,
  MessageCircle,
  Quote,
  AtSign,
  Bell,
  CheckCheck,
  ArrowLeft,
} from 'lucide-react';
import { AtpSessionData } from '@atproto/api';
import {
  DitsNotification,
  DitsPost,
  getNotifications,
  markNotificationsSeen,
  getSinglePost,
} from '@/lib/bsky';
import PostSlide from './PostSlide';
import AuthorProfileModal from './AuthorProfileModal';
import { DitsMiniSpinner } from './DitsLoader';
import styles from './NotificationsModal.module.css';

interface NotificationsModalProps {
  session: AtpSessionData;
  onClose: () => void;
  onMarkedSeen: () => void;
}

export default function NotificationsModal({
  session,
  onClose,
  onMarkedSeen,
}: NotificationsModalProps) {
  const [items, setItems] = useState<DitsNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'mentions'>('all');
  const [loading, setLoading] = useState(true);

  const [selectedActor, setSelectedActor] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<DitsPost | null>(null);
  const [loadingPost, setLoadingPost] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUnread() {
      setLoading(true);
      try {
        const res = await getNotifications(session);
        if (!cancelled) {
          // Keep only unopened (unread) notifications
          const unreadOnly = res.notifications.filter((n) => !n.isRead);
          setItems(unreadOnly);
        }
      } catch {
        // Ignore transient network errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUnread();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const handleMarkAllRead = async () => {
    await markNotificationsSeen(session);
    setItems([]);
    onMarkedSeen();
  };

  const handleNotificationClick = async (notif: DitsNotification) => {
    // Remove this notification from the unopened list immediately
    setItems((prev) => {
      const remaining = prev.filter((item) => item.uri !== notif.uri);
      if (remaining.length === 0) {
        markNotificationsSeen(session).then(onMarkedSeen);
      }
      return remaining;
    });

    // Follows open the user's profile
    if (notif.reason === 'follow') {
      setSelectedActor(notif.author.handle);
      return;
    }

    // Likes & reposts point to reasonSubject; replies, mentions & quotes point to notif.uri
    const targetPostUri =
      notif.reason === 'like' || notif.reason === 'repost'
        ? notif.reasonSubject
        : notif.uri;

    if (!targetPostUri) {
      setSelectedActor(notif.author.handle);
      return;
    }

    setLoadingPost(true);
    try {
      const post = await getSinglePost(session, targetPostUri);
      if (post) {
        setSelectedPost(post);
      } else {
        setSelectedActor(notif.author.handle);
      }
    } finally {
      setLoadingPost(false);
    }
  };

  const filteredItems =
    filter === 'mentions'
      ? items.filter((n) => n.reason === 'mention' || n.reason === 'reply' || n.reason === 'quote')
      : items;

  const renderReasonBadge = (reason: string) => {
    switch (reason) {
      case 'like':
        return { icon: <Heart size={14} className={styles.iconLike} />, label: 'liked your post' };
      case 'repost':
        return { icon: <Repeat2 size={14} className={styles.iconRepost} />, label: 'reposted your post' };
      case 'follow':
        return { icon: <UserPlus size={14} className={styles.iconFollow} />, label: 'followed you' };
      case 'reply':
        return { icon: <MessageCircle size={14} className={styles.iconReply} />, label: 'replied to you' };
      case 'quote':
        return { icon: <Quote size={14} className={styles.iconQuote} />, label: 'quoted your post' };
      case 'mention':
        return { icon: <AtSign size={14} className={styles.iconMention} />, label: 'mentioned you' };
      default:
        return { icon: <Bell size={14} />, label: 'interacted with you' };
    }
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose}>
        <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <span className={styles.title}>
              Unread Notifications {items.length > 0 ? `(${items.length})` : ''}
            </span>
            <div className={styles.headerActions}>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className={styles.markReadBtn}
                  title="Mark all as read"
                >
                  <CheckCheck size={15} />
                  <span>Mark read</span>
                </button>
              )}
              <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className={styles.tabs}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={filter === 'all' ? styles.tabActive : styles.tab}
            >
              All Unread
            </button>
            <button
              type="button"
              onClick={() => setFilter('mentions')}
              className={filter === 'mentions' ? styles.tabActive : styles.tab}
            >
              Mentions & Replies
            </button>
          </div>

          <div className={styles.list}>
            {loading || loadingPost ? (
              <div className={styles.centerState}>
                <DitsMiniSpinner />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className={styles.centerState}>All caught up — no unread notifications.</div>
            ) : (
              filteredItems.map((notif) => {
                const { icon, label } = renderReasonBadge(notif.reason);
                return (
                  <button
                    key={`${notif.uri}-${notif.indexedAt}`}
                    type="button"
                    className={`${styles.itemRow} ${styles.itemUnread}`}
                    onClick={() => handleNotificationClick(notif)}
                  >
                    <div className={styles.iconCol}>{icon}</div>
                    {notif.author.avatar ? (
                      <img
                        src={notif.author.avatar}
                        alt={notif.author.handle}
                        className={styles.avatar}
                      />
                    ) : (
                      <div className={styles.avatarFallback}>
                        {notif.author.handle.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className={styles.contentCol}>
                      <div className={styles.headline}>
                        <strong>{notif.author.displayName || `@${notif.author.handle}`}</strong>{' '}
                        <span className={styles.actionText}>{label}</span>
                      </div>
                      {notif.recordText && (
                        <p className={styles.snippet}>{notif.recordText}</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Related Post Viewer Overlay */}
      {selectedPost && (
        <div className={styles.postViewerOverlay}>
          <button
            type="button"
            onClick={() => setSelectedPost(null)}
            className={styles.postViewerBackBtn}
            aria-label="Back to notifications"
          >
            <ArrowLeft size={18} />
            <span>Back to Notifications</span>
          </button>
          <div className={styles.postViewerBody}>
            <PostSlide post={selectedPost}  />
          </div>
        </div>
      )}

      {selectedActor && (
        <AuthorProfileModal actor={selectedActor} onClose={() => setSelectedActor(null)} />
      )}
    </>
  );
}
