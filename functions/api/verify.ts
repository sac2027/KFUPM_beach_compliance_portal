import type { Env } from '../lib/env';
import { error, handle, json, readJson } from '../lib/http';
import { signSession } from '../lib/jwt';
import { bump, clear, hashIp, peek } from '../lib/throttle';
import { maskEmail, matchStudent, parseVerifyBody } from '../lib/verify';
import type { RosterRow } from '../lib/verify';

const SESSION_TTL_SECONDS = 30 * 60;
const WINDOW_SECONDS = 15 * 60;
const PASSPORT_LIMIT = 5;
const IP_LIMIT = 100; // failures per IP per window; successes never count (shared campus and household IPs)
const NO_MATCH = { code: 'no_match', message: 'These details do not match our records. Check each one, typing your name exactly as it appears in your passport.' };

/**
 * POST /api/verify {fullName, email, passportNumber}  (the nationality the student picks is recorded later, never checked)
 * One generic failure for every kind of mismatch, so the response never reveals which field was wrong or whether
 * the passport exists. Failed attempts are throttled per passport and per (hashed) IP; successes are not counted.
 */
export const onRequestPost = handle<Env>(async ({ request, env }) => {
  const input = parseVerifyBody(await readJson(request));
  if (!input) return error(400, 'bad_request', 'Full name, email and passport number are required.');

  const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';
  const ipKey = `ip:${await hashIp(ip, env.SESSION_SECRET)}`;
  const passportKey = `p:${input.passport}`;
  const [byIp, byPassport] = await Promise.all([peek(env.RECORDS, ipKey, IP_LIMIT, WINDOW_SECONDS), peek(env.RECORDS, passportKey, PASSPORT_LIMIT, WINDOW_SECONDS)]);
  if (!byIp.allowed || !byPassport.allowed) {
    const wait = Math.max(byIp.retryAfter ?? 0, byPassport.retryAfter ?? 0);
    return error(429, 'too_many_attempts', 'Too many attempts. Please wait before trying again.', { 'retry-after': String(wait) });
  }

  const row = await env.ROSTER.prepare('SELECT passport_number, full_name, email, status FROM students WHERE passport_number = ?').bind(input.passport).first<RosterRow>();
  if (!matchStudent(input, row)) {
    await Promise.all([bump(env.RECORDS, ipKey, IP_LIMIT, WINDOW_SECONDS), bump(env.RECORDS, passportKey, PASSPORT_LIMIT, WINDOW_SECONDS)]);
    return json(401, NO_MATCH);
  }

  const sid = crypto.randomUUID();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_SECONDS * 1000);
  await env.RECORDS.prepare('INSERT INTO sessions (sid, passport_number, issued_at, expires_at) VALUES (?, ?, ?, ?)').bind(sid, row!.passport_number, issuedAt.toISOString(), expiresAt.toISOString()).run();
  await clear(env.RECORDS, passportKey);
  const token = await signSession({ sid }, env.SESSION_SECRET, SESSION_TTL_SECONDS);

  return json(200, {
    session: {
      sessionId: sid,
      student: { fullName: row!.full_name, email: maskEmail(row!.email), passportLast4: row!.passport_number.slice(-4) },
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
    token,
  });
});
