import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLeaveWarning } from '../../src/lib/useLeaveWarning';

const leave = () => {
  const e = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(e);
  return e;
};

describe('useLeaveWarning', () => {
  it('asks the browser to confirm leaving while active', () => {
    renderHook(() => useLeaveWarning(true));
    expect(leave().defaultPrevented).toBe(true);
  });
  it('stays out of the way when inactive', () => {
    renderHook(() => useLeaveWarning(false));
    expect(leave().defaultPrevented).toBe(false);
  });
  it('stops warning when it becomes inactive or unmounts', () => {
    const { rerender, unmount } = renderHook(({ on }) => useLeaveWarning(on), { initialProps: { on: true } });
    rerender({ on: false });
    expect(leave().defaultPrevented).toBe(false);
    rerender({ on: true });
    unmount();
    expect(leave().defaultPrevented).toBe(false);
  });
});
