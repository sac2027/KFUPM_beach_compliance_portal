import { expect, test } from '@playwright/test';

const good = { passportNumber: 'TEST0001', fullName: 'Eyad Salem', email: 'S202368990@kfupm.edu.sa' };

const onlyDesktop = (info: { project: { name: string } }) => test.skip(info.project.name !== 'desktop-1280', 'not viewport dependent');

test.describe('POST /api/verify', () => {

  test('a full match returns a session with the roster name, a masked email and a token; no passport number', async ({ request }, info) => {
    onlyDesktop(info);
    const res = await request.post('/api/verify', { data: good });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.session.student).toEqual({ fullName: 'Eyad Salem', email: 's•••@kfupm.edu.sa', passportLast4: '0001' });
    expect(body.session.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(body.session.expiresAt).getTime() - new Date(body.session.issuedAt).getTime()).toBe(30 * 60 * 1000);
    expect(body.token.split('.')).toHaveLength(3);
    expect(JSON.stringify(body)).not.toContain('TEST0001');
  });

  test('any single mismatch, an unknown passport, or a malformed body gets the same generic answer', async ({ request }, info) => {
    onlyDesktop(info);
    const cases = [
      { ...good, email: 'someone.else@kfupm.edu.sa' },
      { ...good, fullName: 'Eyad Salim' },
      { ...good, passportNumber: 'NOPE9999' },
    ];
    const bodies = new Set<string>();
    for (const c of cases) {
      const res = await request.post('/api/verify', { data: { ...c, passportNumber: `${c.passportNumber}` } });
      expect(res.status()).toBe(401);
      bodies.add(JSON.stringify(await res.json()));
    }
    expect(bodies.size).toBe(1); // identical bodies: nothing says which field was wrong
    expect([...bodies][0]).toContain('"code":"no_match"');
    const malformed = await request.post('/api/verify', { data: { passportNumber: 'TEST0001' } });
    expect(malformed.status()).toBe(400);
    // a phone number or nationality in the body is neither required nor checked
    const extra = await request.post('/api/verify', { data: { ...good, phoneNumber: '+1', nationality: 'JP' } });
    expect(extra.status()).toBe(200);
  });

  test('the sixth failure for one passport inside 15 minutes is throttled; successful sign-ins never count', async ({ request }, info) => {
    onlyDesktop(info);
    for (let i = 0; i < 8; i++) expect((await request.post('/api/verify', { data: good })).status()).toBe(200); // many successes, same IP
    const passport = `THROTTLE${Date.now().toString(36).toUpperCase()}`.slice(0, 20);
    let last = 0;
    for (let i = 0; i < 5; i++) last = (await request.post('/api/verify', { data: { ...good, passportNumber: passport } })).status();
    expect(last).toBe(401);
    const sixth = await request.post('/api/verify', { data: { ...good, passportNumber: passport } });
    expect(sixth.status()).toBe(429);
    expect(Number(sixth.headers()['retry-after'])).toBeGreaterThan(0);
    expect((await request.post('/api/verify', { data: good })).status()).toBe(200); // the right details still work from this IP
  });
});
