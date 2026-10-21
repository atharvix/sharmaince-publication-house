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

interface CreateOrderResponse {
  order: ApiOrder;
  payment: { razorpayOrderId: string; amountMinor: number; currency: string; keyId: string | null; simulated: boolean };
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
  const [promotionCode, setPromotionCode] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [error, setError] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<CreateOrderResponse | null>(null);

  if (lines.length === 0 && stage === 'form') {
    return <Navigate to="/cart" replace />;
  }

  async function handlePlaceOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const items = lines.map((line) => ({ bookId: line.book.id, quantity: line.quantity }));

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
        promotionCode: promotionCode || undefined,
        shippingAddressId: selectedAddressId ?? undefined,
        shippingAddress,
      });
      setPendingOrder(res);

      if (res.payment.simulated) {
        setStage('simulate');
      } else {
        setStage('verifying');
        const response = await openRazorpayCheckout({
          keyId: res.payment.keyId!,
          orderId: res.payment.razorpayOrderId,
          amountMinor: res.payment.amountMinor,
          currency: res.payment.currency,
          customerName: user?.name ?? '',
          customerEmail: user?.email ?? '',
        });
        await verifyPayment(res.order.id, response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Payment could not be started. Please try again.');
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

  const shipping = subtotal >= 1000 ? 0 : 60;
  const total = subtotal + shipping;

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
                    <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: '1fr 1fr' }}>
                      <InputField id="co-label" name="label" label="Label" placeholder="Home" />
                      <InputField id="co-fullname" name="fullName" label="Full name" required />
                    </div>
                    <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: '1fr 1fr' }}>
                      <InputField id="co-phone" name="phone" type="tel" label="Phone" required />
                      <InputField id="co-country" name="country" label="Country" defaultValue="India" />
                    </div>
                    <InputField id="co-line1" name="line1" label="Address line 1" required />
                    <InputField id="co-line2" name="line2" label="Address line 2 (optional)" />
                    <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: '1fr 1fr 1fr' }}>
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
                  hint="Optional — applied when you place your order."
                  value={promotionCode}
                  onChange={(e) => setPromotionCode(e.target.value.toUpperCase())}
                />
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
                <Button type="submit" size="lg" variant="primary" disabled={stage === 'placing'}>
                  {stage === 'placing' ? 'Placing order…' : `Pay ₹${total.toLocaleString('en-IN')}`}
                </Button>
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
                <span>₹{(line.book.price * line.quantity).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Shipping</span>
              <span>{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
            </div>
            <div className={styles.summaryTotal}>
              <span>Total</span>
              <span>₹{total.toLocaleString('en-IN')}</span>
            </div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-ink-500)', marginTop: 'var(--space-4)' }}>
              Final total (including any promotion) is confirmed by the server when your order is placed.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
