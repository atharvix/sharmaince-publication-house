import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { api, ApiError } from '../lib/api';
import { openRazorpayCheckout } from '../lib/razorpayCheckout';
import type { ApiAddress, ApiOrder } from '../types/api';
import { PageHero } from '../components/ui/PageHero';
import { InputField } from '../components/ui/FormField';
import { Button } from '../components/ui/Button';
import { ErrorBlock, LoadingBlock } from '../components/ui/RequestState';
import styles from './Checkout.module.css';
import { formatMinor, formatRupees } from '../lib/format';

interface CreateOrderResponse {
  order: ApiOrder;
  payment: { razorpayOrderId: string; amountMinor: number; currency: string; keyId: string | null; simulated: boolean };
}

interface Quote {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  promotion: { code: string } | null;
}

type Stage = 'form' | 'placing' | 'simulate' | 'verifying' | 'failed';

export default function Checkout() {
  const { lines, subtotal, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: addresses, loading: loadingAddresses } = useFetch(
    () => api.get<{ items: ApiAddress[] }>('/me/addresses').then((r) => r.items),
    [],
  );

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [promotionInput, setPromotionInput] = useState('');
  // Only a code the server has accepted is sent with the order.
  const [appliedPromotion, setAppliedPromotion] = useState<string | undefined>(undefined);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('form');
  const [error, setError] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<CreateOrderResponse | null>(null);

  const items = lines.map((line) => ({ bookId: line.book.id, quantity: line.quantity }));
  const itemsKey = JSON.stringify(items);
  // Totals come from the server, which owns pricing, shipping and promotion rules.
  const { data: quote, error: quoteError } = useFetch(
    () => (items.length ? api.post<{ quote: Quote }>('/checkout/quote', { items, promotionCode: appliedPromotion }).then((r) => r.quote) : Promise.resolve(null)),
    [itemsKey, appliedPromotion],
  );

  if (lines.length === 0 && stage === 'form') {
    return <Navigate to="/cart" replace />;
  }

  async function handleApplyPromotion() {
    const code = promotionInput.trim();
    setPromotionError(null);
    if (!code) {
      setAppliedPromotion(undefined);
      return;
    }
    try {
      await api.post('/checkout/quote', { items, promotionCode: code });
      setAppliedPromotion(code);
    } catch (err) {
      setPromotionError(err instanceof ApiError ? err.message : 'Could not check this code.');
    }
  }

  async function payForOrder(order: CreateOrderResponse) {
    if (order.payment.simulated) {
      setStage('simulate');
      return;
    }
    setStage('verifying');
    const response = await openRazorpayCheckout({
      keyId: order.payment.keyId!,
      orderId: order.payment.razorpayOrderId,
      amountMinor: order.payment.amountMinor,
      currency: order.payment.currency,
      customerName: user?.name ?? '',
      customerEmail: user?.email ?? '',
    });
    await verifyPayment(order.order.id, response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
  }

  async function handleCancelPendingOrder() {
    if (!pendingOrder) return;
    try {
      await api.post(`/checkout/orders/${pendingOrder.order.id}/cancel`);
    } catch {
      // Already paid, cancelled or expired — nothing left to release.
    }
    setPendingOrder(null);
    setError(null);
    setStage('form');
  }

  async function handlePlaceOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // An order already exists for this checkout (the payment window was closed or failed):
    // retry paying for it rather than reserving the stock a second time.
    if (pendingOrder) {
      try {
        await payForOrder(pendingOrder);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Payment could not be started.');
        setStage('failed');
      }
      return;
    }

    const form = new FormData(event.currentTarget);

    const shippingAddress = selectedAddressId
      ? undefined
      : {
          label: String(form.get('label') || 'Shipping'),
          fullName: String(form.get('fullName')),
          phone: String(form.get('phone')),
          line1: String(form.get('line1')),
          line2: String(form.get('line2') || '') || undefined,
          city: String(form.get('city')),
          state: String(form.get('state')),
          postalCode: String(form.get('postalCode')),
          country: String(form.get('country') || 'India'),
        };

    if (!selectedAddressId && !shippingAddress?.fullName) {
      setError('Please select or add a shipping address.');
      return;
    }

    setStage('placing');
    try {
      const res = await api.post<CreateOrderResponse>('/checkout/orders', {
        items,
        promotionCode: appliedPromotion,
        shippingAddressId: selectedAddressId ?? undefined,
        shippingAddress,
      });
      setPendingOrder(res);
      await payForOrder(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Payment could not be started. Please try again.');
      setStage('failed');
    }
  }

  async function verifyPayment(orderId: string, razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string) {
    setStage('verifying');
    try {
      await api.post('/checkout/verify', { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature });
      clear();
      navigate(`/checkout/confirmation/${orderId}`, { replace: true });
    } catch (err) {
      // An expired order can't be paid any more (the server refunded the attempt); start fresh.
      if (err instanceof ApiError && err.code === 'ORDER_EXPIRED') setPendingOrder(null);
      setError(err instanceof ApiError ? err.message : 'We could not verify your payment.');
      setStage('failed');
    }
  }

  function handleSimulate(outcome: 'success' | 'failure') {
    if (!pendingOrder) return;
    const paymentId = `pay_dev_${outcome}_${Date.now()}`;
    const signature = outcome === 'success' ? `simulated.${pendingOrder.payment.razorpayOrderId}.${paymentId}` : 'intentionally-invalid';
    verifyPayment(pendingOrder.order.id, pendingOrder.payment.razorpayOrderId, paymentId, signature);
  }

  const payLabel = pendingOrder
    ? `Retry payment of ${formatMinor(pendingOrder.payment.amountMinor)}`
    : quote
      ? `Pay ${formatRupees(quote.total)}`
      : 'Place order';

  return (
    <>
      <PageHero title="Checkout" trail={[{ label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} />
      <div className="container">
        <div className={styles.layout}>
          <div>
            <form onSubmit={handlePlaceOrder}>
              <div className={styles.card}>
                <h2 className={styles.sectionTitle}>Shipping address</h2>
                {loadingAddresses && <LoadingBlock label="Loading addresses…" />}
                {addresses?.map((address) => (
                  <label
                    key={address.id}
                    className={`${styles.addressOption} ${selectedAddressId === address.id ? styles.selected : ''}`.trim()}
                  >
                    <input
                      type="radio"
                      name="addressChoice"
                      checked={selectedAddressId === address.id}
                      onChange={() => {
                        setSelectedAddressId(address.id);
                        setShowNewAddress(false);
                      }}
                    />
                    <span>
                      <strong>{address.label}</strong>
                      <br />
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-ink-500)' }}>
                        {address.fullName}, {address.line1}, {address.city}, {address.state} {address.postalCode}
                      </span>
                    </span>
                  </label>
                ))}

                <label className={`${styles.addressOption} ${showNewAddress ? styles.selected : ''}`.trim()}>
                  <input
                    type="radio"
                    name="addressChoice"
                    checked={showNewAddress}
                    onChange={() => {
                      setShowNewAddress(true);
                      setSelectedAddressId(null);
                    }}
                  />
                  <span>Use a new address</span>
                </label>

                {showNewAddress && (
                  <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
                    <div className="form-grid form-grid--2">
                      <InputField id="co-label" name="label" label="Label" placeholder="Home" />
                      <InputField id="co-fullname" name="fullName" label="Full name" required />
                    </div>
                    <div className="form-grid form-grid--2">
                      <InputField id="co-phone" name="phone" type="tel" label="Phone" required />
                      <InputField id="co-country" name="country" label="Country" defaultValue="India" />
                    </div>
                    <InputField id="co-line1" name="line1" label="Address line 1" required />
                    <InputField id="co-line2" name="line2" label="Address line 2 (optional)" />
                    <div className="form-grid form-grid--3">
                      <InputField id="co-city" name="city" label="City" required />
                      <InputField id="co-state" name="state" label="State" required />
                      <InputField id="co-postal" name="postalCode" label="PIN code" required />
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.card}>
                <InputField
                  id="co-promo"
                  label="Promotion code"
                  placeholder="e.g. WELCOME10"
                  hint={appliedPromotion ? `${appliedPromotion} applied.` : 'Optional.'}
                  value={promotionInput}
                  disabled={Boolean(pendingOrder)}
                  onChange={(e) => setPromotionInput(e.target.value.toUpperCase())}
                />
                {promotionError && (
                  <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-sm)', marginTop: 'var(--space-2)' }}>
                    {promotionError}
                  </p>
                )}
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <Button type="button" size="sm" variant="outline" disabled={Boolean(pendingOrder)} onClick={handleApplyPromotion}>
                    {appliedPromotion && promotionInput.trim() === appliedPromotion ? 'Applied' : 'Apply code'}
                  </Button>
                </div>
              </div>

              {error && (
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <ErrorBlock message={error} />
                </div>
              )}

              {stage === 'simulate' && pendingOrder && (
                <div className={styles.devPanel}>
                  <p className={styles.devPanelTitle}>Dev payment simulator (no live Razorpay keys configured)</p>
                  <p style={{ fontSize: 'var(--fs-sm)' }}>
                    Order {pendingOrder.order.orderNumber} is awaiting payment. Simulate an outcome to continue testing the flow.
                  </p>
                  <div className={styles.devPanelActions}>
                    <Button type="button" variant="primary" size="sm" onClick={() => handleSimulate('success')}>
                      Simulate successful payment
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleSimulate('failure')}>
                      Simulate failed payment
                    </Button>
                  </div>
                </div>
              )}

              {stage === 'form' || stage === 'placing' || stage === 'failed' ? (
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <Button type="submit" size="lg" variant="primary" disabled={stage === 'placing' || (!quote && !pendingOrder)}>
                    {stage === 'placing' ? 'Placing order…' : payLabel}
                  </Button>
                  {pendingOrder && stage === 'failed' && (
                    <Button type="button" size="lg" variant="ghost" onClick={handleCancelPendingOrder}>
                      Cancel order
                    </Button>
                  )}
                </div>
              ) : stage === 'verifying' ? (
                <LoadingBlock label="Confirming your payment…" />
              ) : null}
            </form>
          </div>

          <div className={styles.summaryCard}>
            <h2 className={styles.sectionTitle}>Order summary</h2>
            {lines.map((line) => (
              <div key={line.book.id} className={styles.summaryRow}>
                <span>
                  {line.book.title} × {line.quantity}
                </span>
                <span>{formatRupees(line.book.price * line.quantity)}</span>
              </div>
            ))}
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span>{formatRupees(quote?.subtotal ?? subtotal)}</span>
            </div>
            {quote && quote.discount > 0 && (
              <div className={styles.summaryRow}>
                <span>Discount{quote.promotion ? ` (${quote.promotion.code})` : ''}</span>
                <span>−{formatRupees(quote.discount)}</span>
              </div>
            )}
            <div className={styles.summaryRow}>
              <span>Shipping</span>
              <span>{quote ? (quote.shipping === 0 ? 'Free' : formatRupees(quote.shipping)) : '—'}</span>
            </div>
            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>{quote ? formatRupees(quote.total) : '—'}</span>
            </div>
            {quoteError && (
              <p role="alert" style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-error)', marginTop: 'var(--space-4)' }}>
                {quoteError}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
