'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { AtpSessionData } from '@atproto/api';
import { loginWithAppPassword } from '@/lib/bsky';
import styles from './LoginModal.module.css';

interface LoginModalProps {
  onSuccess: (session: AtpSessionData) => void;
  onClose: () => void;
}

export default function LoginModal({ onSuccess, onClose }: LoginModalProps) {
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
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
          <X size={20} />
        </button>

        <h2 className={styles.title}>Sign in to Dits</h2>
        <p className={styles.subtitle}>
          Use your Bluesky handle and an{' '}
          <a
            href="https://bsky.app"
            target="_blank"
            rel="noreferrer"
            className={styles.link}
          >
            App Password
          </a>
          .
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            placeholder="Handle (e.g. you.bsky.social)"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            className={styles.input}
          />
          <input
            type="password"
            placeholder="App Password (xxxx-xxxx-xxxx-xxxx)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={styles.input}
          />

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Signing in...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
