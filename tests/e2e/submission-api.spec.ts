import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { STUDENTS } from './students';

const onlyDesktop = (info: { project: { name: string } }) => test.skip(info.project.name !== 'desktop-1280', 'not viewport dependent');
const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64')}`;
const TERMS = ['saudi-laws', 'cultural-norms', 'university-policies', 'representation', 'reporting'];
const body = (over: Record<string, unknown> = {}) => ({ nationality: 'SA', acceptedTermIds: TERMS, signature: { method: 'draw', dataUrl: PNG }, ...over });

async function token(request: APIRequestContext, who = STUDENTS.eyad): Promise<string> {
  const res = await request.post('/api/verify', { data: { passportNumber: who.passport, fullName: who.name, email: who.email } });
  expect(res.status()).toBe(200);
  return (await res.json()).token as string;
}

/** Reads the local records database the way an administrator would. */
function dbRow(reference: string): Record<string, unknown> {
  expect(reference).toMatch(/^PACF-\d{4}-[A-HJ-NP-Z2-9]{6}$/);
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'pacf-records', '--local', '--json', '--command', `SELECT * FROM submissions WHERE reference_number = '${reference}'`], {
    encoding: 'utf8',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  return (JSON.parse(out.slice(out.indexOf('[')))[0].results as Record<string, unknown>[])[0]!;
}

test.describe('POST /api/submissions', () => {
  test('records the declaration for the student the session belongs to, once', async ({ request }, info) => {
    onlyDesktop(info);
    const t = await token(request);
    const res = await request.post('/api/submissions', { headers: { authorization: `Bearer ${t}` }, data: body() });
    expect(res.status()).toBe(201);
    const { id, referenceNumber, submittedAt } = await res.json();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(submittedAt).toISOString()).toBe(submittedAt);

    const row = dbRow(referenceNumber);
    expect(row.full_name).toBe('Eyad Salem'); // from the roster, not the request
    expect(row.email).toBe(STUDENTS.eyad.email);
    expect(row.passport_last4).toBe('0001');
    expect(row.nationality).toBe('Saudi Arabia'); // the code the form sent, stored as the country name
    expect(row).not.toHaveProperty('phone_e164'); // no phone number is collected
    expect(JSON.stringify(row)).not.toContain(STUDENTS.eyad.passport); // never the full number
    expect(row.accepted_term_ids).toBe(JSON.stringify(TERMS));
    expect(row.signature_key).toBe(`submissions/${id}/signature.png`);
    expect(row.email_status).toBe('pending');

    const again = await request.post('/api/submissions', { headers: { authorization: `Bearer ${t}` }, data: body() });
    expect(again.status()).toBe(409);
  });

  test('refuses without a session, with a tampered token, with four terms, with an SVG, and without a valid nationality', async ({ request }, info) => {
    onlyDesktop(info);
    expect((await request.post('/api/submissions', { data: body() })).status()).toBe(401);
    const t = await token(request, STUDENTS.anas);
    expect((await request.post('/api/submissions', { headers: { authorization: `Bearer ${t.slice(0, -3)}abc` }, data: body() })).status()).toBe(401);
    const four = await request.post('/api/submissions', { headers: { authorization: `Bearer ${t}` }, data: body({ acceptedTermIds: TERMS.slice(0, 4) }) });
    expect(four.status()).toBe(400);
    expect((await four.json()).code).toBe('invalid_submission');
    const svg = await request.post('/api/submissions', { headers: { authorization: `Bearer ${t}` }, data: body({ signature: { method: 'upload', dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' } }) });
    expect(svg.status()).toBe(400);
    for (const nationality of [undefined, '', 'XX', 'Saudi Arabia']) {
      const bad = await request.post('/api/submissions', { headers: { authorization: `Bearer ${t}` }, data: body({ nationality }) });
      expect(bad.status(), String(nationality)).toBe(400);
      expect((await bad.json()).message).toMatch(/nationality/);
    }
    // the session is still unused after rejected attempts, so a correct submission now succeeds
    expect((await request.post('/api/submissions', { headers: { authorization: `Bearer ${t}` }, data: body() })).status()).toBe(201);
  });
});
