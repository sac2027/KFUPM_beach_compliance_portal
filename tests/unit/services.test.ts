import { afterEach, describe, expect, it, vi } from 'vitest';
import { REFERENCE_PATTERN } from '../../src/lib/reference';
import { TERM_IDS } from '../../src/lib/termsSchema';
import { authService } from '../../src/services/authService';
import { dbService } from '../../src/services/dbService';
import type { Credentials, Session, SubmissionPayload } from '../../src/services/types';

const creds: Credentials = { passportNumber: 'A1234567', email: 'm@example.com' };
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const payload = (over: Partial<SubmissionPayload> = {}): SubmissionPayload => ({
  session: { sessionId: 's-1', student: { email: creds.email, passportLast4: '4567' }, issuedAt: '2026-11-01T10:00:00.000Z' } satisfies Session,
  documentRef: 'KFUPM-UBR',
  acceptedTermIds: [...TERM_IDS],
  signature: { method: 'draw', dataUrl: PNG },
  submittedAt: '2026-11-01T10:05:00.000Z',
  ...over,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('authService (client-side)', () => {
  it('returns a session for the typed email with the passport reduced to its last four, and never touches the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const s = await authService.login({ email: ' M@Example.com', passportNumber: 'a1234567' });
    expect(s.sessionId.length).toBeGreaterThan(8);
    expect(s.student).toEqual({ email: 'm@example.com', passportLast4: '4567' });
    expect(new Date(s.issuedAt).toISOString()).toBe(s.issuedAt);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects badly formatted input with invalid_credentials', async () => {
    for (const bad of [{ ...creds, passportNumber: ' ' }, { ...creds, passportNumber: 'A1' }, { ...creds, email: '' }, { ...creds, email: 'not-an-email' }]) {
      await expect(authService.login(bad)).rejects.toMatchObject({ code: 'invalid_credentials' });
    }
  });

  it('logout resolves', async () => {
    await expect(authService.logout()).resolves.toBeUndefined();
  });
});

describe('dbService (client-side)', () => {
  it('returns a receipt with a UBR reference number and nothing else, without touching the network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const r = await dbService.submitCompliance(payload());
    expect(r.referenceNumber).toMatch(REFERENCE_PATTERN);
    expect(new Date(r.receivedAt).toISOString()).toBe(r.receivedAt);
    expect(Object.keys(r).sort()).toEqual(['id', 'receivedAt', 'referenceNumber']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('issues different reference numbers each time', async () => {
    const a = await dbService.submitCompliance(payload());
    const b = await dbService.submitCompliance(payload());
    expect(a.referenceNumber).not.toBe(b.referenceNumber);
  });

  it('enforces the five-term rule', async () => {
    for (const ids of [TERM_IDS.slice(0, 4), [...TERM_IDS.slice(0, 4), TERM_IDS[0]], []]) {
      await expect(dbService.submitCompliance(payload({ acceptedTermIds: ids as never }))).rejects.toMatchObject({ code: 'invalid_submission' });
    }
  });

  it('rejects a signature that is not a PNG/JPEG data URL', async () => {
    for (const dataUrl of ['', 'data:image/svg+xml;base64,PHN2Zz4=', 'https://evil.example/x.png', 'data:text/html;base64,PGI+']) {
      await expect(dbService.submitCompliance(payload({ signature: { method: 'upload', dataUrl } }))).rejects.toMatchObject({ code: 'invalid_submission' });
    }
  });
});

describe('dbService.sendDocument', () => {
  const request = { email: 'm@example.com', locale: 'en' as const, referenceNumber: 'UBR-2026-ABCDEF', submittedAt: '2026-11-04T08:00:00.000Z' };
  const pdf = new Blob(['%PDF-1.7 x'], { type: 'application/pdf' });

  it('posts the six parts as a multipart form and maps the answer', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ emailStatus: 'sent', emailTo: 'm•••@example.com' }), { status: 200 }));
    const status = await dbService.sendDocument(request, pdf);
    expect(status).toEqual({ state: 'sent', emailTo: 'm•••@example.com' });
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/declarations');
    const body = (init as RequestInit).body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect([...body.keys()].sort()).toEqual(['email', 'locale', 'pdf', 'referenceNumber', 'submittedAt']);
    expect((body.get('pdf') as File).name).toBe('KFUPM-UBR-2026-ABCDEF.pdf');
    expect(new Headers((init as RequestInit).headers).has('content-type')).toBe(false); // the browser sets the multipart boundary
  });

  it('maps a 429 to too_many_attempts and a server error to network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'too_many_attempts', message: 'x' }), { status: 429 }));
    await expect(dbService.sendDocument(request, pdf)).rejects.toMatchObject({ code: 'too_many_attempts' });
    fetchSpy.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    await expect(dbService.sendDocument(request, pdf)).rejects.toMatchObject({ code: 'network' });
    fetchSpy.mockRejectedValueOnce(new TypeError('offline'));
    await expect(dbService.sendDocument(request, pdf)).rejects.toMatchObject({ code: 'network' });
  });
});

describe('PII hygiene', () => {
  it('never logs and never writes to storage', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const s = await authService.login(creds);
    await dbService.submitCompliance(payload({ session: s }));
    await dbService.submitCompliance(payload({ acceptedTermIds: [] })).catch(() => {});
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
