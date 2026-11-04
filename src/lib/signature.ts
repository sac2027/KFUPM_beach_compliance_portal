export const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
/** CSS px of ink below which a "signature" is treated as an accidental mark. */
export const MIN_STROKE_LENGTH = 40;
/** Uploaded images are downscaled to this width before submission (also strips EXIF and other metadata). */
export const MAX_UPLOAD_WIDTH = 900;
export const MAX_UPLOAD_HEIGHT = 400;
/** Below this a picture cannot be a photo of a signature. */
export const MIN_UPLOAD_WIDTH = 60;
export const MIN_UPLOAD_HEIGHT = 20;
/** Share of non-white pixels below which an image is treated as blank. */
export const MIN_INK_RATIO = 0.0005;

export type SignatureFileProblem = 'type' | 'size' | 'empty';

/** First pass, on the file's claimed type and size. `sniffImageType` then checks the real bytes. */
export function validateSignatureFile(f: Pick<File, 'type' | 'size'>): { ok: true } | { ok: false; reason: SignatureFileProblem } {
  if (f.type !== 'image/png' && f.type !== 'image/jpeg') return { ok: false, reason: 'type' };
  if (f.size === 0) return { ok: false, reason: 'empty' };
  if (f.size > MAX_SIGNATURE_BYTES) return { ok: false, reason: 'size' };
  return { ok: true };
}

function readHead(blob: Blob, length: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob.slice(0, length));
  });
}

/** Identifies PNG/JPEG by magic number. A file that merely *claims* image/png (HTML, SVG, …) returns null. */
export async function sniffImageType(blob: Blob): Promise<'png' | 'jpeg' | null> {
  const b = await readHead(blob, 8);
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  return null;
}

export interface Point {
  x: number;
  y: number;
}

export function strokeLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  return total;
}

export function totalStrokeLength(strokes: ReadonlyArray<readonly Point[]>): number {
  return strokes.reduce((sum, s) => sum + strokeLength(s), 0);
}

/** Share of pixels that are not (near-)white in RGBA data already composited on white. */
export function inkRatio(rgba: Uint8ClampedArray): number {
  const pixels = rgba.length / 4;
  if (pixels === 0) return 0;
  let ink = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if ((rgba[i]! + rgba[i + 1]! + rgba[i + 2]!) / 3 < 215) ink++;
  }
  return ink / pixels;
}

export type ImageVerdict = 'ok' | 'small' | 'blank';

/** A 1×1 pixel, a white page, or white ink on a transparent ground are not signatures. */
export function assessImage({ width, height, ink }: { width: number; height: number; ink: number }): ImageVerdict {
  if (width < MIN_UPLOAD_WIDTH || height < MIN_UPLOAD_HEIGHT) return 'small';
  if (ink < MIN_INK_RATIO) return 'blank';
  return 'ok';
}

export class SignatureImageError extends Error {
  readonly reason: 'small' | 'blank';
  constructor(reason: 'small' | 'blank') {
    super(`signature image is ${reason}`);
    this.name = 'SignatureImageError';
    this.reason = reason;
  }
}

/**
 * Decodes an uploaded image and re-encodes it as PNG on a white ground, downscaled. This drops metadata
 * (EXIF/GPS), proves the file really is a decodable image, and rejects pictures that are too small or
 * blank to be a signature. Browser only.
 */
export async function rasteriseImage(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    if (assessImage({ width: bitmap.width, height: bitmap.height, ink: 1 }) === 'small') throw new SignatureImageError('small');
    const scale = Math.min(1, MAX_UPLOAD_WIDTH / bitmap.width, MAX_UPLOAD_HEIGHT / bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('canvas unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const ink = inkRatio(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    if (assessImage({ width: bitmap.width, height: bitmap.height, ink }) === 'blank') throw new SignatureImageError('blank');
    return canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}
