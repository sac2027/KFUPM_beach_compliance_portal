/** Unambiguous uppercase alphabet (no 0/O, 1/I) for reference numbers a student may read out over the phone. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const REFERENCE_PATTERN = /^UBR-\d{4}-[A-Z0-9]{6}$/;

export function generateReference(now = new Date()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `UBR-${now.getUTCFullYear()}-${code}`;
}

/** File name of the declaration PDF, for the download and the email attachment. */
export const attachmentName = (reference: string): string => `KFUPM-${reference}.pdf`;
