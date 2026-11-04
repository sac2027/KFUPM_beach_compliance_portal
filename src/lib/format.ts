import type { Locale } from './termsSchema';

/** Gregorian calendar and Latin digits, so every printed date reads the same. */
const TAGS: Record<Locale, string> = { en: 'en-GB-u-ca-gregory' };

export function formatDate(iso: string, locale: Locale, timeZone?: string): string {
  return new Intl.DateTimeFormat(TAGS[locale], { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(new Date(iso));
}

/** Date and 24-hour time, ending in the time zone (e.g. `13:15 GMT+3`). */
export function formatDateTime(iso: string, locale: Locale, timeZone?: string): string {
  return new Intl.DateTimeFormat(TAGS[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short', // the student may sign from anywhere: the zone makes the time unambiguous
    timeZone,
  }).format(new Date(iso));
}

/** Shows only the last four characters: the printed copy leaves the student's hands. Accepts a full number or the last four. */
export function maskPassport(passport: string): string {
  if (passport.length === 0) return '';
  return `••••${passport.slice(-4)}`;
}
