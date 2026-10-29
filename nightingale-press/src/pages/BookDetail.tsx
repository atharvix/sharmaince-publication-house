import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchBookBySlug } from '../lib/catalogue';
import { useFetch } from '../hooks/useFetch';
import type { Book } from '../types';
import { useCart, snapshotFromBook } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import { BookCover } from '../components/ui/BookCover';
import { BookCard } from '../components/ui/BookCard';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Button } from '../components/ui/Button';
import { Reveal } from '../components/ui/Reveal';
import { LoadingBlock, ErrorBlock } from '../components/ui/RequestState';
import styles from './BookDetail.module.css';
import { formatRupees } from '../lib/format';

const AVAILABILITY_CLASS: Record<Book['availability'], string> = {
  'In Stock': styles.inStock,
  'Pre-Order': styles.preOrder,
  'Out of Stock': styles.outOfStock,
};

export default function BookDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);

  const { data, loading, error, reload } = useFetch(() => {
    if (!slug) return Promise.reject(new Error('Missing slug'));
    return fetchBookBySlug(slug);
  }, [slug]);

  if (loading) return <LoadingBlock label="Loading book…" />;
  if (error || !data) {
    return (
      <div className="container" style={{ paddingBlock: 'var(--space-8)' }}>
        <ErrorBlock message={error ?? 'This book could not be found.'} onRetry={reload} />
      </div>
    );
  }

  const { book, related } = data;
  const canOrder = book.availability !== 'Out of Stock';

  function handleAddToCart() {
    addItem(snapshotFromBook(book), quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2400);
  }

  async function handleWishlist() {
    if (!user) {
      navigate(`/login?redirect=/books/${slug}`);
      return;
    }
    setWishlistBusy(true);
    try {
      if (wishlisted) {
        await api.delete(`/me/wishlist/${book.id}`);
        setWishlisted(false);
      } else {
        await api.post('/me/wishlist', { bookId: book.id });
        setWishlisted(true);
      }
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setWishlistBusy(false);
    }
  }

  return (
    <div className="container">
      <div style={{ paddingTop: 'var(--space-5)' }}>
        <Breadcrumbs trail={[{ label: 'Books', to: '/books' }, { label: book.title }]} />
      </div>

      <div className={styles.layout}>
        <Reveal as="div" className={styles.coverCol}>
          <div className={styles.coverShadow}>
            <BookCover book={book} />
          </div>
        </Reveal>

        <Reveal delay={90}>
          <p className={styles.category}>{book.category.name}</p>
          <h1 className={styles.title}>{book.title}</h1>
          {book.subtitle && <p className={styles.subtitle}>{book.subtitle}</p>}
          <p className={styles.author}>by {book.author}</p>

          <div className={styles.metaRow}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Edition</span>
              <span className={styles.metaValue}>{book.edition}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Format</span>
              <span className={styles.metaValue}>{book.format}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Pages</span>
              <span className={styles.metaValue}>{book.pages}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>ISBN</span>
              <span className={styles.metaValue}>{book.isbn}</span>
            </div>
          </div>

          <div className={styles.purchaseRow}>
            <span className={styles.price}>{formatRupees(book.price)}</span>
            <span className={`${styles.availability} ${AVAILABILITY_CLASS[book.availability]}`}>
              {book.availability}
            </span>
          </div>

          <div className={styles.actionsRow}>
            <div className={styles.stepper}>
              <button
                type="button"
                className={styles.stepperButton}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={!canOrder || quantity <= 1}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className={styles.stepperValue} aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                className={styles.stepperButton}
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                disabled={!canOrder}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <Button size="md" variant="primary" disabled={!canOrder} onClick={handleAddToCart}>
              {canOrder ? 'Add to Cart' : 'Out of Stock'}
            </Button>
            <Button size="md" variant="outline" disabled={wishlistBusy} onClick={handleWishlist} type="button">
              {wishlisted ? '♥ Saved' : '♡ Save for later'}
            </Button>
            {added && (
              <span className={styles.confirmation}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Added to cart
              </span>
            )}
          </div>

          <div className={styles.body}>
            <h2 className={styles.sectionTitle}>About this book</h2>
            <p>{book.description}</p>
            <ul className={styles.highlightList}>
              {book.highlights.map((highlight) => (
                <li className={styles.highlightItem} key={highlight}>
                  <span className={styles.highlightDot} aria-hidden="true" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      {related.length > 0 && (
        <section className={styles.relatedSection}>
          <Reveal>
            <h2 className={styles.sectionTitle}>More in {book.category.name}</h2>
          </Reveal>
          <div className={styles.bookGrid}>
            {related.map((relatedBook, index) => (
              <Reveal key={relatedBook.slug} delay={index * 70}>
                <BookCard book={relatedBook} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
