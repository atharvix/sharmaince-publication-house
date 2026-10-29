import type { Book } from '../../types';
import { resolveAssetUrl } from '../../lib/api';
import { subjectColor } from '../../lib/subjects';
import styles from './BookCover.module.css';

interface BookCoverProps {
  book: Pick<Book, 'title' | 'author' | 'edition' | 'format'> & {
    coverImageUrl?: string | null;
    category?: { name: string; slug: string };
    coverPalette?: Book['coverPalette'];
  };
  size?: 'md' | 'small';
}

/**
 * The uploaded cover photo when there is one. Until then, a typographic cut-out in the
 * subject's band colour, marked "cover to come" so it isn't mistaken for the printed
 * cover. Same 3:4 frame either way, so photos drop in without reflow.
 */
export function BookCover({ book, size = 'md' }: BookCoverProps) {
  const imageUrl = resolveAssetUrl(book.coverImageUrl);
  const sizeClass = size === 'small' ? styles.small : '';

  if (imageUrl) {
    return (
      <div className={`${styles.cover} ${styles.photo} ${sizeClass}`.trim()}>
        <img src={imageUrl} alt={`Cover of ${book.title} by ${book.author}`} loading="lazy" />
      </div>
    );
  }

  return (
    <div className={`${styles.cover} ${sizeClass}`.trim()} role="img" aria-label={`${book.title} by ${book.author} (cover photo coming soon)`}>
      <div className={styles.band} style={{ background: book.category ? subjectColor(book.category.slug) : 'var(--color-ink-900)' }}>
        <span>{(book.category?.name ?? book.format).toUpperCase()}</span>
      </div>
      <div className={styles.body}>
        <p className={styles.title}>{book.title}</p>
        <p className={styles.author}>{book.author}</p>
      </div>
      <p className={styles.note}>
        <span>{book.edition.replace(/ Edition$/, ' ed.')}</span>
        <span>cover to come</span>
      </p>
    </div>
  );
}
