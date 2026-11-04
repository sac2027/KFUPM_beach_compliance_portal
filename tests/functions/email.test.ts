// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { attachmentName, buildMessage, sendDeclarationEmail } from '../../functions/lib/email';

const pdf = new TextEncoder().encode('%PDF-1.7 fake');
const m = { to: 'mai@example.com', locale: 'en' as const, referenceNumber: 'UBR-2026-ABCDEF', submittedAt: '2026-11-04T08:15:00.000Z', pdf };
const baseEnv = { EMAIL_FROM: 'KFUPM Student Affairs <onboarding@resend.dev>', EMAIL_REPLY_TO: 'reply@example.org', EMAIL_BCC: '' };

describe('buildMessage', () => {
  it('addresses the typed email, names the reference and attaches the PDF under a stable name', () => {
    const msg = buildMessage(baseEnv, m);
    expect(msg.to).toEqual(['mai@example.com']);
    expect(msg.reply_to).toBe('reply@example.org');
    expect(msg.bcc).toBeUndefined();
    expect(msg.subject).toBe('Your signed University Beach Regulations & Procedures declaration (UBR-2026-ABCDEF)');
    expect(msg.text).toContain('Dear student,');
    expect(msg.text).toContain('11:15 GMT+3'); // Riyadh time, zone shown
    expect(msg.attachments[0]!.filename).toBe('KFUPM-UBR-2026-ABCDEF.pdf');
    expect(attachmentName('UBR-2026-ABCDEF')).toBe('KFUPM-UBR-2026-ABCDEF.pdf');
  });
  it('copies the deanship mailbox when configured and signs off as the Deanship', () => {
    const msg = buildMessage({ ...baseEnv, EMAIL_BCC: 'records@example.org' }, m);
    expect(msg.bcc).toEqual(['records@example.org']);
    expect(msg.text).toContain('Deanship of Student Affairs');
  });
  it('writes the Arabic version for Arabic declarations', () => {
    const msg = buildMessage(baseEnv, { ...m, locale: 'ar' });
    expect(msg.subject).toContain('شاطئ الجامعة');
    expect(msg.subject).toContain('UBR-2026-ABCDEF');
    expect(msg.text).toContain('عزيزي الطالب');
  });
});

describe('sendDeclarationEmail', () => {
  it('log mode sends nothing and reports logged', async () => {
    const fetchImpl = vi.fn();
    expect(await sendDeclarationEmail({ ...baseEnv, EMAIL_MODE: 'log' }, m, fetchImpl as never)).toEqual({ status: 'logged' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('resend mode posts to Resend with a bearer key and the PDF in base64', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }));
    const r = await sendDeclarationEmail({ ...baseEnv, EMAIL_MODE: 'resend', RESEND_API_KEY: 'k' }, m, fetchImpl as never);
    expect(r).toEqual({ status: 'sent', messageId: 'msg_1' });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer k');
  });
  it('never throws: a refusal, a missing key and a network error all come back as failed', async () => {
    expect((await sendDeclarationEmail({ ...baseEnv, EMAIL_MODE: 'resend', RESEND_API_KEY: 'k' }, m, (async () => new Response('x', { status: 422 })) as never)).status).toBe('failed');
    expect((await sendDeclarationEmail({ ...baseEnv, EMAIL_MODE: 'resend' }, m)).status).toBe('failed');
    expect((await sendDeclarationEmail({ ...baseEnv, EMAIL_MODE: 'resend', RESEND_API_KEY: 'k' }, m, (async () => { throw new Error('offline'); }) as never)).status).toBe('failed');
  });
});
