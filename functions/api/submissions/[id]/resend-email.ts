import type { Env } from '../../../lib/env';
import { sendDeclarationEmail } from '../../../lib/email';
import { error, handle, json } from '../../../lib/http';
import { getSubmission, requireSession } from '../../../lib/records';
import { maskEmail } from '../../../lib/verify';

/** POST /api/submissions/:id/resend-email  (Bearer) → tries the email again from the stored PDF. */
export const onRequestPost = handle<Env>(async ({ request, env, params }) => {
  const id = String(params.id);
  const session = await requireSession(env, request);
  const row = session.submission_id === id ? await getSubmission(env, id) : null;
  if (!row) return error(404, 'not_found', 'No such submission.');
  if (!row.pdf_key) return error(409, 'no_document', 'The document has not been received yet.');
  if (row.email_status === 'sent' || row.email_status === 'logged') return json(200, { emailStatus: row.email_status, emailTo: maskEmail(row.email) });

  const obj = await env.DOCUMENTS.get(row.pdf_key);
  if (!obj) return error(409, 'no_document', 'The document could not be read.');
  const pdf = new Uint8Array(await obj.arrayBuffer());
  const result = await sendDeclarationEmail(env, { to: row.email, fullName: row.full_name, referenceNumber: row.reference_number, submittedAt: row.submitted_at, pdf, submissionId: id });
  await env.RECORDS.prepare('UPDATE submissions SET email_status = ?, email_message_id = ?, email_error = ?, email_sent_at = ? WHERE id = ?')
    .bind(result.status, result.status === 'sent' ? result.messageId : null, result.status === 'failed' ? result.error : null, result.status === 'failed' ? null : new Date().toISOString(), id)
    .run();
  return json(200, { emailStatus: result.status, emailTo: maskEmail(row.email) });
});
