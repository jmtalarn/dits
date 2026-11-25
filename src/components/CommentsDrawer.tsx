'use client';

import { useEffect, useState } from 'react';
import { X, Send } from 'lucide-react';
import { getPostComments, postComment, getSavedSession, DitsComment } from '@/lib/bsky';
import styles from './CommentsDrawer.module.css';
import RichTextView from './RichTextView';

interface CommentsDrawerProps {
    postUri: string;
    postCid: string;
    onClose: () => void;
    onCommentAdded: () => void;
}

export default function CommentsDrawer({
    postUri,
    postCid,
    onClose,
    onCommentAdded,
}: CommentsDrawerProps) {
    const [comments, setComments] = useState<DitsComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);

    const session = getSavedSession();

    useEffect(() => {
        getPostComments(postUri)
            .then(setComments)
            .finally(() => setLoading(false));
    }, [postUri]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session || !replyText.trim() || sending) return;

        setSending(true);
        try {
            const created = await postComment(session, { uri: postUri, cid: postCid }, replyText);
            // Optimistically add the new comment to the top of the list
            setComments((prev) => [
                {
                    uri: created.uri,
                    cid: created.cid,
                    authorName: session.handle,
                    authorHandle: session.handle,
                    text: replyText.trim(),
                    facets: created.facets,
                    indexedAt: new Date().toISOString(),
                    likeCount: 0,
                },
                ...prev,
            ]);
            setReplyText('');
            onCommentAdded();
        } catch {
            alert('Could not send reply');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.handleBar} />

                <div className={styles.header}>
                    <span className={styles.title}>Comments ({comments.length})</span>
                    <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.list}>
                    {loading ? (
                        <p className={styles.emptyText}>Loading replies...</p>
                    ) : comments.length === 0 ? (
                        <p className={styles.emptyText}>No replies yet. Start the conversation!</p>
                    ) : (
                        comments.map((c) => (
                            <div key={c.uri} className={styles.commentItem}>
                                {c.authorAvatar ? (
                                    <img src={c.authorAvatar} alt={c.authorHandle} className={styles.avatar} />
                                ) : (
                                    <div className={styles.avatarFallback}>{c.authorHandle.at(0)?.toUpperCase()}</div>
                                )}
                                <div className={styles.commentBody}>
                                    <span className={styles.author}>@{c.authorHandle}</span>
                                    <p className={styles.text}>
                                        <RichTextView text={c.text} facets={c.facets} />
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {session ? (
                    <form onSubmit={handleSend} className={styles.inputBar}>
                        <input
                            type="text"
                            placeholder="Write a reply..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            maxLength={300}
                            className={styles.input}
                        />
                        <button type="submit" disabled={!replyText.trim() || sending} className={styles.sendBtn}>
                            <Send size={16} />
                        </button>
                    </form>
                ) : (
                    <p className={styles.loginHint}>Sign in to reply to this post</p>
                )}
            </div>
        </div>
    );
}
