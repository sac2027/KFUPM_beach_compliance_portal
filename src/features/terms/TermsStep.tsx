import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDate } from '../../lib/format';
import { loadTerms } from '../../lib/terms';
import { TERM_IDS } from '../../lib/termsSchema';
import type { TermId } from '../../lib/termsSchema';
import type { Session } from '../../services/types';
import { TermCard } from './TermCard';

const TERMS = loadTerms();

export function TermsStep({
  session,
  initialAccepted,
  onContinue,
  onProgress,
  onChangeDetails,
  leaveRequested = false,
  onCancelLeave,
}: {
  session: Session;
  initialAccepted: TermId[];
  onContinue: (ids: TermId[]) => void;
  /** Every tick change, in order, so the app can keep them across Back and re-sign-in. */
  onProgress?: (ids: TermId[]) => void;
  /** Ends the verified session and returns to sign-in (after the student confirms). */
  onChangeDetails?: () => void;
  /** True when the browser's Back button asked to leave: show the same confirmation. */
  leaveRequested?: boolean;
  onCancelLeave?: () => void;
}) {
  const { t, locale } = useI18n();
  const [leaving, setLeaving] = useState(false);
  const confirmLeaveRef = useRef<HTMLButtonElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const askedLeave = useRef(false);
  const showLeave = leaving || leaveRequested;
  useEffect(() => {
    if (showLeave) {
      askedLeave.current = true;
      confirmLeaveRef.current?.focus();
    } else if (askedLeave.current) {
      changeRef.current?.focus();
    }
  }, [showLeave]);
  const cancelLeave = () => {
    setLeaving(false);
    onCancelLeave?.();
  };
  const [accepted, setAccepted] = useState<ReadonlySet<TermId>>(() => new Set(initialAccepted));
  const listRef = useRef<HTMLOListElement>(null);
  const count = accepted.size;
  const complete = count === TERM_IDS.length;

  const toggle = (id: TermId, on: boolean) => {
    const next = new Set(accepted);
    if (on) next.add(id);
    else next.delete(id);
    setAccepted(next);
    onProgress?.(TERM_IDS.filter((x) => next.has(x)));
  };

  const onContinueClick = () => {
    if (!complete) {
      // Inactive, not disabled: keep it focusable and send the student to what is missing.
      listRef.current?.querySelector<HTMLInputElement>('input:not(:checked)')?.focus();
      return;
    }
    onContinue(TERM_IDS.filter((id) => accepted.has(id)));
  };

  return (
    <section className="terms" aria-labelledby="terms-heading">
      <h2 id="terms-heading" data-step-heading tabIndex={-1}>
        {t('terms.heading')}
      </h2>

      <dl className="declarant">
        <dt>{t('terms.declarant')}</dt>
        <dd dir="auto" translate="no">
          {session.student.fullName}
        </dd>
        <dt>{t('terms.date')}</dt>
        <dd>{formatDate(session.issuedAt, locale)}</dd>
      </dl>

      <p className="terms__lead">{t('terms.lead')}</p>

      <div className="terms__progress">
        <div className="meter" aria-hidden="true">
          {TERM_IDS.map((id, i) => (
            <span key={id} className="meter__seg" data-on={i < count ? 'true' : 'false'} />
          ))}
        </div>
        <p className="terms__count" aria-live="polite">
          {t('terms.progress', { n: count, total: TERM_IDS.length })}
        </p>
      </div>

      <ol className="terms__list" ref={listRef}>
        {TERMS.terms.map((term, i) => (
          <TermCard
            key={term.id}
            term={term}
            index={i}
            links={TERMS.links}
            checked={accepted.has(term.id)}
            onChange={(on) => toggle(term.id, on)}
          />
        ))}
      </ol>

      {showLeave && (
        <div className="confirm" role="group" aria-labelledby="terms-leave">
          <p id="terms-leave" role="alert">
            {t('terms.leaveWarn')}
          </p>
          <div className="confirm__actions">
            <button ref={confirmLeaveRef} type="button" className="btn" onClick={onChangeDetails}>
              {t('terms.leaveConfirm')}
            </button>
            <Button type="button" variant="quiet" onClick={cancelLeave}>
              {t('terms.leaveCancel')}
            </Button>
          </div>
        </div>
      )}

      <div className="terms__actions">
        <Button
          type="button"
          onClick={onContinueClick}
          aria-disabled={complete ? undefined : 'true'}
          aria-describedby={complete ? undefined : 'terms-incomplete'}
        >
          <span>{t('terms.continue')}</span>
          <Icon name="forward" />
        </Button>
        {!complete && (
          <p id="terms-incomplete" className="terms__hint">
            {t('terms.incomplete')}
          </p>
        )}
        {onChangeDetails && !showLeave && (
          <button ref={changeRef} type="button" className="btn btn--quiet" onClick={() => setLeaving(true)}>
            <Icon name="back" />
            <span>{t('terms.changeDetails')}</span>
          </button>
        )}
      </div>
    </section>
  );
}
