import { STEPS } from '../state/flow';
import type { Step } from '../state/flow';

/**
 * The browser's Back and Forward buttons move between steps. Only the step name is ever in the URL
 * (`#terms`), never anything about the student. Deep links to a later step are ignored without a session.
 */
export function stepFromHash(hash: string): Step | null {
  const name = hash.replace(/^#/, '');
  return (STEPS as readonly string[]).includes(name) ? (name as Step) : null;
}

export function currentHashStep(): Step | null {
  return stepFromHash(globalThis.location?.hash ?? '');
}

/** Records the step in history. `replace` rewrites the current entry (used when a step must not be returned to). */
export function recordStep(step: Step, replace = false): void {
  const url = `${location.pathname}${location.search}#${step}`;
  if (replace) history.replaceState({ step }, '', url);
  else history.pushState({ step }, '', url);
}

/** Calls back with the step the browser navigated to (Back/Forward). Returns the unsubscribe function. */
export function onStepNavigation(cb: (step: Step | null) => void): () => void {
  const handler = (e: PopStateEvent) => cb((e.state as { step?: Step } | null)?.step ?? currentHashStep());
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}
