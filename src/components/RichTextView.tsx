'use client';

import { RichText, AppBskyRichtextFacet } from '@atproto/api';
import styles from './RichTextView.module.css';

interface RichTextViewProps {
    text: string;
    facets?: AppBskyRichtextFacet.Main[];
    onMentionClick?: (did: string) => void;
    onTagClick?: (tag: string) => void;
}

export default function RichTextView({
    text,
    facets,
    onMentionClick,
    onTagClick,
}: RichTextViewProps) {
    const rt = new RichText({ text, facets });

    return (
        <>
            {Array.from(rt.segments()).map((segment, i) => {
                if (segment.isLink() && segment.link) {
                    return (
                        <a
                            key={i}
                            href={segment.link.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={styles.facetLink}
                        >
                            {segment.text}
                        </a>
                    );
                }

                if (segment.isMention() && segment.mention) {
                    const did = segment.mention.did;
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onMentionClick?.(did);
                            }}
                            className={styles.facetButton}
                        >
                            {segment.text}
                        </button>
                    );
                }

                if (segment.isTag() && segment.tag) {
                    const tagValue = segment.tag.tag;
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onTagClick?.(tagValue);
                            }}
                            className={styles.facetButton}
                        >
                            {segment.text}
                        </button>
                    );
                }

                return <span key={i}>{segment.text}</span>;
            })}
        </>
    );
}
