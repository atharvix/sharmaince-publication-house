import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import styles from './FormField.module.css';

interface FieldMeta {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
}

function FieldShell({
  id,
  label,
  required,
  error,
  hint,
  children,
}: FieldMeta & { children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : (
        hint && <span className={styles.hint}>{hint}</span>
      )}
    </div>
  );
}

type InputFieldProps = FieldMeta & InputHTMLAttributes<HTMLInputElement>;

export function InputField({ id, label, required, error, hint, ...rest }: InputFieldProps) {
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint}>
      <input
        id={id}
        className={styles.control}
        required={required}
        aria-invalid={Boolean(error)}
        {...rest}
      />
    </FieldShell>
  );
}

type TextareaFieldProps = FieldMeta & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function TextareaField({ id, label, required, error, hint, ...rest }: TextareaFieldProps) {
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint}>
      <textarea
        id={id}
        className={styles.control}
        required={required}
        aria-invalid={Boolean(error)}
        {...rest}
      />
    </FieldShell>
  );
}

type SelectFieldProps = FieldMeta & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode };

export function SelectField({ id, label, required, error, hint, children, ...rest }: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint}>
      <select
        id={id}
        className={styles.control}
        required={required}
        aria-invalid={Boolean(error)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}
