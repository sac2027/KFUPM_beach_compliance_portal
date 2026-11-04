import type { Env } from '../../../lib/env';
import { error, handle } from '../../../lib/http';
import { getSubmission, requireSession } from '../../../lib/records';

/** GET /api/submissions/:id/document.pdf  (Bearer) → the student's own stored PDF. */
export const onRequestGet = handle<Env>(async ({ request, env, params }) => {
  const id = String(params.id);
  const session = await requireSession(env, request);
  const row = session.submission_id === id ? await getSubmission(env, id) : null;
  if (!row || !row.pdf_key) return error(404, 'not_found', 'No such document.');
  const obj = await env.DOCUMENTS.get(row.pdf_key);
  if (!obj) return error(404, 'not_found', 'No such document.');
  return new Response(obj.body, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="KFUPM-PACF-${row.reference_number}.pdf"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    },
  });
});
