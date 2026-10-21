import type { Book } from '../../types';
import { resolveAssetUrl } from '../../lib/api';
import styles from './BookCover.module.css';

interface BookCoverProps {
  book: Pick<Book, 'title' | 'author' | 'coverPalette' | 'edition' | 'format' | 'coverImageUrl'>;
  size?: 'md' | 'small';
}

/** Renders an uploaded cover photo when one exists, otherwise a designed CSS-generated cover. */
export function BookCover({ book, size = 'md' }: BookCoverProps) {
  const imageUrl = resolveAssetUrl(book.coverImageUrl);

  if (imageUrl) {
    return (
      <div className={`${styles.cover} ${styles.photo} ${size === 'small' ? styles.small : ''}`.trim()}>
        <img src={imageUrl} alt={`Cover of ${book.title} by ${book.author}`} loading="lazy" />
      </div>
    );
  }

  return (
    <div
      className={`${styles.cover} ${size === 'small' ? styles.small : ''}`.trim()}
      data-palette={book.coverPalette}
      role="img"
      aria-label={`Cover of ${book.title} by ${book.author}`}
    >
      <div className={styles.topRow}>
        <span>{book.edition}</span>
        {book.format === 'E-Book' && <span className={styles.badge}>E-Book</span>}
      </div>
      <div className={styles.textBlock}>
        <p className={styles.title}>{book.title}</p>
        <p className={styles.author}>{book.author}</p>
      </div>
    </div>
  );
}
