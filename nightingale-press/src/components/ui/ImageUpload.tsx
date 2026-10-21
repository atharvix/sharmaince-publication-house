import { useRef, useState, type DragEvent } from 'react';
import styles from './ImageUpload.module.css';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

interface ImageUploadProps {
  /** Resolved, absolute URL of the currently-saved image, if any. */
  value?: string;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
  label?: string;
  hint?: string;
}

function validate(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Please choose a JPEG, PNG or WebP image.';
  if (file.size > MAX_BYTES) return 'Images must be 5MB or smaller.';
  return null;
}

export function ImageUpload({ value, onUpload, onRemove, label = 'Cover image', hint }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const preview = localPreview ?? value ?? null;

  async function handleFile(file: File) {
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setBusy(true);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload this image.');
    } finally {
      setBusy(false);
      URL.revokeObjectURL(objectUrl);
      setLocalPreview(null);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function handleRemove() {
    if (!onRemove) return;
    setBusy(true);
    setError(null);
    try {
      await onRemove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this image.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <div
        className={`${styles.dropzone} ${dragActive ? styles.active : ''} ${preview ? styles.hasPreview : ''}`.trim()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        aria-label={preview ? 'Replace cover image' : 'Upload a cover image'}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className={styles.hiddenInput}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />

        {preview ? (
          <img src={preview} alt="Cover preview" className={styles.previewImage} />
        ) : (
          <div className={styles.placeholder}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 16V4m0 0 4 4m-4-4L8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <p>Drag an image here, or click to browse</p>
          </div>
        )}

        {busy && (
          <div className={styles.busyOverlay}>
            <span className={styles.spinner} aria-hidden="true" />
            <span>Uploading…</span>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        {hint && <p className={styles.hint}>{hint}</p>}
        {preview && !busy && onRemove && (
          <button type="button" className={styles.removeButton} onClick={handleRemove}>
            Remove image
          </button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
