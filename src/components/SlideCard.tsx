'use client';

import { useState, useRef } from 'react';
import { Maximize2 } from 'lucide-react';
import { DitsPost, DitsSlideItem } from '@/lib/bsky';
import VideoPlayer from './VideoPlayer';
import QuoteTeaser from './QuoteTeaser';
import MediaLightbox from './MediaLightbox';
import RichTextView from './RichTextView';
import AuthorProfileModal from './AuthorProfileModal';
import HashtagFeedModal from './HashtagFeedModal';
import styles from './PostSlide.module.css';
import ExternalLinkCard from './ExternalLinkCard';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface SlideCardProps {
    slide: DitsSlideItem;
    index: number;
    post: DitsPost;
    onGoToQuote: () => void;
}

export default function SlideCard({ slide, index, post, onGoToQuote }: SlideCardProps) {
    const { t } = useI18n();
    const [fullscreenMedia, setFullscreenMedia] = useState<{
        imageUrl?: string;
        altText?: string;
        video?: { playlist: string; thumbnail?: string };
    } | null>(null);

    const [mentionedDid, setMentionedDid] = useState<string | null>(null);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const pointerStartX = useRef(0);

    const hasText = post.text.trim().length > 0;
    const hasContext = index === 0 && Boolean(post.quotePreview);

    // Show the complete quoted/replied post inline on Slide 1 when there is plenty of screen space
    const combinedTextLength = post.text.length + (post.quotePreview?.text.length || 0);
    const canShowFullContext =
        hasContext &&
        slide.type === 'text' &&
        combinedTextLength <= 260;

    const getTextClass = (text?: string, isMediaCaption = false) => {
        const len = text?.length || 0;
        if (!isMediaCaption && len <= 110) return styles.textLarge;
        if (len <= 210) return styles.textMedium;
        return styles.textCompact;
    };

    const handleImageClick = (imageUrl: string, altText?: string, endX?: number) => {
        if (endX !== undefined && Math.abs(endX - pointerStartX.current) > 8) return;
        setFullscreenMedia({ imageUrl, altText });
    };

    return (
        <>
            <div className={styles.unifiedCard}>
                {/* 1. TEXT SLIDE */}
                {slide.type === 'text' && (
                    <div className={styles.textOnlyBody}>
                        <p className={getTextClass(slide.text)}>
                            <RichTextView
                                text={slide.text || ''}
                                facets={slide.facets}
                                onMentionClick={(did) => setMentionedDid(did)}
                                onTagClick={(tag) => setSelectedTag(tag)}
                            />
                        </p>
                        {index === 0 && post.externalLink && (
                            <ExternalLinkCard link={post.externalLink} />
                        )}
                        {hasContext && post.quotePreview && (
                            canShowFullContext ? (
                                <div
                                    onClick={onGoToQuote}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && onGoToQuote()}
                                    className={styles.fullInlineContextBox}
                                >
                                    <div className={styles.quoteTeaserHeader}>
                                        {post.quotePreview.authorAvatar && (
                                            <img
                                                src={post.quotePreview.authorAvatar}
                                                alt={post.quotePreview.authorHandle}
                                                className={styles.quoteTeaserAvatar}
                                            />
                                        )}
                                        <span className={styles.quoteTeaserAuthor}>
                                            {post.quotePreview.isReplyContext
                                                ? t('quote.replyingTo', { handle: post.quotePreview.authorHandle })
                                                : post.quotePreview.authorName}
                                        </span>
                                        <span className={styles.quoteTeaserAction}>{t('quote.swipe')}</span>
                                    </div>

                                    {post.quotePreview.text && (
                                        <p className={styles.fullInlineContextText}>
                                            <RichTextView
                                                text={post.quotePreview.text}
                                                facets={post.quotePreview.facets}
                                                onMentionClick={(did) => setMentionedDid(did)}
                                                onTagClick={(tag) => setSelectedTag(tag)}
                                            />
                                        </p>
                                    )}

                                    {post.quotePreview.image && (
                                        <img
                                            src={post.quotePreview.image}
                                            alt={t('slideCard.contextMediaAlt')}
                                            className={styles.fullInlineContextImg}
                                            draggable={false}
                                        />
                                    )}
                                </div>
                            ) : (
                                <QuoteTeaser quote={post.quotePreview} onSelect={onGoToQuote} />
                            )
                        )}
                    </div>
                )}

                {/* 2. IMAGE, VIDEO, OR GIF SLIDE */}
                {(slide.type === 'image' || slide.type === 'video' || slide.type === 'gif') && (
                    <>
                        <div className={`${styles.cardMediaBox} ${!hasText && !hasContext ? styles.cardMediaBoxFull : ''}`}>
                            {slide.type === 'image' && slide.image && (
                                <>
                                    <img
                                        src={slide.image.fullsize}
                                        alt={slide.image.alt || t('common.image')}
                                        className={styles.imageElement}
                                        draggable={false}
                                        loading="lazy"
                                        onPointerDown={(e) => (pointerStartX.current = e.clientX)}
                                        onClick={(e) => handleImageClick(slide.image!.fullsize, slide.image!.alt, e.clientX)}
                                    />
                                    <button
                                        type="button"
                                        aria-label={t('slideCard.expandImage')}
                                        className={styles.fullscreenVideoBtn}
                                        onClick={() => setFullscreenMedia({ imageUrl: slide.image!.fullsize, altText: slide.image!.alt })}
                                    >
                                        <Maximize2 size={16} />
                                    </button>
                                </>
                            )}
                            {slide.type === 'video' && slide.video && (
                                <VideoPlayer
                                    playlist={slide.video.playlist}
                                    poster={slide.video.thumbnail}
                                    onFullscreen={() => setFullscreenMedia({ video: slide.video })}
                                />
                            )}
                            {slide.type === 'gif' && slide.gifUrl && (
                                slide.gifUrl.split('?').at(0)?.toLowerCase().endsWith('.gif') ? (
                                    <img
                                        src={slide.gifUrl}
                                        alt={slide.image?.alt || t('common.gif')}
                                        className={styles.imageElement}
                                        draggable={false}
                                    />
                                ) : (
                                    <video
                                        src={slide.gifUrl}
                                        poster={slide.image?.fullsize}
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        className={styles.videoElement}
                                    />
                                )
                            )}
                        </div>
                        {(hasText || hasContext) && (
                            <div className={styles.cardCaptionBody}>
                                {hasText && (
                                    <p className={getTextClass(post.text, true)}>
                                        <RichTextView
                                            text={post.text}
                                            facets={post.facets}
                                            onMentionClick={(did) => setMentionedDid(did)}
                                            onTagClick={(tag) => setSelectedTag(tag)}
                                        />
                                    </p>
                                )}
                                {hasContext && post.quotePreview && (
                                    <QuoteTeaser quote={post.quotePreview} onSelect={onGoToQuote} />
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* 3. QUOTE / THREAD SLIDE (Slide 2+) */}
                {slide.type === 'quote' && slide.quote && (
                    <>
                        <div className={styles.quotedByHeader}>
                            {post.author.avatar && (
                                <img src={post.author.avatar} alt={post.author.handle} className={styles.quotedByAvatar} />
                            )}
                            <span>
                                {slide.quote.authorHandle === post.author.handle
                                    ? `${t('slideCard.threadBy')} `
                                    : post.quotePreview?.isReplyContext
                                        ? `${t('slideCard.inReplyTo')} `
                                        : `${t('slideCard.quotedBy')} `}
                                <strong>@{post.author.handle}</strong>
                                {index > 0 && slide.quote.authorHandle === post.author.handle
                                    ? ` · ${t('slideCard.part', { n: index + 1 })}`
                                    : index > 1
                                    ? ` · ${t('slideCard.part', { n: index })}`
                                    : ''}
                            </span>
                        </div>

                        {/* 1. Video inside thread/quote slide */}
                        {slide.quote.video ? (
                            <div className={`${styles.cardMediaBox} ${!slide.quote.text ? styles.cardMediaBoxFull : ''}`}>
                                <VideoPlayer
                                    playlist={slide.quote.video.playlist}
                                    poster={slide.quote.video.thumbnail}
                                    onFullscreen={() => setFullscreenMedia({ video: slide.quote!.video })}
                                />
                            </div>
                        ) : (
                            /* 2. Image inside thread/quote slide (only show if not already covered by ExternalLinkCard) */
                            slide.quote.image &&
                            !slide.quote.externalLink && (
                                <div className={`${styles.cardMediaBox} ${!slide.quote.text ? styles.cardMediaBoxFull : ''}`}>
                                    <img
                                        src={slide.quote.image}
                                        alt={t('slideCard.quotedMediaAlt')}
                                        className={styles.imageElement}
                                        draggable={false}
                                        onPointerDown={(e) => (pointerStartX.current = e.clientX)}
                                        onClick={(e) => handleImageClick(slide.quote!.image!, undefined, e.clientX)}
                                    />
                                    <button
                                        type="button"
                                        aria-label={t('slideCard.expandQuotedImage')}
                                        className={styles.fullscreenVideoBtn}
                                        onClick={() => setFullscreenMedia({ imageUrl: slide.quote!.image! })}
                                    >
                                        <Maximize2 size={16} />
                                    </button>
                                </div>
                            )
                        )}

                        {/* 3. Text & External Link Card inside thread/quote slide */}
                        {(slide.quote.text || slide.quote.externalLink) && (
                            <div
                                className={
                                    slide.quote.video || (slide.quote.image && !slide.quote.externalLink)
                                        ? styles.cardCaptionBody
                                        : styles.textOnlyBody
                                }
                            >
                                {slide.quote.text && (
                                    <p
                                        className={getTextClass(
                                            slide.quote.text,
                                            Boolean(slide.quote.video || (slide.quote.image && !slide.quote.externalLink))
                                        )}
                                    >
                                        <RichTextView
                                            text={slide.quote.text}
                                            facets={slide.quote.facets}
                                            onMentionClick={(did) => setMentionedDid(did)}
                                            onTagClick={(tag) => setSelectedTag(tag)}
                                        />
                                    </p>
                                )}
                                {slide.quote.externalLink && <ExternalLinkCard link={slide.quote.externalLink} />}
                            </div>
                        )}
                    </>
                )}

            </div>

            {fullscreenMedia && (
                <MediaLightbox
                    imageUrl={fullscreenMedia.imageUrl}
                    altText={fullscreenMedia.altText}
                    video={fullscreenMedia.video}
                    onClose={() => setFullscreenMedia(null)}
                />
            )}

            {mentionedDid && (
                <AuthorProfileModal
                    actor={mentionedDid}
                    onClose={() => setMentionedDid(null)}
                />
            )}

            {selectedTag && (
                <HashtagFeedModal
                    tag={selectedTag}
                    onClose={() => setSelectedTag(null)}
                />
            )}
        </>
    );
}
