import { countryName } from '../../src/data/countries';
import { TERM_IDS } from './terms';
import type { TermId } from './terms';

export const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

export interface SubmissionInput {
  /** English country name, from the ISO code the form sends. */
  nationality: string;
  acceptedTermIds: TermId[];
  signature: { method: 'draw' | 'upload'; bytes: Uint8Array; contentType: 'image/png' | 'image/jpeg' };
}

export type ValidationResult = { ok: true; value: SubmissionInput } | { ok: false; message: string };

function decodeDataUrl(dataUrl: unknown): { bytes: Uint8Array; contentType: 'image/png' | 'image/jpeg' } | null {
  if (typeof dataUrl !== 'string') return null;
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!m) return null;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  return { bytes, contentType: m[1] === 'png' ? 'image/png' : 'image/jpeg' };
}

/** Trusts the bytes, not the label. */
export function sniffImage(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

/** Everything the browser may send for a submission, re-checked here because the browser is not trusted. */
export function parseSubmissionBody(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Request body must be an object.' };
  const b = body as Record<string, unknown>;
  const nationality = typeof b.nationality === 'string' ? countryName(b.nationality) : null;
  if (!nationality) return { ok: false, message: 'nationality must be one of the listed countries.' };
  const ids = b.acceptedTermIds;
  if (!Array.isArray(ids) || ids.length !== TERM_IDS.length || !TERM_IDS.every((id, i) => ids[i] === id)) {
    return { ok: false, message: 'All five terms must be accepted, in order.' };
  }
  const sig = b.signature as Record<string, unknown> | undefined;
  if (!sig || (sig.method !== 'draw' && sig.method !== 'upload')) return { ok: false, message: 'signature.method must be draw or upload.' };
  const decoded = decodeDataUrl(sig.dataUrl);
  if (!decoded) return { ok: false, message: 'signature.dataUrl must be a PNG or JPEG data URL.' };
  if (decoded.bytes.length === 0) return { ok: false, message: 'The signature image is empty.' };
  if (decoded.bytes.length > MAX_SIGNATURE_BYTES) return { ok: false, message: 'The signature image is larger than 2 MB.' };
  const sniffed = sniffImage(decoded.bytes);
  if (!sniffed || sniffed !== decoded.contentType) return { ok: false, message: 'The signature image is not a valid PNG or JPEG.' };
  return { ok: true, value: { nationality, acceptedTermIds: [...TERM_IDS], signature: { method: sig.method, bytes: decoded.bytes, contentType: sniffed } } };
}

export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}
