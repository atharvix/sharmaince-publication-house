import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { PageHero } from '../components/ui/PageHero';
import { BookCover } from '../components/ui/BookCover';
import { Button } from '../components/ui/Button';
import { Reveal } from '../components/ui/Reveal';
import styles from './Cart.module.css';

export default function Cart() {
  const { lines, subtotal, updateQuantity, removeItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const hasItems = lines.length > 0;

  function handleCheckout() {
    navigate(user ? '/checkout' : '/login?redirect=/checkout');
  }

  return (
    <>
      <PageHero title="Your Cart" trail={[{ label: 'Cart' }]} />

      <div className="container">
        {hasItems ? (
          <div className={styles.layout}>
            <div>
              {lines.map((line) => (
                <div className={styles.lineItem} key={line.book.id}>
                  <div className={styles.coverThumb}>
                    <BookCover book={line.book} size="small" />
                  </div>
                  <div>
                    <p className={styles.lineTitle}>{line.book.title}</p>
                    <p className={styles.lineAuthor}>{line.book.author}</p>
                    <div className={styles.lineControls}>
                      <div className={styles.stepper}>
                        <button
                          type="button"
                          className={styles.stepperButton}
                          onClick={() => updateQuantity(line.book.id, line.quantity - 1)}
                          aria-label={`Decrease quantity of ${line.book.title}`}
                        >
                          −
                        </button>
                        <span className={styles.stepperValue}>{line.quantity}</span>
                        <button
                          type="button"
                          className={styles.stepperButton}
                          onClick={() => updateQuantity(line.book.id, line.quantity + 1)}
                          aria-label={`Increase quantity of ${line.book.title}`}
                        >
                          +
                        </button>
                      </div>
                      <button type="button" className={styles.removeButton} onClick={() => removeItem(line.book.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <span className={styles.linePrice}>₹{(line.book.price * line.quantity).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>

            <Reveal className={styles.summaryCard}>
              <h2 style={{ fontSize: 'var(--fs-md)' }}>Order Summary</h2>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              <div className={styles.summaryTotal}>
                <span>Estimated total</span>
                <span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ marginTop: 'var(--space-5)' }}>
                <Button size="lg" variant="primary" onClick={handleCheckout} type="button">
                  Proceed to Checkout
                </Button>
              </div>
              <p className={styles.note}>Final totals, including shipping, are confirmed on the next step.</p>
            </Reveal>
          </div>
        ) : (
          <div className={styles.emptyState} style={{ marginBlock: 'var(--space-8)' }}>
            <p className={styles.emptyIcon}>🛒</p>
            <p style={{ marginBottom: 'var(--space-5)' }}>Your cart is empty.</p>
            <Button to="/books" variant="primary" size="md">
              Browse Books
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
