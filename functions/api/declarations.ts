import type { Env } from '../lib/env';
import { isPdf, MAX_PDF_BYTES, maskEmail, parseDeclarationForm } from '../lib/declaration';
import { sendDeclarationEmail } from '../lib/email';
import { error, handle, json } from '../lib/http';
import { allow } from '../lib/ratelimit';

const DEFAULT_LIMIT = 10; // sends per IP per window
const WINDOW_SECONDS = 15 * 60;

/**
 * POST /api/declarations  (multipart: email, locale, referenceNumber, submittedAt, pdf)
 * Emails the signed declaration PDF to the address the student typed, copying EMAIL_BCC. Nothing is stored and no body is logged.
 * → 200 {emailStatus, emailTo (masked)}
 */
export const onRequestPost = handle<Env>(async ({ request, env }) => {
  const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
  const gate = allow(`ip:${ip}`, Number(env.DECLARATIONS_PER_WINDOW) || DEFAULT_LIMIT, WINDOW_SECONDS);
  if (!gate.allowed) return error(429, 'too_many_attempts', 'Too many attempts. Please wait before trying again.', { 'retry-after': String(gate.retryAfter ?? WINDOW_SECONDS) });

  if (Number(request.headers.get('content-length') ?? 0) > MAX_PDF_BYTES + 64 * 1024) return error(413, 'too_large', 'The declaration is larger than 8 MB.');
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, 'bad_form', 'The request must be a multipart form.');
  }
  const parsed = parseDeclarationForm(form);
  if (!parsed.ok) return error(400, 'invalid_submission', parsed.message);
  const { email, locale, referenceNumber, submittedAt, pdf } = parsed.value;
  if (pdf.size > MAX_PDF_BYTES) return error(413, 'too_large', 'The PDF is larger than 8 MB.');
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  if (!isPdf(bytes)) return error(400, 'invalid_document', 'The document must be a PDF.');

  const result = await sendDeclarationEmail(env, { to: email, locale, referenceNumber, submittedAt, pdf: bytes });
  return json(200, { emailStatus: result.status, emailTo: maskEmail(email) });
});
