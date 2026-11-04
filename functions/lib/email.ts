import type { Env } from './env';
import { attachmentName } from '../../src/lib/reference';

export interface DeclarationEmail {
  to: string;
  locale: 'en' | 'ar';
  referenceNumber: string;
  submittedAt: string;
  pdf: Uint8Array;
}

export type SendResult = { status: 'sent'; messageId: string } | { status: 'logged' } | { status: 'failed'; error: string };
type EmailEnv = Pick<Env, 'EMAIL_MODE' | 'EMAIL_FROM' | 'EMAIL_REPLY_TO' | 'EMAIL_BCC' | 'RESEND_API_KEY'>;

export { attachmentName };

const COPY = {
  en: {
    subject: (ref: string) => `Your signed University Beach Regulations & Procedures declaration (${ref})`,
    body: (ref: string, when: string) =>
      [
        'Dear student,',
        '',
        'Thank you. KFUPM has received your signed declaration for the University and University Beach Regulations & Procedures.',
        `Your reference number is ${ref}. It was received on ${when}.`,
        '',
        'A copy of the signed declaration is attached as a PDF. Please keep it for your records.',
        '',
        'If you did not submit this declaration, reply to this email.',
        '',
        'Deanship of Student Affairs',
        'King Fahd University of Petroleum & Minerals',
      ].join('\n'),
  },
  ar: {
    subject: (ref: string) => `إقرارك الموقّع للوائح وإجراءات شاطئ الجامعة (${ref})`,
    body: (ref: string, when: string) =>
      [
        'عزيزي الطالب،',
        '',
        'شكرًا لك. استلمت جامعة الملك فهد للبترول والمعادن إقرارك الموقّع على لوائح وإجراءات الجامعة وشاطئ الجامعة.',
        `رقمك المرجعي هو ${ref}، وقد استُلم في ${when}.`,
        '',
        'نسخة من الإقرار الموقّع مرفقة بصيغة PDF. يُرجى الاحتفاظ بها.',
        '',
        'إذا لم تقدّم هذا الإقرار، فيُرجى الرد على هذه الرسالة.',
        '',
        'عمادة شؤون الطلاب',
        'جامعة الملك فهد للبترول والمعادن',
      ].join('\n'),
  },
};

function when(iso: string, locale: 'en' | 'ar'): string {
  const tag = locale === 'ar' ? 'ar-u-nu-latn-ca-gregory' : 'en-GB-u-ca-gregory';
  return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(iso));
}

/** What gets sent, independent of the driver. */
export function buildMessage(env: Pick<Env, 'EMAIL_FROM' | 'EMAIL_REPLY_TO' | 'EMAIL_BCC'>, m: DeclarationEmail) {
  const copy = COPY[m.locale];
  return {
    from: env.EMAIL_FROM,
    to: [m.to],
    reply_to: env.EMAIL_REPLY_TO || undefined,
    bcc: env.EMAIL_BCC ? [env.EMAIL_BCC] : undefined,
    subject: copy.subject(m.referenceNumber),
    text: copy.body(m.referenceNumber, when(m.submittedAt, m.locale)),
    attachments: [{ filename: attachmentName(m.referenceNumber), content: m.pdf }],
  };
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Sends through Resend (EMAIL_MODE=resend); any other mode sends nothing and reports `logged`. Never throws. */
export async function sendDeclarationEmail(env: EmailEnv, m: DeclarationEmail, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  if (env.EMAIL_MODE !== 'resend') return { status: 'logged' };
  if (!env.RESEND_API_KEY) return { status: 'failed', error: 'RESEND_API_KEY is not set' };
  const msg = buildMessage(env, m);
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ...msg, attachments: [{ filename: msg.attachments[0]!.filename, content: toBase64(m.pdf) }] }),
    });
    if (!res.ok) return { status: 'failed', error: `resend ${res.status}` };
    const data = (await res.json()) as { id?: string };
    return { status: 'sent', messageId: data.id ?? '' };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'network error' };
  }
}
