import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TermsStep } from '../../src/features/terms/TermsStep';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { loadTerms } from '../../src/lib/terms';
import { TERM_IDS } from '../../src/lib/termsSchema';
import type { TermId } from '../../src/lib/termsSchema';
import type { Session } from '../../src/services/types';

const TERMS = loadTerms();
const session: Session = {
  sessionId: 's-1',
  student: { email: 'mai@example.com' },
  issuedAt: '2026-11-01T10:00:00.000Z',
};

function setup(initialAccepted: TermId[] = [], who: Session = session) {
  const onContinue = vi.fn();
  render(
    <I18nProvider>
      <TermsStep session={who} initialAccepted={initialAccepted} onContinue={onContinue} />
    </I18nProvider>,
  );
  const user = userEvent.setup();
  const boxes = () => screen.getAllByRole('checkbox') as HTMLInputElement[];
  const cont = () => screen.getByRole('button', { name: /continue to signature/i });
  return { user, boxes, cont, onContinue };
}

describe('TermsStep', () => {
  it('renders the five terms from the JSON in order', () => {
    const locale = 'en';
    const { boxes } = setup();
    expect(boxes()).toHaveLength(5);
    TERMS.terms.forEach((t, i) => {
      expect(boxes()[i]).toHaveAccessibleName(`${i + 1}. ${t.title[locale]}`);
      expect(boxes()[i]).not.toBeChecked();
    });
  });

  it('describes each checkbox by its full term text, and has no select-all', () => {
    const { boxes } = setup();
    expect(boxes()[3]).toHaveAccessibleDescription(/^Advance reservation is required to enter the beach/);
    expect(screen.queryByText(/select all/i)).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
  });

  it('shows the declarant email and the sign-in date (Gregorian, Latin digits)', () => {
    render(
      <I18nProvider>
        <TermsStep session={session} initialAccepted={[]} onContinue={() => {}} />
      </I18nProvider>,
    );
    expect(screen.getByText('mai@example.com')).toBeInTheDocument();
    expect(screen.getByText('1 November 2026')).toBeInTheDocument();
  });

  it('keeps Continue inactive until all five are confirmed, announcing progress', async () => {
    const { user, boxes, cont, onContinue } = setup();
    expect(cont()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('0 of 5 confirmed')).toBeInTheDocument();
    for (const b of boxes().slice(0, 3)) await user.click(b);
    expect(screen.getByText('3 of 5 confirmed')).toBeInTheDocument();
    expect(screen.getByText('3 of 5 confirmed')).toHaveAttribute('aria-live', 'polite');
    await user.click(cont()); // incomplete: nothing happens, focus goes to the first unconfirmed term
    expect(onContinue).not.toHaveBeenCalled();
    expect(boxes()[3]).toHaveFocus();
  });

  it('continues with all five ids, in order, once every term is confirmed', async () => {
    const { user, boxes, cont, onContinue } = setup();
    for (const b of boxes()) await user.click(b);
    expect(cont()).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(cont());
    expect(onContinue).toHaveBeenCalledWith([...TERM_IDS]);
  });

  it('toggles from the label text and from the keyboard, and un-confirms', async () => {
    const { user, boxes } = setup();
    await user.click(screen.getByText(/Cleanliness and University Property/));
    expect(boxes()[1]).toBeChecked();
    boxes()[0]!.focus();
    await user.keyboard(' ');
    expect(boxes()[0]).toBeChecked();
    await user.keyboard(' ');
    expect(boxes()[0]).not.toBeChecked();
  });

  it('pre-checks terms the student already confirmed (coming back from the signature step)', () => {
    const { boxes, cont } = setup([...TERM_IDS]);
    expect(boxes().every((b) => b.checked)).toBe(true);
    expect(cont()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('describes the first card by its lead sentence and all four points, shown as list items', () => {
    const { boxes } = setup();
    const description = boxes()[0]!.getAttribute('aria-describedby')!;
    const body = document.getElementById(description)!;
    expect(within(body).getAllByRole('listitem')).toHaveLength(4);
    expect(body).toHaveTextContent('Appropriate beachwear that aligns with our community values and traditions is required.');
    expect(boxes()[3]!.getAttribute('aria-describedby')).toBeTruthy();
    expect(within(document.getElementById(boxes()[3]!.getAttribute('aria-describedby')!)!).queryAllByRole('listitem')).toHaveLength(0); // term 4 is one paragraph
  });

  it('lays out a very long unbroken email without relying on word breaks', () => {
    const long = { ...session, student: { ...session.student, email: 'a'.repeat(60) + '@' + 'b'.repeat(60) + '.example.com' } };
    setup([], long);
    const email = screen.getByText(long.student.email);
    expect(email.closest('[dir]')?.getAttribute('dir')).toBe('ltr');
  });
});

describe('TermsStep: changing details', () => {
  function setupWithChange(leaveRequested = false) {
    const onChangeDetails = vi.fn();
    const onCancelLeave = vi.fn();
    render(
      <I18nProvider>
        <TermsStep session={session} initialAccepted={[]} onContinue={() => {}} onChangeDetails={onChangeDetails} leaveRequested={leaveRequested} onCancelLeave={onCancelLeave} />
      </I18nProvider>,
    );
    return { onChangeDetails, onCancelLeave, user: userEvent.setup() };
  }
  it('asks before returning to sign-in, then calls back', async () => {
    const { onChangeDetails, user } = setupWithChange();
    await user.click(screen.getByRole('button', { name: 'Change my details' }));
    expect(onChangeDetails).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('returns you to sign-in');
    const yes = screen.getByRole('button', { name: 'Yes, sign in again' });
    expect(yes).toHaveFocus();
    await user.click(yes);
    expect(onChangeDetails).toHaveBeenCalledTimes(1);
  });
  it('lets the student stay, returning focus to where they were', async () => {
    const { onChangeDetails, user } = setupWithChange();
    await user.click(screen.getByRole('button', { name: 'Change my details' }));
    await user.click(screen.getByRole('button', { name: 'Stay here' }));
    expect(onChangeDetails).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Change my details' })).toHaveFocus();
  });
  it('shows the same question when the browser Back button asked to leave', async () => {
    const { onCancelLeave, user } = setupWithChange(true);
    expect(screen.getByRole('alert')).toHaveTextContent('returns you to sign-in');
    await user.click(screen.getByRole('button', { name: 'Stay here' }));
    expect(onCancelLeave).toHaveBeenCalledTimes(1);
  });
});
