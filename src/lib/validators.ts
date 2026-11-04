/**
 * Field validation for the login step. Messages are i18n keys, translated by the UI, so the rules
 * live in one place and work in both languages. Each schema also *normalises* (see tests), so what
 * reaches authService is clean.
 */
import * as v from 'valibot';
import { stripInvisible } from './normalise';

/** Any password of 8 to 128 characters. Never trimmed or altered, and never leaves the browser. */
export const passwordSchema = v.pipe(v.string(), v.nonEmpty('error.required'), v.minLength(8, 'error.password'), v.maxLength(128, 'error.password'));

export const emailSchema = v.pipe(
  v.string(),
  v.transform((s) => stripInvisible(s).trim().toLowerCase()),
  v.nonEmpty('error.required'),
  v.maxLength(254, 'error.email'),
  v.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'error.email'),
);

/** Field order on the form: email, password. */
export const loginSchema = v.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LoginInput = v.InferInput<typeof loginSchema>;
export type LoginOutput = v.InferOutput<typeof loginSchema>;
