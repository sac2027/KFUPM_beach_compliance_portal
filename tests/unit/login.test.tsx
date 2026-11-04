import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginScreen } from '../../src/features/login/LoginScreen';
import ar from '../../src/i18n/ar.json';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { ServiceError } from '../../src/services/types';
import type { AuthService, Session } from '../../src/services/types';

const session: Session = {
  sessionId: 's-1',
  student: { email: 'mai@example.com', passportLast4: '4567' },
  issuedAt: '2026-11-01T10:00:00.000Z',
};
const makeAuth = (login: AuthService['login']): AuthService => ({ login: vi.fn(login), logout: vi.fn() });

function setup(auth: AuthService) {
  const onLoggedIn = vi.fn();
  render(
    <I18nProvider>
      <LoginScreen auth={auth} onLoggedIn={onLoggedIn} />
    </I18nProvider>,
  );
  const user = userEvent.setup();
  const f = {
    email: () => screen.getByLabelText(/email address/i),
    passport: () => screen.getByLabelText(/passport number/i),
    submit: () => screen.getByRole('button', { name: /sign in|signing in/i }),
  };
  const fill = async (p = 'a1234567', e = 'Mai@Example.com') => {
    await user.type(f.email(), e);
    await user.type(f.passport(), p);
  };
  return { user, f, fill, onLoggedIn };
}

describe('LoginScreen', () => {
  it('shows two errors on an empty submit, focuses the first, and does not call auth', async () => {
    const auth = makeAuth(async () => session);
    const { user, f } = setup(auth);
    await user.click(f.submit());
    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
    for (const el of [f.email(), f.passport()]) expect(el).toHaveAttribute('aria-invalid', 'true');
    expect(f.email()).toHaveFocus();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('asks for exactly two fields, in the order email then passport number', () => {
    setup(makeAuth(async () => session));
    expect([...document.querySelectorAll('.field__label')].map((l) => l.textContent)).toEqual(['Email address', 'Passport number']);
    for (const gone of [/full name/i, /phone/i, /nationality/i]) expect(screen.queryByLabelText(gone)).toBeNull();
  });

  it('signs in with normalised values and reports the session', async () => {
    const auth = makeAuth(async () => session);
    const { user, f, fill, onLoggedIn } = setup(auth);
    await fill();
    await user.click(f.submit());
    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledWith(session));
    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(auth.login).toHaveBeenCalledWith({ email: 'mai@example.com', passportNumber: 'A1234567' });
  });

  it('accepts Arabic-Indic digits in the passport number', async () => {
    const auth = makeAuth(async () => session);
    const { user, f, fill } = setup(auth);
    await fill('N١٢٣٤٥٦٧');
    await user.click(f.submit());
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith({ email: 'mai@example.com', passportNumber: 'N1234567' }));
  });

  it('validates a field when it loses focus, linking the error with aria-describedby', async () => {
    const { user, f } = setup(makeAuth(async () => session));
    await user.type(f.passport(), 'P<');
    await user.tab();
    const err = await screen.findByText(/5–20 letters and numbers/);
    expect(f.passport().getAttribute('aria-describedby')).toContain(err.id);
  });

  it('allows only one request in flight and shows a stable pending state', async () => {
    let resolve!: (s: Session) => void;
    const auth = makeAuth(() => new Promise<Session>((r) => (resolve = r)));
    const { user, f, fill } = setup(auth);
    await fill();
    await user.dblClick(f.submit());
    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(f.submit()).toHaveAttribute('aria-busy', 'true');
    expect(f.submit()).toHaveTextContent('Signing in…');
    resolve(session);
    await waitFor(() => expect(f.submit()).toHaveAttribute('aria-busy', 'false'));
  });

  it.each([
    ['invalid_credentials', /check your email address and passport number/i],
    ['too_many_attempts', /too many attempts/i],
    ['network', /can’t reach the server/i],
  ] as const)('keeps the form filled and announces a %s failure', async (code, text) => {
    const auth = makeAuth(async () => {
      throw new ServiceError(code, 'x');
    });
    const { user, f, fill, onLoggedIn } = setup(auth);
    await fill();
    await user.click(f.submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(f.email()).toHaveValue('Mai@Example.com');
    expect(f.submit()).toBeEnabled();
    expect(onLoggedIn).not.toHaveBeenCalled();
  });

  it('sets direction per field (email and passport LTR) and PII-safe autocomplete', () => {
    setup(makeAuth(async () => session));
    const p = screen.getByLabelText(/passport number/i);
    expect(p).toHaveAttribute('dir', 'ltr');
    expect(p).toHaveAttribute('autocomplete', 'off');
    const e = screen.getByLabelText(/email address/i);
    expect(e).toHaveAttribute('dir', 'ltr');
    expect(e).toHaveAttribute('autocomplete', 'email');
    expect(e).toHaveAttribute('type', 'email');
  });
});

describe('LoginScreen in Arabic (RTL)', () => {
  it('shows Arabic labels and errors, and keeps the email and passport fields left-to-right', async () => {
    render(
      <I18nProvider initialLocale="ar">
        <LoginScreen auth={makeAuth(async () => session)} onLoggedIn={vi.fn()} />
      </I18nProvider>,
    );
    expect(document.documentElement.dir).toBe('rtl');
    const email = screen.getByLabelText(ar['login.email']);
    const passport = screen.getByLabelText(ar['login.passport']);
    expect(email).toHaveAttribute('dir', 'ltr');
    expect(passport).toHaveAttribute('dir', 'ltr');
    await userEvent.setup().click(screen.getByRole('button', { name: ar['login.submit'] }));
    expect(await screen.findAllByText(ar['error.required'])).toHaveLength(2);
  });
});
