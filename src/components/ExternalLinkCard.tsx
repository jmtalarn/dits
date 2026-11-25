'use client';

import { ExternalLink } from 'lucide-react';
import { DitsExternalLink } from '@/lib/bsky';
import styles from './PostSlide.module.css';

export default function ExternalLinkCard({ link }: { link: DitsExternalLink }) {
  return (
    <a
      href={link.uri}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={styles.externalLinkCard}
    >
      {link.thumb && (
        <img
          src={link.thumb}
          alt={link.title}
          className={styles.externalLinkThumb}
          draggable={false}
          loading="lazy"
        />
      )}
      <div className={styles.externalLinkBody}>
        <span className={styles.externalLinkDomain}>
          <ExternalLink size={12} />
          <span>{link.domain}</span>
        </span>
        <span className={styles.externalLinkTitle}>{link.title}</span>
        {link.description && (
          <span className={styles.externalLinkDesc}>{link.description}</span>
        )}
      </div>
    </a>
  );
}
