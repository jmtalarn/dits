'use client';

import { DitsPost, getBlueskyPostUrl, DitsSlideItem, getQuotedThreadSlides, toggleReaction, getSavedSession, getAuthorThreadSlides, } from '@/lib/bsky';
import { Heart, Repeat2, MessageCircle, Share2, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CommentsDrawer from './CommentsDrawer';
import styles from './PostSlide.module.css';
import SlideCard from './SlideCard';
import AuthorProfileModal from './AuthorProfileModal';



export default function PostSlide({ post }: { post: DitsPost }) {
    const [slides, setSlides] = useState<DitsSlideItem[]>(post.slides);
    const [activeSlide, setActiveSlide] = useState(0);
    const [threadLoaded, setThreadLoaded] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [replyCount, setReplyCount] = useState(post.replyCount);
    const [likeUri, setLikeUri] = useState<string | undefined>(post.viewerLikeUri);
    const [likeCount, setLikeCount] = useState(post.likeCount);
    const [repostUri, setRepostUri] = useState<string | undefined>(post.viewerRepostUri);
    const [repostCount, setRepostCount] = useState(post.repostCount);
    const [selectedActor, setSelectedActor] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const carouselRef = useRef<HTMLDivElement | null>(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeftStart = useRef(0);
    const articleRef = useRef<HTMLElement | null>(null);

    // 1. Automatically fetch author's own thread continuation (Posts 2, 3, 4...)
    useEffect(() => {
        if (!post.threadRootUri || threadLoaded) return;
        setThreadLoaded(true);

        getAuthorThreadSlides(post.threadRootUri, post.author.did).then((extraSlides) => {
            if (extraSlides.length > 0) {
                setSlides((prev) => {
                    // Guard against React Strict Mode double-mount or duplicate fetches
                    const existingTexts = new Set(
                        prev.map((s) => (s.type === 'quote' ? s.quote?.text : post.text))
                    );
                    const uniqueExtra = extraSlides.filter(
                        (s) => s.quote?.text && !existingTexts.has(s.quote.text)
                    );
                    return [...prev, ...uniqueExtra];
                });
            }
        });
    }, [post.threadRootUri, post.author.did, post.text, threadLoaded]);

    // 2. Fetch quoted thread when swiping into a quoted post
    useEffect(() => {
        if (activeSlide === 1 && post.quotePreview?.uri && !post.quotePreview.isReplyContext && !threadLoaded) {
            setThreadLoaded(true);
            getQuotedThreadSlides(post.quotePreview.uri).then((threadSlides) => {
                if (threadSlides.length > 1) {
                    setSlides((prev) => (prev.at(0) ? [prev.at(0)!, ...threadSlides] : prev));
                }
            });
        }
    }, [activeSlide, post.quotePreview?.uri, post.quotePreview?.isReplyContext, threadLoaded]);

    useEffect(() => {
        if (slides.length <= 1) return;

        const handleHorizontalNav = (e: Event) => {
            // Do not hijack arrow keys if comments drawer or author profile modal is open
            if (showComments || selectedActor) return;

            const el = articleRef.current;
            if (!el) return;

            // Check if this post is the one currently snapped in the viewport
            const rect = el.getBoundingClientRect();
            const isVisible = Math.abs(rect.top) < rect.height * 0.4;
            if (!isVisible) return;

            const customEvent = e as CustomEvent<{ direction: 1 | -1 }>;
            const nextIndex = activeSlide + customEvent.detail.direction;

            if (nextIndex >= 0 && nextIndex < slides.length) {
                goToSlide(nextIndex);
            }
        };

        window.addEventListener('dits:horizontal-nav', handleHorizontalNav);
        return () => window.removeEventListener('dits:horizontal-nav', handleHorizontalNav);
    }, [slides.length, activeSlide, showComments, selectedActor]);

    const handleScroll = () => {
        if (!carouselRef.current) return;
        const width = carouselRef.current.clientWidth;
        if (width > 0) setActiveSlide(Math.round(carouselRef.current.scrollLeft / width));
    };

    const goToSlide = (index: number) => {
        if (!carouselRef.current) return;
        carouselRef.current.scrollTo({ left: index * carouselRef.current.clientWidth, behavior: 'smooth' });
    };

    const onMouseDown = (e: React.MouseEvent) => {
        if (!carouselRef.current || slides.length <= 1) return;
        isDragging.current = true;
        startX.current = e.pageX - carouselRef.current.offsetLeft;
        scrollLeftStart.current = carouselRef.current.scrollLeft;
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !carouselRef.current) return;
        e.preventDefault();
        const walk = (e.pageX - carouselRef.current.offsetLeft - startX.current) * 1.5;
        carouselRef.current.scrollLeft = scrollLeftStart.current - walk;
    };
    const handleToggleLike = async () => {
        const session = getSavedSession();
        if (!session) return alert('Sign in to like posts');

        const prevUri = likeUri;
        const prevCount = likeCount;
        const isCurrentlyLiked = Boolean(prevUri);

        // Optimistic UI update
        setLikeUri(isCurrentlyLiked ? undefined : 'pending');
        setLikeCount(isCurrentlyLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

        try {
            const newUri = await toggleReaction(
                session,
                'app.bsky.feed.like',
                { uri: post.uri, cid: post.cid },
                prevUri === 'pending' ? undefined : prevUri
            );
            setLikeUri(newUri);
        } catch {
            setLikeUri(prevUri);
            setLikeCount(prevCount);
        }
    };

    const handleToggleRepost = async () => {
        const session = getSavedSession();
        if (!session) return alert('Sign in to repost');

        const prevUri = repostUri;
        const prevCount = repostCount;
        const isCurrentlyReposted = Boolean(prevUri);

        // Optimistic UI update
        setRepostUri(isCurrentlyReposted ? undefined : 'pending');
        setRepostCount(isCurrentlyReposted ? Math.max(0, prevCount - 1) : prevCount + 1);

        try {
            const newUri = await toggleReaction(
                session,
                'app.bsky.feed.repost',
                { uri: post.uri, cid: post.cid },
                prevUri === 'pending' ? undefined : prevUri
            );
            setRepostUri(newUri);
        } catch {
            setRepostUri(prevUri);
            setRepostCount(prevCount);
        }
    };
    // Switch the big bottom author dynamically when swiping into a quoted post
    const currentSlide = slides.at(activeSlide);
    const activeAuthor =
        currentSlide?.type === 'quote' && currentSlide.quote
            ? {
                name: currentSlide.quote.authorName,
                handle: currentSlide.quote.authorHandle,
                avatar: currentSlide.quote.authorAvatar,
            }
            : {
                name: post.author.displayName || post.author.handle,
                handle: post.author.handle,
                avatar: post.author.avatar,
            };
    const handleShare = async () => {
        // Share the active thread slide if viewing a thread continuation, otherwise the root post
        const currentSlide = slides[activeSlide];
        const isSelfThreadSlide =
            currentSlide?.type === 'quote' &&
            currentSlide.quote?.uri &&
            currentSlide.quote.authorHandle === post.author.handle;

        const targetUri = isSelfThreadSlide ? currentSlide.quote!.uri : post.uri;
        const shareUrl = getBlueskyPostUrl(post.author.handle, targetUri);
        const shareTitle = `${post.author.displayName || post.author.handle} on Bluesky`;
        const shareText = (isSelfThreadSlide ? currentSlide.quote!.text : post.text).slice(0, 140);

        // 1. Try native Web Share API on mobile / supported browsers
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share({
                    title: shareTitle,
                    text: shareText || undefined,
                    url: shareUrl,
                });
                return;
            } catch (err) {
                // Ignore if user cancelled the share sheet; fall through to clipboard on real errors
                if ((err as Error)?.name === 'AbortError') return;
            }
        }

        // 2. Fallback: copy URL to clipboard and show confirmation badge
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Legacy fallback if clipboard API is blocked
            const input = document.createElement('input');
            input.value = shareUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <article ref={articleRef} className={styles.slide}>
            {slides.length > 1 && (
                <div className={styles.progressBars}>
                    {slides.map((_, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => goToSlide(idx)}
                            className={`${styles.progressSegment} ${idx === activeSlide ? styles.progressSegmentActive : ''}`}
                        />
                    ))}
                </div>
            )}

            {slides.length > 1 && activeSlide < slides.length - 1 && (
                <button type="button" onClick={() => goToSlide(activeSlide + 1)} className={styles.swipeHint}>
                    {slides.at(activeSlide + 1)?.quote?.authorHandle === post.author.handle
                        ? `Thread ${activeSlide + 1}/${slides.length} →`
                        : slides.at(activeSlide + 1)?.type === 'quote'
                            ? 'See quote →'
                            : `${activeSlide + 1}/${slides.length} →`}
                </button>
            )}

            {slides.length > 1 && activeSlide > 0 && (
                <button type="button" onClick={() => goToSlide(activeSlide - 1)} className={styles.swipeBackHint}>
                    ← Back
                </button>
            )}

            <div
                ref={carouselRef}
                onScroll={handleScroll}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={() => (isDragging.current = false)}
                onMouseLeave={() => (isDragging.current = false)}
                className={styles.horizontalCarousel}
            >
                {slides.map((slide, index) => (
                    <div key={index} className={styles.carouselItem}>
                        <SlideCard slide={slide} index={index} post={post} onGoToQuote={() => goToSlide(1)} />
                    </div>
                ))}
            </div>

            {/* Big Bottom Footer: Author on Left, Actions on Right */}
            <div className={styles.bottomFooter}>
                <button
                    type="button"
                    onClick={() => setSelectedActor(activeAuthor.handle)}
                    className={styles.authorRow}
                    style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}
                >
                    {activeAuthor.avatar && (
                        <img src={activeAuthor.avatar} alt={activeAuthor.handle} className={styles.avatarLarge} />
                    )}

                    <div className={styles.authorMeta}>
                        {post.repostedBy && (
                            <div className={styles.repostedBadge}>
                                <Repeat2 size={13} />
                                <span>
                                    Reposted by{' '}
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        className={styles.repostedName}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedActor(post.repostedBy!.handle);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setSelectedActor(post.repostedBy!.handle);
                                            }
                                        }}
                                    >
                                        {post.repostedBy.displayName || `@${post.repostedBy.handle}`}
                                    </span>
                                </span>
                            </div>
                        )}

                        <span className={styles.authorNameLarge}>{activeAuthor.name}</span>
                        <span className={styles.authorHandle}>@{activeAuthor.handle}</span>
                    </div>
                </button>

                <div className={styles.actionsRow}>
                    <button
                        type="button"
                        onClick={handleToggleLike}
                        className={`${styles.actionButton} ${likeUri ? styles.likedActive : ''}`}
                        aria-label="Like"
                    >
                        <Heart size={20} fill={likeUri ? 'currentColor' : 'none'} />
                        <span>{likeCount}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowComments(true)}
                        className={styles.actionButton}
                        aria-label="Comments"
                    >
                        <MessageCircle size={20} />
                        <span>{replyCount}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleToggleRepost}
                        className={`${styles.actionButton} ${repostUri ? styles.repostedActive : ''}`}
                        aria-label="Repost"
                    >
                        <Repeat2 size={20} />
                        <span>{repostCount}</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleShare}
                        className={styles.actionBtn}
                        aria-label={copied ? 'Link copied' : 'Share post'}
                        title={copied ? 'Copied!' : 'Share or copy link'}
                    >
                        {copied ? <Check size={22} color="#10b981" /> : <Share2 size={22} />}
                        <span className={styles.actionCount}>{copied ? 'Copied' : 'Share'}</span>
                    </button>
                </div>
            </div>
            {showComments && (
                <CommentsDrawer
                    postUri={post.uri}
                    postCid={post.cid}
                    onClose={() => setShowComments(false)}
                    onCommentAdded={() => setReplyCount((c) => c + 1)}
                />
            )}
            {selectedActor && (
                <AuthorProfileModal
                    actor={selectedActor}
                    onClose={() => setSelectedActor(null)}
                />
            )}
        </article>
    );
}
