// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { attachmentName, buildMessage, sendDeclarationEmail } from '../../functions/lib/email';
import type { Env } from '../../functions/lib/env';

const pdf = new TextEncoder().encode('%PDF-1.7 fake');
const m = { to: 'eyadsalem139@gmail.com', fullName: 'Eyad Salem', referenceNumber: 'PACF-2026-ABCDEF', submittedAt: '2026-11-02T08:15:00.000Z', pdf, submissionId: 'sub-1' };
const baseEnv = { EMAIL_FROM: 'KFUPM Student Affairs <onboarding@resend.dev>', EMAIL_REPLY_TO: 'eyadsalem139@gmail.com', EMAIL_BCC: '' };

describe('buildMessage', () => {
  it('addresses the roster email, names the reference, attaches the PDF under a stable name', () => {
    const msg = buildMessage(baseEnv, m);
    expect(msg.to).toEqual(['eyadsalem139@gmail.com']);
    expect(msg.reply_to).toBe('eyadsalem139@gmail.com');
    expect(msg.bcc).toBeUndefined();
    expect(msg.subject).toBe('Your signed Pre-Arrival Compliance Form (PACF-2026-ABCDEF)');
    expect(msg.text).toContain('Dear Eyad Salem,');
    expect(msg.text).toContain('PACF-2026-ABCDEF');
    expect(msg.text).toContain('11:15 GMT+3'); // Riyadh time, zone shown
    expect(msg.attachments[0]!.filename).toBe('KFUPM-PACF-PACF-2026-ABCDEF.pdf'.replace('KFUPM-PACF-PACF', 'KFUPM-PACF-PACF'));
    expect(attachmentName('PACF-2026-ABCDEF')).toBe('KFUPM-PACF-PACF-2026-ABCDEF.pdf');
  });
  it('signs off as the Deanship (no sub-office) and copies a deanship mailbox when configured', () => {
    const msg = buildMessage({ ...baseEnv, EMAIL_BCC: 'records@example.org' }, m);
    expect(msg.text).toContain('Deanship of Student Affairs');
    expect(msg.text).not.toContain('International Students Office');
    expect(msg.bcc).toEqual(['records@example.org']);
  });
});

describe('sendDeclarationEmail', () => {
  const run = vi.fn(async () => ({}));
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  const records = { prepare } as unknown as D1Database;

  it('log mode writes the outbox row with the attachment hash and size, and reports logged', async () => {
    const env = { ...baseEnv, EMAIL_MODE: 'log', RECORDS: records } as unknown as Env;
    expect(await sendDeclarationEmail(env, m)).toEqual({ status: 'logged' });
    const args = bind.mock.calls[0] as unknown[];
    expect(args[1]).toBe('eyadsalem139@gmail.com');
    expect(args[7]).toBe('KFUPM-PACF-PACF-2026-ABCDEF.pdf');
    expect(args[8]).toMatch(/^[0-9a-f]{64}$/);
    expect(args[9]).toBe(pdf.length);
  });
  it('resend mode posts the message with a base64 attachment and maps the response', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 'msg_123' }), { status: 200 }));
    const env = { ...baseEnv, EMAIL_MODE: 'resend', RESEND_API_KEY: 're_test', RECORDS: records } as unknown as Env;
    expect(await sendDeclarationEmail(env, m, fetchImpl as unknown as typeof fetch)).toEqual({ status: 'sent', messageId: 'msg_123' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer re_test');
    const sent = JSON.parse(init.body as string);
    expect(sent.to).toEqual(['eyadsalem139@gmail.com']);
    expect(sent.attachments[0].content).toBe(Buffer.from(pdf).toString('base64'));
  });
  it('resend errors and missing keys become failed, never throws', async () => {
    const bad = vi.fn(async () => new Response('{"message":"validation_error"}', { status: 422 }));
    const env = { ...baseEnv, EMAIL_MODE: 'resend', RESEND_API_KEY: 're_test', RECORDS: records } as unknown as Env;
    expect(await sendDeclarationEmail(env, m, bad as unknown as typeof fetch)).toEqual({ status: 'failed', error: 'resend 422: {"message":"validation_error"}' });
    const noKey = { ...env, RESEND_API_KEY: undefined } as Env;
    expect((await sendDeclarationEmail(noKey, m)).status).toBe('failed');
    const down = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    expect(await sendDeclarationEmail(env, m, down as unknown as typeof fetch)).toEqual({ status: 'failed', error: 'ECONNRESET' });
  });
});
