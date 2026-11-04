/**
 * Field validation for the login step. Messages are i18n keys, translated by the UI, so the rules
 * live in one place and work in both languages. Each schema also *normalises* (see tests), so what
 * reaches authService is clean.
 */
import * as v from 'valibot';
import { normaliseDigits, stripInvisible } from './normalise';

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

/** Field order on the form: email, passport number. */
export const loginSchema = v.object({
  email: emailSchema,
  passportNumber: passportSchema,
});

export type LoginInput = v.InferInput<typeof loginSchema>;
export type LoginOutput = v.InferOutput<typeof loginSchema>;
