import type { ApiOrderStatus } from '../../types/api';
import styles from './OrderTimeline.module.css';

const STEPS: { status: ApiOrderStatus; label: string }[] = [
  { status: 'PENDING_PAYMENT', label: 'Placed' },
  { status: 'PAID', label: 'Paid' },
  { status: 'PROCESSING', label: 'Processing' },
  { status: 'SHIPPED', label: 'Shipped' },
  { status: 'DELIVERED', label: 'Delivered' },
];

export function OrderTimeline({ status }: { status: ApiOrderStatus }) {
  if (status === 'CANCELLED' || status === 'REFUNDED') {
    return (
      <div
        className={styles.terminalBanner}
        style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
      >
        This order was {status === 'CANCELLED' ? 'cancelled' : 'refunded'}.
      </div>
    );
  }

  const currentIndex = STEPS.findIndex((step) => step.status === status);

  return (
    <div className={styles.timeline}>
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : '';
        return (
          <div key={step.status} className={`${styles.step} ${styles[state] ?? ''}`.trim()}>
            <span className={styles.line} aria-hidden="true" />
            <div className={styles.dot}>{index < currentIndex ? '✓' : index + 1}</div>
            <p className={styles.label}>{step.label}</p>
          </div>
        );
      })}
    </div>
  );
}
