/**
 * Field validation for the login step. Messages are i18n keys, translated by the UI, so the rules
 * live in one place and work in both languages. Each schema also *normalises* (see tests), so what
 * reaches authService is clean.
 */
import * as v from 'valibot';
import { COUNTRIES } from '../data/countries';
import { normaliseDigits, stripInvisible, trimJoiners } from './normalise';

export const NAME_MAX = 100;

export const passportSchema = v.pipe(
  v.string(),
  v.transform((s) => normaliseDigits(s).replace(/[\s-]/g, '').toUpperCase()),
  v.nonEmpty('error.required'),
  v.regex(/^[A-Z0-9]{5,20}$/, 'error.passport'),
);

export const emailSchema = v.pipe(
  v.string(),
  v.transform((s) => stripInvisible(s).trim().toLowerCase()),
  v.nonEmpty('error.required'),
  v.maxLength(254, 'error.email'),
  v.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'error.email'),
);

/**
 * Unicode letters and marks (Arabic, Latin with diacritics, Urdu, CJK, Thai…), plus space, apostrophes,
 * period, hyphen, the middle dots used when transliterating names (U+00B7, U+30FB) and the zero-width
 * (non-)joiners that belong to the spelling of many names (never first or last).
 */
const NAME_CHARS = /^[\p{L}\p{M}](?:[\p{L}\p{M} '’ʼ.\u00B7\u30FB-]|\u200C|\u200D)*$/u;

export const nameSchema = v.pipe(
  v.string(),
  v.transform((s) => trimJoiners(stripInvisible(s).replace(/\s+/g, ' ').trim())),
  v.nonEmpty('error.required'),
  v.regex(NAME_CHARS, 'error.name'),
  v.check((s) => [...s].filter((c) => /\p{L}/u.test(c)).length >= 2, 'error.name'),
  v.maxLength(NAME_MAX, 'error.name'),
);

/** One of the codes in the dropdown. Recorded with the declaration, never matched against the roster. */
export const nationalitySchema = v.pipe(
  v.string(),
  v.nonEmpty('error.nationality'),
  v.picklist(COUNTRIES.map(([code]) => code), 'error.nationality'),
);

/** Field order on the form: name, email, nationality, passport number. */
export const loginSchema = v.object({
  fullName: nameSchema,
  email: emailSchema,
  nationality: nationalitySchema,
  passportNumber: passportSchema,
});

export type LoginInput = v.InferInput<typeof loginSchema>;
export type LoginOutput = v.InferOutput<typeof loginSchema>;
