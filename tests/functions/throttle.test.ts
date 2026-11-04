// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { nextWindow } from '../../functions/lib/throttle';

describe('nextWindow (fixed window counter)', () => {
  const W = 900;
  it('starts a window on the first attempt', () => {
    expect(nextWindow(null, 1000, 5, W)).toEqual({ allowed: true, row: { window_start: 1000, count: 1 } });
  });
  it('counts within the window and blocks past the limit, saying how long to wait', () => {
    let r = nextWindow(null, 1000, 5, W);
    for (let i = 0; i < 4; i++) r = nextWindow(r.row, 1000 + i, 5, W);
    expect(r.allowed).toBe(true);
    expect(r.row.count).toBe(5);
    const blocked = nextWindow(r.row, 1010, 5, W);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(890);
    expect(blocked.row.count).toBe(6);
  });
  it('resets once the window has passed', () => {
    const r = nextWindow({ window_start: 1000, count: 99 }, 1000 + W, 5, W);
    expect(r).toEqual({ allowed: true, row: { window_start: 1900, count: 1 } });
  });
});
