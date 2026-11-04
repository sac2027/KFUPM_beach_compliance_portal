import type { ButtonHTMLAttributes } from 'react';

/**
 * While `busy` the button stays focusable (aria-disabled, not disabled) so keyboard focus is not lost;
 * callers must also guard against re-entry. `quiet` is the secondary, text-only action.
 */
export function Button({
  busy = false,
  variant = 'primary',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; variant?: 'primary' | 'quiet' }) {
  return (
    <button
      className={variant === 'quiet' ? 'btn btn--quiet' : 'btn'}
      aria-busy={busy ? 'true' : 'false'}
      aria-disabled={busy ? 'true' : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
