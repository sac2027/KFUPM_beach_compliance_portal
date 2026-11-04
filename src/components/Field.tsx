import type { InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  /** What the field accepts: always visible, tied to the input with aria-describedby. */
  hint: string;
  error?: string;
}

export function Field({ id, label, hint, error, ...input }: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field__input"
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        {...input}
      />
      <p className="field__hint" id={hintId}>
        {hint}
      </p>
      {error && (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
