import { describe, expect, it } from 'vitest';
import {
  assessImage,
  inkRatio,
  MAX_SIGNATURE_BYTES,
  MIN_STROKE_LENGTH,
  sniffImageType,
  strokeLength,
  totalStrokeLength,
  validateSignatureFile,
} from '../../src/lib/signature';

const file = (type: string, size: number) => ({ type, size });
const blobOf = (bytes: number[], type = 'application/octet-stream') => new Blob([new Uint8Array(bytes)], { type });

describe('validateSignatureFile', () => {
  it('accepts PNG and JPEG up to the limit', () => {
    expect(validateSignatureFile(file('image/png', 100 * 1024))).toEqual({ ok: true });
    expect(validateSignatureFile(file('image/jpeg', MAX_SIGNATURE_BYTES))).toEqual({ ok: true });
  });
  it.each([
    ['image/svg+xml', 'type'],
    ['application/pdf', 'type'],
    ['image/gif', 'type'],
    ['text/html', 'type'],
    ['', 'type'],
  ])('rejects %s as %s', (mime, reason) => {
    expect(validateSignatureFile(file(mime, 1000))).toEqual({ ok: false, reason });
  });
  it('rejects oversize and empty files', () => {
    expect(validateSignatureFile(file('image/png', 3 * 1024 * 1024))).toEqual({ ok: false, reason: 'size' });
    expect(validateSignatureFile(file('image/png', MAX_SIGNATURE_BYTES + 1))).toEqual({ ok: false, reason: 'size' });
    expect(validateSignatureFile(file('image/png', 0))).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('sniffImageType (trust the bytes, not the label)', () => {
  it('recognises PNG and JPEG signatures', async () => {
    expect(await sniffImageType(blobOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(await sniffImageType(blobOf([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe('jpeg');
  });
  it('rejects HTML, SVG and empty data even if the file claims to be an image', async () => {
    expect(await sniffImageType(blobOf([...new TextEncoder().encode('<html><script>alert(1)</script>')], 'image/png'))).toBeNull();
    expect(await sniffImageType(blobOf([...new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')], 'image/png'))).toBeNull();
    expect(await sniffImageType(blobOf([]))).toBeNull();
  });
});

describe('strokeLength', () => {
  const p = (x: number, y: number) => ({ x, y });
  it('measures the path length of one stroke', () => {
    expect(strokeLength([p(0, 0), p(30, 40)])).toBe(50);
    expect(strokeLength([p(0, 0), p(10, 0), p(10, 10)])).toBe(20);
  });
  it('is zero for a dot or nothing', () => {
    expect(strokeLength([p(5, 5)])).toBe(0);
    expect(strokeLength([])).toBe(0);
  });
  it('adds up strokes, and a signature needs at least the minimum', () => {
    const accidentalDot = [[p(0, 0), p(1, 1)]];
    expect(totalStrokeLength(accidentalDot)).toBeLessThan(MIN_STROKE_LENGTH);
    const real = [[p(0, 0), p(30, 0)], [p(0, 10), p(30, 10)]];
    expect(totalStrokeLength(real)).toBe(60);
    expect(totalStrokeLength(real)).toBeGreaterThanOrEqual(MIN_STROKE_LENGTH);
    expect(MIN_STROKE_LENGTH).toBe(40);
  });
});

describe('inkRatio and assessImage: a blank or tiny image is not a signature', () => {
  const px = (r: number, g: number, b: number, a = 255) => [r, g, b, a];
  const image = (n: number, dark: number) =>
    new Uint8ClampedArray([...Array.from({ length: dark }, () => px(0, 0, 0)).flat(), ...Array.from({ length: n - dark }, () => px(255, 255, 255)).flat()]);

  it('measures the share of non-white pixels', () => {
    expect(inkRatio(image(100, 0))).toBe(0);
    expect(inkRatio(image(100, 5))).toBeCloseTo(0.05, 5);
    expect(inkRatio(image(100, 100))).toBe(1);
  });
  it('treats near-white scanner noise as paper, not ink', () => {
    expect(inkRatio(new Uint8ClampedArray([...px(250, 250, 250), ...px(245, 246, 247)]))).toBe(0);
  });
  it('accepts a normal signature photo', () => {
    expect(assessImage({ width: 900, height: 300, ink: 0.02 })).toBe('ok');
  });
  it.each([
    [{ width: 1, height: 1, ink: 1 }, 'small'],
    [{ width: 40, height: 15, ink: 0.3 }, 'small'],
    [{ width: 900, height: 300, ink: 0 }, 'blank'],
    [{ width: 900, height: 300, ink: 0.00001 }, 'blank'],
  ])('%j is %s', (input, verdict) => expect(assessImage(input)).toBe(verdict));
});
