import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { normaliseDigits, stripInvisible } from '../../src/lib/normalise';
import { emailSchema, loginSchema, passwordSchema } from '../../src/lib/validators';

const ok = (schema: v.GenericSchema, input: unknown) => v.safeParse(schema, input).success;
const out = (schema: v.GenericSchema, input: unknown) => (v.parse(schema, input) as string);
const msg = (schema: v.GenericSchema, input: unknown) => {
  const r = v.safeParse(schema, input);
  return r.success ? null : r.issues[0]!.message;
};

describe('normaliseDigits', () => {
  it('maps Arabic-Indic and Persian digits to ASCII and tidies whitespace', () => {
    expect(normaliseDigits('٠٥٥١٢٣٤٥٦٧')).toBe('0551234567');
    expect(normaliseDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(normaliseDigits('  A  1 ')).toBe('A 1');
  });
  it('strips bidi controls and zero-width characters (spoofing)', () => {
    expect(stripInvisible('A\u202E12\u200B3\u2066\uFEFF')).toBe('A123');
  });
});

describe('password', () => {
  it.each(['abcdefgh', 'Correct Horse 9!', 'ﾟp@ss wörd٣', 'x'.repeat(128)])('accepts %j', (p) => expect(ok(passwordSchema, p)).toBe(true));
  it('is never trimmed, upper-cased or otherwise altered', () => {
    expect(out(passwordSchema, '  Mixed Case 123  ')).toBe('  Mixed Case 123  ');
    expect(out(passwordSchema, 'N١٢٣٤٥٦٧٨')).toBe('N١٢٣٤٥٦٧٨');
  });
  it.each(['a', 'short12', 'x'.repeat(129)])('rejects %j with the password message', (p) => expect(msg(passwordSchema, p)).toBe('error.password'));
  it('reports empty as required', () => expect(msg(passwordSchema, '')).toBe('error.required'));
});

describe('email', () => {
  it.each(['Mai@Example.com', ' s202368990@kfupm.edu.sa ', 'first.last+tag@sub.example.co.uk'])('accepts %s', (e) => expect(ok(emailSchema, e)).toBe(true));
  it('lower-cases and trims', () => expect(out(emailSchema, ' Mai@Example.COM ')).toBe('mai@example.com'));
  it.each(['mai', 'mai@', '@example.com', 'mai example@x.com', 'a@b'])('rejects %s', (e) => expect(msg(emailSchema, e)).toBe('error.email'));
  it('reports empty as required', () => expect(msg(emailSchema, '')).toBe('error.required'));
});

describe('loginSchema', () => {
  it('returns normalised values for both fields, in form order', () => {
    const out = v.parse(loginSchema, { email: ' M@Example.com', password: 'a1234567' });
    expect(out).toEqual({ email: 'm@example.com', password: 'a1234567' });
    expect(Object.keys(out)).toEqual(['email', 'password']);
  });
  it('asks for nothing else: no name, phone or nationality', () => {
    expect(Object.keys(loginSchema.entries)).toEqual(['email', 'password']);
  });
});
