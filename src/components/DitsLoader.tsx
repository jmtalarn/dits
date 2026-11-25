'use client';

import styles from './DitsLoader.module.css';

export function DitsFullLoader() {
  return (
    <div className={styles.container} role="status" aria-label="Loading Dits">
      <div className={styles.skeletonCard}>
        <div className={styles.orbWrapper}>
          <span className={styles.pulseRing} />
          <span className={`${styles.pulseRing} ${styles.pulseRingDelay}`} />
          <div className={styles.brandMark}>dits</div>
        </div>
      </div>

      <div className={styles.skeletonFooter}>
        <div className={styles.skeletonAvatar} />
        <div className={styles.skeletonLines}>
          <div className={styles.skeletonLine} style={{ width: '120px' }} />
          <div className={styles.skeletonLine} style={{ width: '85px' }} />
        </div>
      </div>
    </div>
  );
}

export function DitsMiniSpinner() {
  return <div className={styles.miniSpinner} aria-label="Loading more" />;
}
