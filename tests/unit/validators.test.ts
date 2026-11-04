import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { normaliseDigits, stripInvisible } from '../../src/lib/normalise';
import { emailSchema, loginSchema, passportSchema } from '../../src/lib/validators';

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

describe('passport', () => {
  it.each(['A1234567', 'AB12345678', 'ab 123-4567', 'N١٢٣٤٥٦٧'])('accepts %s', (p) => expect(ok(passportSchema, p)).toBe(true));
  it('normalises to upper-case ASCII without spaces or hyphens', () => {
    expect(out(passportSchema, 'ab 123-4567')).toBe('AB1234567');
    expect(out(passportSchema, 'N١٢٣٤٥٦٧')).toBe('N1234567');
  });
  it.each(['P<', 'A123', 'A'.repeat(21), '!!!!!!!!', 'محمد12345'])('rejects %s', (p) => expect(msg(passportSchema, p)).toBe('error.passport'));
  it('reports empty as required', () => expect(msg(passportSchema, '  ')).toBe('error.required'));
});

describe('email', () => {
  it.each(['Mai@Example.com', ' s202368990@kfupm.edu.sa ', 'first.last+tag@sub.example.co.uk'])('accepts %s', (e) => expect(ok(emailSchema, e)).toBe(true));
  it('lower-cases and trims', () => expect(out(emailSchema, ' Mai@Example.COM ')).toBe('mai@example.com'));
  it.each(['mai', 'mai@', '@example.com', 'mai example@x.com', 'a@b'])('rejects %s', (e) => expect(msg(emailSchema, e)).toBe('error.email'));
  it('reports empty as required', () => expect(msg(emailSchema, '')).toBe('error.required'));
});

describe('loginSchema', () => {
  it('returns normalised values for both fields, in form order', () => {
    const out = v.parse(loginSchema, { email: ' M@Example.com', passportNumber: 'a1234567' });
    expect(out).toEqual({ email: 'm@example.com', passportNumber: 'A1234567' });
    expect(Object.keys(out)).toEqual(['email', 'passportNumber']);
  });
  it('asks for nothing else: no name, phone or nationality', () => {
    expect(Object.keys(loginSchema.entries)).toEqual(['email', 'passportNumber']);
  });
});
