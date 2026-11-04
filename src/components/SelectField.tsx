import type { SelectHTMLAttributes } from 'react';

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  hint: string;
  error?: string;
  /** Text of the empty first option (value ""). */
  placeholder: string;
  options: ReadonlyArray<readonly [value: string, label: string]>;
}

/** A native select: the platform's own picker is the most accessible and, on a phone, the easiest way to choose from ~200 countries. */
export function SelectField({ id, label, hint, error, placeholder, options, ...select }: SelectFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="field__input field__select"
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        {...select}
      >
        <option value="">{placeholder}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
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
