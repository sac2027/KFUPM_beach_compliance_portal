// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { allow, resetRateLimit } from '../../functions/lib/ratelimit';

beforeEach(resetRateLimit);

describe('allow (fixed window)', () => {
  it('allows the limit, refuses the next call and says how long to wait', () => {
    for (let i = 0; i < 10; i++) expect(allow('a', 10, 900, 1000 + i).allowed).toBe(true);
    const r = allow('a', 10, 900, 1010);
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBe(890);
  });
  it('starts a new window once the old one has passed', () => {
    for (let i = 0; i < 11; i++) allow('a', 10, 900, 1000);
    expect(allow('a', 10, 900, 1900).allowed).toBe(true);
  });
  it('keeps keys independent', () => {
    for (let i = 0; i < 11; i++) allow('a', 10, 900, 1000);
    expect(allow('b', 10, 900, 1000).allowed).toBe(true);
  });
});
