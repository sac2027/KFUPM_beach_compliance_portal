import { REFERENCE_PATTERN } from '../../src/lib/reference';

export const MAX_PDF_BYTES = 8 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface DeclarationFields {
  email: string;
  locale: 'en' | 'ar';
  referenceNumber: string;
  submittedAt: string;
  pdf: File;
}

export type ParseResult = { ok: true; value: DeclarationFields } | { ok: false; message: string };

export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  return at <= 0 ? '•••' : `${email[0]}•••${email.slice(at)}`;
}

export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}

/** Everything the browser sends with a declaration, re-checked here because the browser is not trusted. */
export function parseDeclarationForm(form: FormData, now = Date.now()): ParseResult {
  const text = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' ? v : '';
  };
  const email = text('email').normalize('NFKC').trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return { ok: false, message: 'email must be a valid email address.' };
  const locale = text('locale');
  if (locale !== 'en' && locale !== 'ar') return { ok: false, message: 'locale must be en or ar.' };
  const referenceNumber = text('referenceNumber');
  if (!REFERENCE_PATTERN.test(referenceNumber)) return { ok: false, message: 'referenceNumber is not a valid reference.' };
  const submittedAt = text('submittedAt');
  const t = Date.parse(submittedAt);
  if (Number.isNaN(t) || Math.abs(now - t) > DAY_MS) return { ok: false, message: 'submittedAt must be a recent ISO-8601 time.' };
  const pdf = form.get('pdf');
  if (!(pdf instanceof File) || pdf.size === 0) return { ok: false, message: 'pdf must be a file.' };
  return { ok: true, value: { email, locale, referenceNumber, submittedAt, pdf } };
}
