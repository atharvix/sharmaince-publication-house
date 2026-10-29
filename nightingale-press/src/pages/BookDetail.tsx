import { useEffect, useState } from 'react';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchBookBySlug } from '../lib/catalogue';
import { useFetch } from '../hooks/useFetch';
import type { Book } from '../types';
import type { ApiWishlistItem } from '../types/api';
import { MAX_QUANTITY_PER_TITLE, useCart, snapshotFromBook } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import { subjectColor } from '../lib/subjects';
import { BookCover } from '../components/ui/BookCover';
import { BookCard } from '../components/ui/BookCard';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Button } from '../components/ui/Button';
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
  const [wishlistError, setWishlistError] = useState<string | null>(null);

  const { data, loading, error, reload } = useFetch(() => {
    if (!slug) return Promise.reject(new Error('Missing slug'));
    return fetchBookBySlug(slug);
  }, [slug]);

  const bookId = data?.book.id;

  // Reflect whether this title is already saved, rather than always starting unsaved.
  useEffect(() => {
    if (!user || !bookId) return;
    let cancelled = false;
    api
      .get<{ items: ApiWishlistItem[] }>('/me/wishlist')
      .then((res) => {
        if (!cancelled) setWishlisted(res.items.some((item) => item.bookId === bookId));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, bookId]);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 4000);
    return () => window.clearTimeout(timer);
  }, [added]);

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
  }

  async function handleWishlist() {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/books/${book.slug}`)}`);
      return;
    }
    setWishlistBusy(true);
    setWishlistError(null);
    try {
      if (wishlisted) await api.delete(`/me/wishlist/${book.id}`);
      else await api.post('/me/wishlist', { bookId: book.id });
      setWishlisted(!wishlisted);
    } catch (err) {
      setWishlistError(err instanceof ApiError ? err.message : 'Could not update your saved books.');
    } finally {
      setWishlistBusy(false);
    }
  }

  const details: [string, string][] = [
    ['Edition', book.edition],
    ['Format', book.format],
    ['Pages', String(book.pages)],
    ['ISBN', book.isbn],
  ];

  return (
    <div className="container">
      <div className={styles.crumbs}>
        <Breadcrumbs trail={[{ label: 'Books', to: '/books' }, { label: book.category.name, to: `/books?category=${book.category.slug}` }, { label: book.title }]} />
      </div>

      <div className={styles.layout}>
        <div className={styles.coverCol}>
          <div className={styles.coverFrame}>
            <BookCover book={book} />
            {book.newRelease && (
              <span className={styles.sticker} aria-label="New edition">
                NEW
                <br />
                ED.
              </span>
            )}
          </div>
        </div>

        <div>
          <Link to={`/books?category=${book.category.slug}`} className={styles.subject}>
            <span className={styles.dot} style={{ background: subjectColor(book.category.slug) }} aria-hidden="true" />
            {book.category.name}
          </Link>
          <h1 className={styles.title}>{book.title}</h1>
          {book.subtitle && <p className={styles.subtitle}>{book.subtitle}</p>}
          <p className={styles.author}>
            {book.author}
          </p>

          <dl className={styles.details}>
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="hand">{label}</dt>
                <dd className="tabular">{value}</dd>
              </div>
            ))}
          </dl>

          <div className={styles.buy}>
            <div className={styles.priceRow}>
              <span className={`${styles.price} hand`}>{formatRupees(book.price)}</span>
              <span className={`${styles.availability} ${AVAILABILITY_CLASS[book.availability]}`}>{book.availability}</span>
            </div>

            <div className={styles.actions}>
              <div className={styles.stepper} role="group" aria-label="Quantity">
                <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={!canOrder || quantity <= 1} aria-label="Decrease quantity">
                  −
                </button>
                <span className="tabular" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY_PER_TITLE, q + 1))}
                  disabled={!canOrder || quantity >= MAX_QUANTITY_PER_TITLE}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <Button size="md" variant="primary" disabled={!canOrder} onClick={handleAddToCart}>
                {canOrder ? 'Add to cart' : 'Out of stock'}
              </Button>
              <Button size="md" variant="outline" disabled={wishlistBusy} onClick={handleWishlist}>
                {wishlisted ? 'Saved' : 'Save for later'}
              </Button>
            </div>

            <div className={styles.feedback} role="status">
              {added && (
                <p className={styles.added}>
                  Added {quantity > 1 ? `${quantity} copies` : 'to your cart'}. <Link to="/cart">View cart</Link>
                </p>
              )}
              {wishlistError && <p className={styles.errorText}>{wishlistError}</p>}
            </div>
          </div>

          <Link to={`/contact?reason=inspection&title=${encodeURIComponent(book.title)}`} className={styles.inspection}>
            <GraduationCap className={styles.inspectionIcon} size={22} strokeWidth={1.75} aria-hidden="true" />
            <span>
              <strong>Teaching this subject?</strong> Request an inspection copy for your course.
            </span>
            <ArrowRight size={20} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <section className={styles.about}>
        <h2 className={styles.sectionTitle}>What's inside</h2>
        <p className={styles.description}>{book.description}</p>
        {book.highlights.length > 0 && (
          <ul className={styles.highlights}>
            {book.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        )}
      </section>

      {related.length > 0 && (
        <section className={styles.related}>
          <h2 className={styles.sectionTitle}>More in {book.category.name}</h2>
          <div className={styles.relatedGrid}>
            {related.map((relatedBook) => (
              <BookCard key={relatedBook.slug} book={relatedBook} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
