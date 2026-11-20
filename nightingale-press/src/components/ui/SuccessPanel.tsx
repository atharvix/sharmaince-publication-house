import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Button } from './Button';
import styles from './SuccessPanel.module.css';

interface SuccessPanelProps {
  title: string;
  body: ReactNode;
  resetLabel?: string;
  onReset?: () => void;
}

export function SuccessPanel({ title, body, resetLabel, onReset }: SuccessPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.icon} aria-hidden="true">
        <Check size={26} strokeWidth={2.25} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.body}>{body}</p>
      {onReset && (
        <div className={styles.action}>
          <Button variant="ghost" size="sm" type="button" onClick={onReset}>
            {resetLabel ?? 'Submit another'}
          </Button>
        </div>
      )}
    </div>
  );
}
