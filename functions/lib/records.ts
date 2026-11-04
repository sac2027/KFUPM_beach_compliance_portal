import type { Env } from './env';
import { HttpError } from './http';
import { verifySession } from './jwt';

/** Unambiguous upper-case alphabet (no 0/O, 1/I) for reference numbers a student may read out over the phone. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReference(now = new Date()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `PACF-${now.getUTCFullYear()}-${code}`;
}

export interface SessionRow {
  sid: string;
  passport_number: string;
  issued_at: string;
  expires_at: string;
  used_at: string | null;
  submission_id: string | null;
}

/** Bearer token → live session row, or 401 session_expired (one code for missing, invalid, unknown and expired). */
export async function requireSession(env: Env, request: Request): Promise<SessionRow> {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const expired = new HttpError(401, 'session_expired', 'Your session has expired. Please sign in again.');
  const claims = token ? await verifySession(token, env.SESSION_SECRET) : null;
  if (!claims) throw expired;
  const row = await env.RECORDS.prepare('SELECT sid, passport_number, issued_at, expires_at, used_at, submission_id FROM sessions WHERE sid = ?').bind(claims.sid).first<SessionRow>();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) throw expired;
  return row;
}

export interface SubmissionRow {
  id: string;
  reference_number: string;
  full_name: string;
  passport_last4: string;
  email: string;
  nationality: string | null;
  locale: 'en';
  pdf_key: string | null;
  pdf_sha256: string | null;
  submitted_at: string;
  email_status: 'pending' | 'sent' | 'logged' | 'failed';
  email_message_id: string | null;
  email_error: string | null;
}

export async function getSubmission(env: Env, id: string): Promise<SubmissionRow | null> {
  return env.RECORDS.prepare('SELECT id, reference_number, full_name, passport_last4, email, nationality, locale, pdf_key, pdf_sha256, submitted_at, email_status, email_message_id, email_error FROM submissions WHERE id = ?').bind(id).first<SubmissionRow>();
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
