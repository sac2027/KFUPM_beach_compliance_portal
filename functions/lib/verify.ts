import { namesMatch, normaliseEmail, normalisePassport } from './match';

export interface VerifyInput {
  passport: string;
  name: string;
  email: string;
}

export interface RosterRow {
  passport_number: string;
  full_name: string;
  email: string;
  status: 'active' | 'withdrawn';
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalises the request; null when anything is missing or malformed (the caller answers 400). */
export function parseVerifyBody(body: unknown): VerifyInput | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if ([b.passportNumber, b.fullName, b.email].some((v) => typeof v !== 'string')) return null;
  const passport = normalisePassport(b.passportNumber as string);
  const name = (b.fullName as string).normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  const email = normaliseEmail(b.email as string);
  if (!/^[A-Z0-9]{5,20}$/.test(passport) || name.length < 2 || name.length > 200 || !EMAIL.test(email) || email.length > 254) return null;
  return { passport, name, email };
}

/** Passport, email and name must all agree with an active roster row. Name is compared loosely (see match.ts). */
export function matchStudent(typed: VerifyInput, roster: RosterRow | null): boolean {
  if (!roster || roster.status !== 'active') return false;
  return (
    normalisePassport(roster.passport_number) === typed.passport &&
    normaliseEmail(roster.email) === typed.email &&
    namesMatch(typed.name, roster.full_name)
  );
}

export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  return at <= 0 ? '•••' : `${email[0]}•••${email.slice(at)}`;
}
