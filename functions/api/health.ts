import type { Env } from '../lib/env';
import { handle, json } from '../lib/http';

/** Reports whether email is configured. No data is returned. */
export const onRequestGet = handle<Env>(async ({ env }) => {
  const configured = env.EMAIL_MODE !== 'resend' || Boolean(env.RESEND_API_KEY);
  return json(configured ? 200 : 503, { ok: configured, email: env.EMAIL_MODE === 'resend' ? 'resend' : 'log', configured, from: env.EMAIL_FROM, bcc: Boolean(env.EMAIL_BCC) });
});
