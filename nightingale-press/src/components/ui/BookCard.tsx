import { Link } from 'react-router-dom';
import type { Book } from '../../types';
import { BookCover } from './BookCover';
import styles from './BookCard.module.css';

const AVAILABILITY_CLASS: Record<Book['availability'], string> = {
  'In Stock': styles.inStock,
  'Pre-Order': styles.preOrder,
  'Out of Stock': styles.outOfStock,
};

export function BookCard({ book }: { book: Book }) {
  return (
    <Link to={`/books/${book.slug}`} className={styles.card}>
      <div className={styles.coverWrap}>
        <BookCover book={book} />
      </div>
      <div className={styles.meta}>
        <p className={styles.category}>{book.category.name}</p>
        <h3 className={styles.title}>{book.title}</h3>
        <p className={styles.author}>{book.author}</p>
        <div className={styles.footerRow}>
          <span className={styles.price}>₹{book.price.toLocaleString('en-IN')}</span>
          <span className={`${styles.availability} ${AVAILABILITY_CLASS[book.availability]}`}>
            {book.availability}
          </span>
        </div>
      </div>
    </Link>
  );
}
