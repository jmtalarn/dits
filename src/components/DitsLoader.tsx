'use client';

import styles from './DitsLoader.module.css';
import { useI18n } from '@/lib/i18n/I18nProvider';

export function DitsFullLoader() {
  const { t } = useI18n();
  return (
    <div className={styles.container} role="status" aria-label={t('loader.loadingDits')}>
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
  const { t } = useI18n();
  return <div className={styles.miniSpinner} aria-label={t('loader.loadingMore')} />;
}
