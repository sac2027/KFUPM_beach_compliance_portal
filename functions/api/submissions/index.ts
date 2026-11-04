import type { Env } from '../../lib/env';
import { error, handle, json, readJson } from '../../lib/http';
import { generateReference, requireSession } from '../../lib/records';
import { parseSubmissionBody } from '../../lib/validate';

interface RosterRow {
  full_name: string;
  passport_number: string;
  email: string;
}

/**
 * POST /api/submissions  (Bearer session token)  {locale, nationality, acceptedTermIds, signature:{method,dataUrl}}
 * Records the declaration for the verified student. Who they are comes from the roster via the session,
 * never from the body. One submission per session. → 201 {id, referenceNumber, submittedAt}
 */
export const onRequestPost = handle<Env>(async ({ request, env }) => {
  const session = await requireSession(env, request);
  if (session.used_at) return error(409, 'already_submitted', 'This sign-in has already been used to submit a declaration.');

  const parsed = parseSubmissionBody(await readJson(request, 3 * 1024 * 1024));
  if (!parsed.ok) return error(400, 'invalid_submission', parsed.message);
  const { nationality, acceptedTermIds, signature } = parsed.value;

  const student = await env.ROSTER.prepare('SELECT full_name, passport_number, email FROM students WHERE passport_number = ?').bind(session.passport_number).first<RosterRow>();
  if (!student) return error(401, 'session_expired', 'Your session has expired. Please sign in again.');

  const id = crypto.randomUUID();
  const submittedAt = new Date().toISOString();
  const signatureKey = `submissions/${id}/signature.${signature.contentType === 'image/png' ? 'png' : 'jpg'}`;
  await env.DOCUMENTS.put(signatureKey, signature.bytes, { httpMetadata: { contentType: signature.contentType } });

  // Reference numbers are random; on the rare collision, draw again.
  let referenceNumber = generateReference();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await env.RECORDS.batch([
        env.RECORDS.prepare(
          'INSERT INTO submissions (id, reference_number, full_name, passport_last4, email, nationality, locale, accepted_term_ids, signature_method, signature_key, submitted_at, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ).bind(id, referenceNumber, student.full_name, student.passport_number.slice(-4), student.email, nationality, 'en', JSON.stringify(acceptedTermIds), signature.method, signatureKey, submittedAt, (request.headers.get('user-agent') ?? '').slice(0, 300)),
        env.RECORDS.prepare('UPDATE sessions SET used_at = ?, submission_id = ? WHERE sid = ? AND used_at IS NULL').bind(submittedAt, id, session.sid),
      ]);
      break;
    } catch (err) {
      if (attempt === 4 || !/UNIQUE/i.test(err instanceof Error ? err.message : '')) throw err;
      referenceNumber = generateReference();
    }
  }

  return json(201, { id, referenceNumber, submittedAt });
});
