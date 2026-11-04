// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isPdf, maskEmail, parseDeclarationForm } from '../../functions/lib/declaration';

const NOW = Date.parse('2026-11-04T10:00:00Z');
const pdf = () => new File([new TextEncoder().encode('%PDF-1.7 fake')], 'KFUPM-UBR-2026-ABCDEF.pdf', { type: 'application/pdf' });
function form(over: Record<string, string | File | null> = {}): FormData {
  const base: Record<string, string | File | null> = { email: ' Mai@Example.com ', locale: 'en', referenceNumber: 'UBR-2026-ABCDEF', submittedAt: '2026-11-04T09:59:00Z', pdf: pdf(), ...over };
  const f = new FormData();
  for (const [k, v] of Object.entries(base)) if (v !== null) f.set(k, v);
  return f;
}

describe('parseDeclarationForm', () => {
  it('accepts a complete declaration and normalises the email', () => {
    const r = parseDeclarationForm(form(), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ email: 'mai@example.com', locale: 'en', referenceNumber: 'UBR-2026-ABCDEF' });
  });
  it.each([
    ['missing email', { email: null }, /email/],
    ['email without @', { email: 'mai.example.com' }, /email/],
    ['email too long', { email: 'a'.repeat(250) + '@x.co' }, /email/],
    ['unknown locale', { locale: 'fr' }, /locale/],
    ['old-style reference', { referenceNumber: 'PACF-2026-ABCDEF' }, /reference/],
    ['signed two days ago', { submittedAt: '2026-11-02T09:00:00Z' }, /submittedAt/],
    ['no file', { pdf: null }, /pdf/],
    ['empty file', { pdf: new File([], 'x.pdf') }, /pdf/],
    ['file sent as text', { pdf: 'not a file' }, /pdf/],
  ])('rejects %s', (_n, over, re) => {
    const r = parseDeclarationForm(form(over as never), NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(re);
  });
});

describe('helpers', () => {
  it('masks an email and recognises a PDF by its bytes', () => {
    expect(maskEmail('mai@example.com')).toBe('m•••@example.com');
    expect(maskEmail('nope')).toBe('•••');
    expect(isPdf(new TextEncoder().encode('%PDF-1.4'))).toBe(true);
    expect(isPdf(new TextEncoder().encode('<html>'))).toBe(false);
  });
});
