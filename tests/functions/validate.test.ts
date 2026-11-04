// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TERM_IDS } from '../../functions/lib/terms';
import { TERM_IDS as APP_TERM_IDS } from '../../src/lib/termsSchema';
import { isPdf, parseSubmissionBody, sniffImage } from '../../functions/lib/validate';
import { generateReference } from '../../functions/lib/records';

const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64')}`;
const good = { nationality: 'VN', acceptedTermIds: [...TERM_IDS], signature: { method: 'draw', dataUrl: PNG } };

describe('term ids', () => {
  it('match the app’s list exactly', () => expect([...TERM_IDS]).toEqual([...APP_TERM_IDS]));
});

describe('parseSubmissionBody', () => {
  it('accepts a complete submission and decodes the signature', () => {
    const r = parseSubmissionBody(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.signature.contentType).toBe('image/png');
      expect(r.value.signature.bytes.length).toBe(12);
      expect(r.value.acceptedTermIds).toEqual([...TERM_IDS]);
      expect(r.value.nationality).toBe('Vietnam'); // the code becomes the country name
    }
  });
  it.each([
    ['four ids', { ...good, acceptedTermIds: TERM_IDS.slice(0, 4) }, /five terms/],
    ['wrong order', { ...good, acceptedTermIds: [...TERM_IDS].reverse() }, /five terms/],
    ['a duplicate instead of the fifth', { ...good, acceptedTermIds: [...TERM_IDS.slice(0, 4), 'saudi-laws'] }, /five terms/],
    ['an unknown nationality', { ...good, nationality: 'XX' }, /nationality/],
    ['a country name instead of its code', { ...good, nationality: 'Vietnam' }, /nationality/],
    ['no nationality', { acceptedTermIds: good.acceptedTermIds, signature: good.signature }, /nationality/],
    ['an SVG', { ...good, signature: { method: 'upload', dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' } }, /PNG or JPEG data URL/],
    ['HTML labelled as PNG', { ...good, signature: { method: 'upload', dataUrl: `data:image/png;base64,${Buffer.from('<html>').toString('base64')}` } }, /not a valid PNG/],
    ['a JPEG label on PNG bytes', { ...good, signature: { method: 'upload', dataUrl: PNG.replace('image/png', 'image/jpeg') } }, /not a valid PNG/],
    ['an https URL', { ...good, signature: { method: 'upload', dataUrl: 'https://evil.example/x.png' } }, /data URL/],
    ['an unknown method', { ...good, signature: { method: 'typed', dataUrl: PNG } }, /method/],
    ['no body', null, /object/],
  ])('rejects %s', (_n, body, msg) => {
    const r = parseSubmissionBody(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(msg);
  });
  it('rejects an image over 2 MB', () => {
    const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2 * 1024 * 1024)]);
    const r = parseSubmissionBody({ ...good, signature: { method: 'upload', dataUrl: `data:image/png;base64,${big.toString('base64')}` } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/2 MB/);
  });
});

describe('sniffImage / isPdf', () => {
  it('recognise magic bytes only', () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImage(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBeNull();
    expect(isPdf(new TextEncoder().encode('%PDF-1.7 ...'))).toBe(true);
    expect(isPdf(new TextEncoder().encode('<html>%PDF'))).toBe(false);
  });
});

describe('generateReference', () => {
  it('looks like PACF-YYYY-XXXXXX from an unambiguous alphabet, and differs each time', () => {
    const a = generateReference(new Date('2026-11-02T00:00:00Z'));
    const b = generateReference(new Date('2026-11-02T00:00:00Z'));
    expect(a).toMatch(/^PACF-2026-[A-HJ-NP-Z2-9]{6}$/);
    expect(a).not.toBe(b);
  });
});
