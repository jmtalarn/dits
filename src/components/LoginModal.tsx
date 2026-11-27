'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { AtpSessionData } from '@atproto/api';
import { loginWithAppPassword } from '@/lib/bsky';
import styles from './LoginModal.module.css';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface LoginModalProps {
  onSuccess: (session: AtpSessionData) => void;
  onClose: () => void;
}

export default function LoginModal({ onSuccess, onClose }: LoginModalProps) {
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = await loginWithAppPassword(identifier, password);
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className={styles.closeBtn} aria-label={t('common.close')}>
          <X size={20} />
        </button>

        <h2 className={styles.title}>{t('login.title')}</h2>
        <p className={styles.subtitle}>
          {t('login.subtitlePrefix')}{' '}
          <a
            href="https://bsky.app"
            target="_blank"
            rel="noreferrer"
            className={styles.link}
          >
            {t('login.appPasswordLink')}
          </a>
          .
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            placeholder={t('login.handlePlaceholder')}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            className={styles.input}
          />
          <input
            type="password"
            placeholder={t('login.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={styles.input}
          />

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? t('login.signingIn') : t('login.continue')}
          </button>
        </form>
      </div>
    </div>
  );
}
