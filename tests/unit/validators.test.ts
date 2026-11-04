import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { normaliseDigits, stripInvisible } from '../../src/lib/normalise';
import { emailSchema, loginSchema, nameSchema, nationalitySchema, passportSchema } from '../../src/lib/validators';

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

describe('nationality', () => {
  it.each(['VN', 'SA', 'TN', 'GB'])('accepts the code %s', (c) => expect(ok(nationalitySchema, c)).toBe(true));
  it.each(['', 'XX', 'vn', 'Vietnam', 'USA'])('rejects %j with the nationality message', (c) => expect(msg(nationalitySchema, c)).toBe('error.nationality'));
});

describe('email', () => {
  it.each(['Mai@Example.com', ' s202368990@kfupm.edu.sa ', 'first.last+tag@sub.example.co.uk'])('accepts %s', (e) => expect(ok(emailSchema, e)).toBe(true));
  it('lower-cases and trims', () => expect(out(emailSchema, ' Mai@Example.COM ')).toBe('mai@example.com'));
  it.each(['mai', 'mai@', '@example.com', 'mai example@x.com', 'a@b'])('rejects %s', (e) => expect(msg(emailSchema, e)).toBe('error.email'));
  it('reports empty as required', () => expect(msg(emailSchema, '')).toBe('error.required'));
});

describe('name', () => {
  it.each(['محمد عبدالله الغامدي', 'Nguyễn Thị Mai', "O'Brien-Smith", 'Łukasz Müller', 'ٹھاکر علی', 'Zoë Ó Briain', 'Jean-Luc Picard Jr.'])('accepts %s', (n) => expect(ok(nameSchema, n)).toBe(true));
  it.each(['12345', 'A', '   ', '1 2 3', 'Mai <script>', 'a'.repeat(101)])('rejects %j', (n) => expect(ok(nameSchema, n)).toBe(false));
  it('accepts exactly 100 characters and keeps a very long unbroken Arabic name', () => {
    expect(ok(nameSchema, 'م'.repeat(100))).toBe(true);
  });
  it('collapses whitespace and strips invisible bidi characters', () => {
    expect(out(nameSchema, '  Mai\u202E   Nguyễn \u200B')).toBe('Mai Nguyễn');
  });
  it('reports empty as required, malformed as error.name', () => {
    expect(msg(nameSchema, '')).toBe('error.required');
    expect(msg(nameSchema, '12345')).toBe('error.name');
  });
});

describe('names that real students have (break-ui)', () => {
  const ZWNJ = String.fromCharCode(0x200c);
  const ZWJ = String.fromCharCode(0x200d);
  it('keeps the zero-width non-joiner, which is part of the spelling of Persian, Urdu, Kurdish and Pashto names', () => {
    const name = 'نامه' + ZWNJ + 'ای احمدی';
    expect(ok(nameSchema, name)).toBe(true);
    expect(out(nameSchema, name)).toBe(name); // not silently respelled
  });
  it('keeps the zero-width joiner used in Malayalam and Sinhala names', () => {
    const name = 'സന്ദീപ്' + ZWJ + ' കുമാർ';
    expect(ok(nameSchema, name)).toBe(true);
    expect(out(nameSchema, name)).toBe(name);
  });
  it('still strips the invisible characters used for spoofing (zero-width space, bidi controls, BOM)', () => {
    expect(out(nameSchema, 'Mai' + String.fromCharCode(0x200b) + String.fromCharCode(0x202e) + ' Lee')).toBe('Mai Lee');
  });
  it('trims stray joiners at the edges', () => {
    expect(out(nameSchema, ZWNJ + 'Mai Lee' + ZWJ)).toBe('Mai Lee');
  });
  it.each(['阿卜杜拉·本·穆罕默德', '王秀英', 'Ólafur Darri Ólafsson', 'Seán O' + String.fromCharCode(39) + 'Brien-Ó Súilleabháin', 'María José de la Cruz y Fernández', 'ʿAbd al-Raḥmān ʾAḥmad', 'Jo', '  Sam   Lee '])('accepts %s', (n) => expect(ok(nameSchema, n)).toBe(true));
  it.each(['🦊 Fox', '👩🏽‍💻 Priya', 'Mai ' + String.fromCharCode(60) + 'b' + String.fromCharCode(62), 'J'])('rejects %s with the name message', (n) => expect(msg(nameSchema, n)).toBe('error.name'));
});

describe('loginSchema', () => {
  it('returns normalised values for all four fields, in form order', () => {
    const out = v.parse(loginSchema, { fullName: ' محمد  عبدالله ', email: ' M@Example.com', nationality: 'SA', passportNumber: 'a1234567' });
    expect(out).toEqual({ fullName: 'محمد عبدالله', email: 'm@example.com', nationality: 'SA', passportNumber: 'A1234567' });
    expect(Object.keys(out)).toEqual(['fullName', 'email', 'nationality', 'passportNumber']);
  });
  it('has no phone field', () => {
    expect(Object.keys(loginSchema.entries)).not.toContain('phoneNumber');
  });
});
