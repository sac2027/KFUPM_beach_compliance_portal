// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from '../../functions/api/declarations';
import { resetRateLimit } from '../../functions/lib/ratelimit';

const pdfBytes = () => new TextEncoder().encode('%PDF-1.7 fake declaration');
function request(over: Record<string, string | File> = {}, ip = '203.0.113.7'): Request {
  const f = new FormData();
  const fields: Record<string, string | File> = { email: 'mai@example.com', locale: 'en', referenceNumber: 'UBR-2026-ABCDEF', submittedAt: new Date().toISOString(), pdf: new File([pdfBytes()], 'd.pdf', { type: 'application/pdf' }), ...over };
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return new Request('https://example.test/api/declarations', { method: 'POST', body: f, headers: { 'cf-connecting-ip': ip } });
}
const call = (req: Request, env: Record<string, string>) => onRequestPost({ request: req, env, params: {} } as never) as Promise<Response>;
const logEnv = { EMAIL_MODE: 'log', EMAIL_FROM: 'KFUPM <a@b.co>', EMAIL_REPLY_TO: '' };

beforeEach(resetRateLimit);
afterEach(() => vi.unstubAllGlobals());

describe('POST /api/declarations', () => {
  it('log mode reports logged, masks the address and is never cached', async () => {
    const res = await call(request(), logEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ emailStatus: 'logged', emailTo: 'm•••@example.com' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects a file that is not a PDF', async () => {
    const res = await call(request({ pdf: new File([new TextEncoder().encode('<html>')], 'x.pdf') }), logEnv);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('invalid_document');
  });

  it('rejects a body that is not a form', async () => {
    const res = await call(new Request('https://example.test/api/declarations', { method: 'POST', body: 'x', headers: { 'content-type': 'text/plain' } }), logEnv);
    expect(res.status).toBe(400);
  });

  it('sends through Resend with the PDF attached and the deanship copied', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await call(request(), { ...logEnv, EMAIL_MODE: 'resend', RESEND_API_KEY: 'k', EMAIL_BCC: 'records@example.org' });
    expect((await res.json()).emailStatus).toBe('sent');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(['mai@example.com']);
    expect(body.bcc).toEqual(['records@example.org']);
    expect(body.attachments[0]).toEqual({ filename: 'KFUPM-UBR-2026-ABCDEF.pdf', content: btoa('%PDF-1.7 fake declaration') });
  });

  it('reports failed (not an error) when Resend refuses, and when the key is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('You can only send testing emails to your own email address', { status: 403 })));
    const refused = await (await call(request(), { ...logEnv, EMAIL_MODE: 'resend', RESEND_API_KEY: 'k' })).json();
    expect(refused.emailStatus).toBe('failed');
    expect(refused.emailError).toContain('resend 403'); // the reason is returned so whoever runs the portal can see it
    expect((await (await call(request(), { ...logEnv, EMAIL_MODE: 'resend' })).json()).emailStatus).toBe('failed');
  });

  it('honours a configured limit', async () => {
    const env = { ...logEnv, DECLARATIONS_PER_WINDOW: '2' };
    expect([(await call(request(), env)).status, (await call(request(), env)).status, (await call(request(), env)).status]).toEqual([200, 200, 429]);
  });

  it('answers 429 with retry-after on the eleventh request from one address', async () => {
    for (let i = 0; i < 10; i++) expect((await call(request(), logEnv)).status).toBe(200);
    const res = await call(request(), logEnv);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await call(request({}, '198.51.100.9'), logEnv)).status).toBe(200); // another address is unaffected
  });
});
