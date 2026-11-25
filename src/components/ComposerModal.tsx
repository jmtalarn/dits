'use client';

import { useState, useRef } from 'react';
import { X, ImagePlus, Trash2 } from 'lucide-react';
import { AtpSessionData } from '@atproto/api';
import { createDitsPost, DitsPost } from '@/lib/bsky';
import styles from './ComposerModal.module.css';

interface ComposerModalProps {
  session: AtpSessionData;
  onPostCreated: (newPost: DitsPost) => void;
  onClose: () => void;
}

export default function ComposerModal({
  session,
  onPostCreated,
  onClose,
}: ComposerModalProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const combinedFiles = [...files, ...selected].slice(0, 4);
    setFiles(combinedFiles);
    setPreviews(combinedFiles.map((f) => URL.createObjectURL(f)));
  };

  const removeImage = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    setPreviews(updatedFiles.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && files.length === 0) || publishing) return;

    setPublishing(true);
    setError(null);

    try {
      const newPost = await createDitsPost(session, text, files);
      onPostCreated(newPost);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error publishing post');
    } finally {
      setPublishing(false);
    }
  };

  const remainingChars = 300 - text.length;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <button type="button" onClick={onClose} className={styles.closeBtn} aria-label="Close">
            <X size={18} />
          </button>
          <span className={styles.handleTag}>@{session.handle}</span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={(!text.trim() && files.length === 0) || publishing || remainingChars < 0}
            className={styles.publishBtn}
          >
            {publishing ? 'Posting...' : 'Post'}
          </button>
        </div>

        <textarea
          placeholder="What's happening in the sky?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          autoFocus
          rows={5}
          className={styles.textarea}
        />

        {previews.length > 0 && (
          <div className={styles.previewGrid}>
            {previews.map((src, idx) => (
              <div key={idx} className={styles.previewItem}>
                <img src={src} alt="Upload preview" className={styles.previewImg} />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className={styles.removeImgBtn}
                  aria-label="Remove image"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.footer}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= 4}
            className={styles.mediaBtn}
          >
            <ImagePlus size={18} />
            <span>Add photos ({files.length}/4)</span>
          </button>

          <span
            className={styles.charCounter}
            style={{ color: remainingChars < 25 ? '#f87171' : '#71717a' }}
          >
            {remainingChars}
          </span>
        </div>
      </div>
    </div>
  );
}
