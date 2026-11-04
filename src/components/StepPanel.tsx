import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { STEPS } from '../state/flow';
import type { Step } from '../state/flow';

/**
 * Wraps the current step's content. A new element per step (keyed), so the entrance is a CSS transition
 * from `@starting-style` (see motion.css): off the main thread, interruptible, no library.
 * On a step change focus moves to the step's heading (`[data-step-heading]`) so keyboard and
 * screen-reader users land at the top of the new content. Nothing moves on the first render.
 */
export function StepPanel({ step, children }: { step: Step; children: ReactNode }) {
  const [initial] = useState(step);
  const [track, setTrack] = useState({ step, prev: step });
  if (track.step !== step) setTrack({ step, prev: track.step }); // derive direction during render
  const direction = STEPS.indexOf(track.step) >= STEPS.indexOf(track.prev) ? 'forward' : 'back';
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === initial) return;
    ref.current?.querySelector<HTMLElement>('[data-step-heading]')?.focus();
  }, [step, initial]);

  return (
    <div
      key={step}
      ref={ref}
      className="step"
      data-step={step}
      data-direction={direction}
      data-animate={step !== initial ? 'true' : undefined}
    >
      {children}
    </div>
  );
}
