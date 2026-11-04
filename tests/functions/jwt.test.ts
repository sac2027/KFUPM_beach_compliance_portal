// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { signSession, verifySession } from '../../functions/lib/jwt';

const secret = 'test-secret-0123456789abcdef0123456789abcdef';

describe('session tokens', () => {
  it('round-trips the sid and nothing else', async () => {
    const token = await signSession({ sid: 'abc' }, secret, 60);
    expect(token.split('.')).toHaveLength(3);
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sid']);
    expect(await verifySession(token, secret)).toEqual({ sid: 'abc' });
  });
  it('rejects a tampered token, a wrong secret and an expired token', async () => {
    const token = await signSession({ sid: 'abc' }, secret, 60);
    expect(await verifySession(token.slice(0, -2) + 'xx', secret)).toBeNull();
    expect(await verifySession(token, 'another-secret-another-secret-another')).toBeNull();
    const expired = await signSession({ sid: 'abc' }, secret, -1);
    expect(await verifySession(expired, secret)).toBeNull();
    expect(await verifySession('not.a.token', secret)).toBeNull();
  });
});
