import type { Env } from '../../../lib/env';
import { sendDeclarationEmail } from '../../../lib/email';
import { error, handle, json } from '../../../lib/http';
import { getSubmission, requireSession, sha256Hex } from '../../../lib/records';
import { maskEmail } from '../../../lib/verify';
import { isPdf } from '../../../lib/validate';

const MAX_PDF_BYTES = 8 * 1024 * 1024;

/** The session must be the one that created this record. */
async function ownRecord(env: Env, request: Request, id: string) {
  const session = await requireSession(env, request);
  if (session.submission_id !== id) throw Object.assign(new Error('not yours'), { status: 404 });
  const row = await getSubmission(env, id);
  if (!row) throw Object.assign(new Error('missing'), { status: 404 });
  return row;
}

/**
 * PUT /api/submissions/:id/document  (Bearer, application/pdf ≤ 8 MB)
 * Stores the declaration PDF the browser rendered, then emails it to the roster address. → {emailStatus, emailTo}
 */
export const onRequestPut = handle<Env>(async ({ request, env, params }) => {
  const id = String(params.id);
  let row;
  try {
    row = await ownRecord(env, request, id);
  } catch (e) {
    if ((e as { status?: number }).status === 404) return error(404, 'not_found', 'No such submission.');
    throw e;
  }
  if (row.pdf_key && (row.email_status === 'sent' || row.email_status === 'logged')) return error(409, 'already_sent', 'The document for this submission has already been received and sent.');

  const len = Number(request.headers.get('content-length') ?? 0);
  if (len > MAX_PDF_BYTES) return error(413, 'too_large', 'The PDF is larger than 8 MB.');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX_PDF_BYTES) return error(413, 'too_large', 'The PDF is larger than 8 MB.');
  if (!isPdf(bytes)) return error(400, 'invalid_document', 'The document must be a PDF.');

  const key = `submissions/${id}/declaration.pdf`;
  const sha = await sha256Hex(bytes);
  await env.DOCUMENTS.put(key, bytes, { httpMetadata: { contentType: 'application/pdf', contentDisposition: `attachment; filename="KFUPM-PACF-${row.reference_number}.pdf"` } });
  const receivedAt = new Date().toISOString();
  await env.RECORDS.prepare('UPDATE submissions SET pdf_key = ?, pdf_sha256 = ?, pdf_bytes = ?, document_received_at = ? WHERE id = ?').bind(key, sha, bytes.length, receivedAt, id).run();

  const result = await sendDeclarationEmail(env, { to: row.email, fullName: row.full_name, referenceNumber: row.reference_number, submittedAt: row.submitted_at, pdf: bytes, submissionId: id });
  await env.RECORDS.prepare('UPDATE submissions SET email_status = ?, email_message_id = ?, email_error = ?, email_sent_at = ? WHERE id = ?')
    .bind(result.status, result.status === 'sent' ? result.messageId : null, result.status === 'failed' ? result.error : null, result.status === 'failed' ? null : receivedAt, id)
    .run();

  return json(200, { emailStatus: result.status, emailTo: maskEmail(row.email) });
});
