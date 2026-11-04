import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LoginScreen } from '../../src/features/login/LoginScreen';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { ServiceError } from '../../src/services/types';
import type { AuthService, Session } from '../../src/services/types';

const session: Session = {
  sessionId: 's-1',
  student: { fullName: 'Mai Nguyễn', email: 'm•••@example.com', passportLast4: '4567' },
  issuedAt: '2026-11-01T10:00:00.000Z',
  expiresAt: '2026-11-01T10:30:00.000Z',
  nationality: 'VN',
  token: 't',
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
    name: () => screen.getByLabelText(/full name/i),
    email: () => screen.getByLabelText(/email address/i),
    nationality: () => screen.getByLabelText(/nationality/i),
    passport: () => screen.getByLabelText(/passport number/i),
    submit: () => screen.getByRole('button', { name: /sign in|signing in/i }),
  };
  const fill = async (p = 'a1234567', n = 'Mai Nguyễn', e = ' Mai@Example.com', nat = 'VN') => {
    await user.type(f.name(), n);
    await user.type(f.email(), e);
    await user.selectOptions(f.nationality(), nat);
    await user.type(f.passport(), p);
  };
  return { user, f, fill, onLoggedIn };
}

describe('LoginScreen', () => {
  it('shows four errors on an empty submit, focuses the first, and does not call auth', async () => {
    const auth = makeAuth(async () => session);
    const { user, f } = setup(auth);
    await user.click(f.submit());
    expect(await screen.findAllByText('This field is required.')).toHaveLength(3);
    expect(screen.getByText('Choose your nationality from the list.')).toBeInTheDocument();
    for (const el of [f.name(), f.email(), f.nationality(), f.passport()]) expect(el).toHaveAttribute('aria-invalid', 'true');
    expect(f.name()).toHaveFocus();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('signs in with normalised values and reports the session', async () => {
    const auth = makeAuth(async () => session);
    const { user, f, fill, onLoggedIn } = setup(auth);
    await fill();
    await user.click(f.submit());
    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledWith(session));
    expect(auth.login).toHaveBeenCalledTimes(1);
    expect(auth.login).toHaveBeenCalledWith({ fullName: 'Mai Nguyễn', email: 'mai@example.com', nationality: 'VN', passportNumber: 'A1234567' });
  });

  it('accepts Arabic-Indic digits and an Arabic name', async () => {
    const auth = makeAuth(async () => session);
    const { user, f, fill } = setup(auth);
    await fill('N١٢٣٤٥٦٧', 'محمد عبدالله الغامدي', undefined, 'SA');
    await user.click(f.submit());
    await waitFor(() => expect(auth.login).toHaveBeenCalledTimes(1));
    expect(auth.login).toHaveBeenCalledWith({ fullName: 'محمد عبدالله الغامدي', email: 'mai@example.com', nationality: 'SA', passportNumber: 'N1234567' });
  });

  it('offers a nationality dropdown (not a text box), sorted, with a prompt first', () => {
    setup(makeAuth(async () => session));
    const select = screen.getByLabelText(/nationality/i);
    expect(select.tagName).toBe('SELECT');
    const options = [...select.querySelectorAll('option')].map((o) => o.textContent!);
    expect(options[0]).toBe('Select your nationality');
    expect(options.length).toBeGreaterThan(190);
    expect(options.slice(1)).toEqual([...options.slice(1)].sort((a, b) => a.localeCompare(b, 'en')));
    expect(options).toContain('Saudi Arabia');
  });

  it('asks for a nationality when none is chosen, and has no phone field', async () => {
    const { user, f } = setup(makeAuth(async () => session));
    expect(screen.queryByLabelText(/phone/i)).toBeNull();
    await user.click(f.nationality());
    await user.tab();
    expect(await screen.findByText('Choose your nationality from the list.')).toBeInTheDocument();
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
    ['invalid_credentials', /do not match our records/i],
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
    expect(f.name()).toHaveValue('Mai Nguyễn');
    expect(f.submit()).toBeEnabled();
    expect(onLoggedIn).not.toHaveBeenCalled();
  });

  it('sets direction per field: passport and email LTR, name auto; and PII-safe autocomplete', () => {
    setup(makeAuth(async () => session));
    const p = screen.getByLabelText(/passport number/i);
    expect(p).toHaveAttribute('dir', 'ltr');
    expect(p).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('dir', 'ltr');
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/full name/i)).toHaveAttribute('dir', 'auto');
  });

  it('lists the fields in the order name, email, nationality, passport number', () => {
    setup(makeAuth(async () => session));
    const order = [...document.querySelectorAll('.field__label')].map((l) => l.textContent);
    expect(order).toEqual(['Full name', 'Email address', 'Nationality', 'Passport number']);
  });
});
