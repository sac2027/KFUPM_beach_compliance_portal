/**
 * Characters used to spoof or hide text: zero-width space, LRM/RLM, bidi embeddings/overrides/isolates,
 * word joiner and BOM. NOT the zero-width non-joiner / joiner (U+200C / U+200D): those are part of the
 * correct spelling of Persian, Urdu, Kurdish, Pashto, Malayalam and Sinhala names.
 */
const SPOOFING = /[\u200B\u200E\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
const JOINERS = /[\u200C\u200D]/g;

/** Removes spoofing characters only. Safe for names. */
export function stripInvisible(s: string): string {
  return s.replace(SPOOFING, '');
}

/** Removes joiners too. For identifiers (passport, phone) where they are never legitimate. */
export function stripAllInvisible(s: string): string {
  return stripInvisible(s).replace(JOINERS, '');
}

/** Joiners left dangling at either end of a name are noise from copy and paste. */
export function trimJoiners(s: string): string {
  return s.replace(/^[\u200C\u200D]+|[\u200C\u200D]+$/g, '');
}

/** Arabic-Indic (U+0660–0669) and Extended Arabic-Indic/Persian (U+06F0–06F9) digits → ASCII. */
function asciiDigits(s: string): string {
  return s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) & 0xf));
}

/** For identifiers: invisible characters removed, digits made ASCII, whitespace collapsed and trimmed. */
export function normaliseDigits(s: string): string {
  return asciiDigits(stripAllInvisible(s)).replace(/\s+/g, ' ').trim();
}
