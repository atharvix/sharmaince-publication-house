import { Button } from './Button';
import styles from './RequestState.module.css';

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={styles.errorWrap} role="alert">
      <p className={styles.errorIcon} aria-hidden="true">
        ⚠
      </p>
      <p>{message}</p>
      {onRetry && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button variant="outline" size="sm" onClick={onRetry} type="button">
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
