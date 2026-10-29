import { Link } from 'react-router-dom';
import { useFetch } from '../../hooks/useFetch';
import { api } from '../../lib/api';
import type { ApiWishlistItem } from '../../types/api';
import { mapApiBook } from '../../lib/catalogue';
import { useCart, snapshotFromBook } from '../../context/CartContext';
import { BookCover } from '../../components/ui/BookCover';
import { Button } from '../../components/ui/Button';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AccountLayout.module.css';
import { formatBookPrice } from '../../lib/format';

export default function AccountWishlist() {
  const { addItem } = useCart();
  const { data: items, loading, error, reload } = useFetch(
    () => api.get<{ items: ApiWishlistItem[] }>('/me/wishlist').then((r) => r.items),
    [],
  );

  async function handleRemove(bookId: string) {
    await api.delete(`/me/wishlist/${bookId}`);
    reload();
  }

  function handleMoveToCart(item: ApiWishlistItem) {
    const book = mapApiBook(item.book);
    if (book.price === null) return;
    addItem(snapshotFromBook({ ...book, price: book.price }), 1);
    handleRemove(item.bookId);
  }

  if (loading) return <LoadingBlock label="Loading wishlist…" />;
  if (error || !items) return <ErrorBlock message={error ?? 'Could not load your wishlist.'} onRetry={reload} />;

  return (
    <div>
      <h2 className={styles.panelTitle}>Wishlist</h2>
      {items.length === 0 ? (
        <p style={{ color: 'var(--color-ink-500)' }}>
          Nothing saved yet. <Link to="/books" style={{ color: 'var(--color-primary-700)', fontWeight: 600 }}>Browse the catalogue</Link>.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {items.map((item) => {
            const book = mapApiBook(item.book);
            return (
              <div key={item.id} className={styles.card} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 'var(--space-4)', alignItems: 'center' }}>
                <div style={{ width: 64 }}>
                  <BookCover book={book} size="small" />
                </div>
                <div>
                  <Link to={`/books/${book.slug}`} style={{ fontWeight: 600 }}>
                    {book.title}
                  </Link>
                  <p style={{ color: 'var(--color-ink-500)', fontSize: 'var(--fs-sm)' }}>
                    {book.author} · {formatBookPrice(book.price)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button size="sm" variant="primary" type="button" disabled={book.price === null} onClick={() => handleMoveToCart(item)}>
                    Move to cart
                  </Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => handleRemove(item.bookId)}>
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
