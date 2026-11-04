import { useEffect } from 'react';

/**
 * While `active`, the browser asks before the tab is closed, reloaded or navigated away (progress is held
 * only in memory, by design, so leaving loses it). The wording is the browser's own.
 */
export function useLeaveWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // required by some browsers
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
}
