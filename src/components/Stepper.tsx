import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/I18nProvider';
import { STEPS } from '../state/flow';
import type { Step } from '../state/flow';

/** A real sequence, so the numbers stay. State is conveyed by text and aria, not by colour alone. */
export function Stepper({ current }: { current: Step }) {
  const { t } = useI18n();
  const currentIndex = STEPS.indexOf(current);
  return (
    <div className="stepper">
      <ol className="stepper__list" aria-label={t('stepper.label')}>
      {STEPS.map((step, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
        return (
          <li key={step} className="stepper__item" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="stepper__label">
              <span className="stepper__n" aria-hidden="true">
                {i + 1}
              </span>
              {t(`step.${step}` as MessageKey)}
            </span>
            <span className="sr-only">{t(`stepper.state.${state}` as MessageKey)}</span>
          </li>
        );
      })}
      </ol>
      {/* Phone only: segments are too narrow for labels, so the current step is named on its own row. */}
      <p className="stepper__current" aria-hidden="true">
        <span className="stepper__n">{currentIndex + 1}</span>
        {t(`step.${current}` as MessageKey)}
      </p>
    </div>
  );
}
