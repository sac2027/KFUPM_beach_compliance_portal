import { afterEach, describe, expect, it, vi } from 'vitest';
import { TERM_IDS } from '../../src/lib/termsSchema';
import { authService } from '../../src/services/authService';
import { createMockDbService } from '../../src/services/dbService.mock';
import { ServiceError } from '../../src/services/types';
import type { Credentials, Session, SubmissionPayload } from '../../src/services/types';

const creds: Credentials = { passportNumber: 'A1234567', email: 'm@example.com' };
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

const payload = (over: Partial<SubmissionPayload> = {}): SubmissionPayload => ({
  session: { sessionId: 's-1', student: { email: creds.email, passportLast4: '4567' }, issuedAt: '2026-11-01T10:00:00.000Z' } satisfies Session,
  documentRef: 'KFUPM-INTL-PACF',
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

describe('dbService (mock)', () => {
  const db = () => createMockDbService({ latencyMs: 0 });

  it('returns a receipt with a PACF reference number and nothing else', async () => {
    const r = await db().submitCompliance(payload());
    expect(r.referenceNumber).toMatch(/^PACF-\d{4}-[A-Z0-9]{6}$/);
    expect(new Date(r.receivedAt).toISOString()).toBe(r.receivedAt);
    expect(Object.keys(r).sort()).toEqual(['id', 'receivedAt', 'referenceNumber']);
  });

  it('issues different reference numbers each time', async () => {
    const a = await db().submitCompliance(payload());
    const b = await db().submitCompliance(payload());
    expect(a.referenceNumber).not.toBe(b.referenceNumber);
  });

  it('enforces the five-term rule the real backend must also enforce', async () => {
    const bad = [
      TERM_IDS.slice(0, 4),
      [...TERM_IDS.slice(0, 4), 'saudi-laws'], // duplicate instead of the fifth
      [],
    ];
    for (const ids of bad) {
      await expect(db().submitCompliance(payload({ acceptedTermIds: ids as never }))).rejects.toMatchObject({
        code: 'invalid_submission',
      });
    }
  });

  it('rejects a signature that is not a PNG/JPEG data URL', async () => {
    for (const dataUrl of ['', 'data:image/svg+xml;base64,PHN2Zz4=', 'https://evil.example/x.png', 'data:text/html;base64,PGI+']) {
      await expect(
        db().submitCompliance(payload({ signature: { method: 'upload', dataUrl } })),
      ).rejects.toMatchObject({ code: 'invalid_submission' });
    }
  });

  it('surfaces an injected failure', async () => {
    const boom = new ServiceError('network', 'offline');
    await expect(createMockDbService({ latencyMs: 0, failWith: boom }).submitCompliance(payload())).rejects.toBe(boom);
  });
});

describe('PII hygiene', () => {
  it('never logs and never writes to storage', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const s = await authService.login(creds);
    await createMockDbService({ latencyMs: 0 }).submitCompliance(payload({ session: s }));
    await createMockDbService({ latencyMs: 0 }).submitCompliance(payload({ acceptedTermIds: [] })).catch(() => {});
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
