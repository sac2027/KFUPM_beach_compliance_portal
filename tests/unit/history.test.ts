import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentHashStep, onStepNavigation, recordStep, stepFromHash } from '../../src/lib/history';

afterEach(() => {
  history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('history', () => {
  it('reads only known step names from the hash', () => {
    expect(stepFromHash('#terms')).toBe('terms');
    expect(stepFromHash('#done')).toBe('done');
    expect(stepFromHash('#admin')).toBeNull();
    expect(stepFromHash('')).toBeNull();
  });
  it('records a step as a hash and nothing else (no data, no query)', () => {
    history.replaceState(null, '', '/?lang=ar');
    recordStep('terms');
    expect(location.hash).toBe('#terms');
    expect(location.search).toBe('?lang=ar'); // the language link survives
    expect(history.state).toEqual({ step: 'terms' });
    expect(currentHashStep()).toBe('terms');
  });
  it('replace rewrites the entry instead of adding one', () => {
    const push = vi.spyOn(history, 'pushState');
    const replace = vi.spyOn(history, 'replaceState');
    recordStep('done', true);
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith({ step: 'done' }, '', '/#done');
  });
  it('reports the step the browser navigated to, from state or from the hash', () => {
    const cb = vi.fn();
    const off = onStepNavigation(cb);
    window.dispatchEvent(new PopStateEvent('popstate', { state: { step: 'sign' } }));
    expect(cb).toHaveBeenLastCalledWith('sign');
    history.replaceState(null, '', '/#terms');
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    expect(cb).toHaveBeenLastCalledWith('terms');
    off();
    window.dispatchEvent(new PopStateEvent('popstate', { state: { step: 'login' } }));
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
